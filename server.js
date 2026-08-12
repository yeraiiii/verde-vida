import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./db.js";
import { CATEGORIES, BRANDS } from "./products-seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || process.env.PWD_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- Seguridad / utilidades ----------
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (fs.existsSync(path.join(DATA_DIR, "session_secret"))
    ? fs.readFileSync(path.join(DATA_DIR, "session_secret"), "utf8")
    : (fs.writeFileSync(path.join(DATA_DIR, "session_secret"), crypto.randomBytes(32).toString("hex")),
       fs.readFileSync(path.join(DATA_DIR, "session_secret"), "utf8")));

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function createToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  try {
    const [payload, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() - data.t > 1000 * 60 * 60 * 24 * 7) return null;
    return data.u;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.admin_token;
  const user = token ? verifyToken(token) : null;
  if (user !== "admin") {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

// Middleware para capturar errores en handlers async
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Middleware ----------
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  const raw = req.headers.cookie || "";
  req.cookies = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      req.cookies[key] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  next();
});

app.use("/assets", express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ---------- Esquema de base de datos ----------
async function initSchema() {
  if (db.engine === "postgres") {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        price NUMERIC NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT '',
        brand TEXT NOT NULL DEFAULT '',
        stock INTEGER NOT NULL DEFAULT 0,
        short_desc TEXT NOT NULL DEFAULT '',
        long_desc TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        properties TEXT NOT NULL DEFAULT '[]',
        characteristics TEXT NOT NULL DEFAULT '[]',
        featured INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        price REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT '',
        brand TEXT NOT NULL DEFAULT '',
        stock INTEGER NOT NULL DEFAULT 0,
        short_desc TEXT NOT NULL DEFAULT '',
        long_desc TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        properties TEXT NOT NULL DEFAULT '[]',
        characteristics TEXT NOT NULL DEFAULT '[]',
        featured INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }
}

// ---------- Migración de columnas nuevas (añade brand/stock si no existen) ----------
async function migrateColumns() {
  if (db.engine === "postgres") {
    try { await db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0`); } catch {}
  } else {
    try { await db.run(`ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await db.run(`ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0`); } catch {}
  }
}

// Versión de los datos iniciales: si cambia, se re-siembran productos y categorías.
const SEED_VERSION = 2;

// ---------- Datos iniciales ----------
const CATEGORY_DESCRIPTIONS = {
  proteinas: "Proteína en polvo de alta calidad para tu nutrición deportiva.",
  ganadores: "Fórmula para ganar masa muscular y energía.",
  creatina: "Creatina de alta pureza para fuerza y rendimiento.",
  aminoacidos: "Aminoácidos esenciales y BCAA para tu recuperación.",
  preentrenos: "Energía y enfoque para tus entrenamientos.",
  quemagrasas: "Complementos para apoyar el control de peso y el metabolismo.",
  vitaminas: "Vitaminas y minerales esenciales para tu bienestar.",
  omega: "Ácidos grasos esenciales Omega para tu salud cardiovascular.",
  plantas: "Plantas medicinales y herbolario natural.",
  colageno: "Colágeno y complementos para articulaciones y piel.",
  digestion: "Complementos para la digestión y el tránsito.",
  descanso: "Complementos para el descanso y el bienestar.",
  perros: "Alimentación de calidad para tu perro.",
  gatos: "Alimentación de calidad para tu gato.",
  otros: "Higiene, cosmética y otros complementos.",
};

async function resetCatalog() {
  await db.run("DELETE FROM products");
  await db.run("DELETE FROM categories");
  try {
    await db.run("DELETE FROM sqlite_sequence WHERE name IN ('products','categories')");
  } catch {}
}

async function seed() {
  const stored = (await db.get("SELECT value FROM settings WHERE key = 'seed_version'"))?.value;
  if (stored === String(SEED_VERSION)) return;

  await resetCatalog();

  for (const cat of CATEGORIES) {
    await db.run("INSERT INTO categories (name, slug) VALUES (?, ?)", [cat.name, cat.slug]);
  }
  const catId = async (slug) => (await db.get("SELECT id FROM categories WHERE slug = ?", [slug])).id;

  let count = 0;
  for (const brand of BRANDS) {
    for (const p of brand.items) {
      const cid = await catId(p.cat);
      const image = makeImage(`${brand.brand} ${p.name}`, p.cat, brand.brand);
      const short = CATEGORY_DESCRIPTIONS[p.cat] || "";
      await db.run(
        `INSERT INTO products (name, category_id, price, unit, brand, stock, short_desc, long_desc, image, properties, characteristics, featured, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.name, cid, 0, p.unit || "", brand.brand, p.stock || 0, short,
         `${short} Marca ${brand.brand}. Consulta en tienda para más información.`,
         image, JSON.stringify([]), JSON.stringify([`Marca: ${brand.brand}`, p.unit ? `Presentación: ${p.unit}` : ""].filter(Boolean)), 0, p.stock > 0 ? 1 : 0]
      );
      count++;
    }
  }

  await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ["seed_version", String(SEED_VERSION)]);
  console.log(`[seed] Cargados ${count} productos reales (${BRANDS.length} marcas, ${CATEGORIES.length} categorías).`);
}

function makeImage(name, catSlug, brand) {
  const palette = [
    ["#5c7d6a", "#dbe7dd"], ["#7f9c5d", "#e3ecd4"], ["#b08968", "#f0e4d8"],
    ["#8f9aa0", "#e6eaec"], ["#9b6b43", "#efe2d3"], ["#a58b5f", "#ece3d0"],
    ["#7d7a9b", "#e5e4ef"], ["#6b8f71", "#dce8df"], ["#a1674f", "#f0dfd2"],
    ["#4f7d8c", "#d8e8ee"], ["#9c6a8e", "#eadcec"], ["#7d8c4f", "#e6ecd4"],
  ];
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [bg, soft] = palette[hash % palette.length];
  const letters = (name.split(" ").slice(0, 2).map((w) => w[0] || "").join("") || "🌿").toUpperCase();
  const catLabel = (CATEGORIES.find((c) => c.slug === catSlug)?.name || "").split(" ")[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${soft}"/><stop offset="100%" stop-color="${bg}"/>
  </linearGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="640" cy="120" r="140" fill="#ffffff" opacity="0.15"/>
  <circle cx="120" cy="480" r="180" fill="#ffffff" opacity="0.12"/>
  <g opacity="0.9">
    <rect x="300" y="150" width="200" height="200" rx="40" fill="#ffffff" opacity="0.25"/>
    <circle cx="400" cy="250" r="56" fill="#ffffff" opacity="0.9"/>
  </g>
  <text x="400" y="430" font-family="Georgia, serif" font-size="34" fill="#ffffff" text-anchor="middle" font-weight="bold">${letters}</text>
  <text x="400" y="470" font-family="Arial, sans-serif" font-size="20" fill="#ffffff" text-anchor="middle" opacity="0.85">${catLabel}</text>
</svg>`;
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = path.join(__dirname, "public", "img", `${slug}.svg`);
  try { fs.writeFileSync(file, svg); } catch {}
  return `/img/${slug}.svg`;
}

// ---------- Inicialización de la contraseña del admin ----------
async function initAdmin() {
  const settings = await db.get("SELECT * FROM settings WHERE key = 'password_hash'");
  if (!settings) {
    const salt = crypto.randomBytes(16).toString("hex");
    const pass = process.env.ADMIN_PASSWORD || "admin";
    await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ["password_salt", salt]);
    await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ["password_hash", hashPassword(pass, salt)]);
    console.log(`[admin] Credenciales iniciales: admin / ${pass}. Cámbialas con ADMIN_PASSWORD.`);
  }
}

// ---------- API pública ----------
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/categories", wrap(async (_req, res) => {
  const rows = await db.all(`
    SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
    GROUP BY c.id ORDER BY c.name
  `);
  res.json(rows);
}));

app.get("/api/products", wrap(async (req, res) => {
  const { category, search, featured } = req.query;
  let sql = `SELECT * FROM products WHERE active = 1 AND stock > 0`;
  const params = [];
  if (category) { sql += ` AND category_id = ?`; params.push(category); }
  if (search) { sql += ` AND (name LIKE ? OR short_desc LIKE ? OR long_desc LIKE ? OR brand LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (featured) { sql += ` AND featured = 1`; }
  sql += ` ORDER BY brand, name`;
  const rows = await db.all(sql, params);
  for (const r of rows) {
    r.properties = JSON.parse(r.properties);
    r.characteristics = JSON.parse(r.characteristics);
  }
  res.json(rows);
}));

app.get("/api/products/featured", wrap(async (_req, res) => {
  const rows = await db.all("SELECT * FROM products WHERE active = 1 AND featured = 1 AND stock > 0 LIMIT 6");
  for (const r of rows) { r.properties = JSON.parse(r.properties); r.characteristics = JSON.parse(r.characteristics); }
  res.json(rows);
}));

app.get("/api/products/:id", wrap(async (req, res) => {
  const row = await db.get("SELECT * FROM products WHERE id = ? AND active = 1 AND stock > 0", [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: "Producto no encontrado" });
  row.properties = JSON.parse(row.properties);
  row.characteristics = JSON.parse(row.characteristics);
  res.json(row);
}));

// ---------- API admin ----------
app.post("/api/admin/login", wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (username !== "admin") return res.status(401).json({ error: "Credenciales incorrectas" });
  const salt = (await db.get("SELECT value FROM settings WHERE key = 'password_salt'"))?.value || "admin";
  const stored = (await db.get("SELECT value FROM settings WHERE key = 'password_hash'"))?.value;
  if (hashPassword(password, salt) !== stored) return res.status(401).json({ error: "Credenciales incorrectas" });
  res.json({ token: createToken("admin") });
}));

app.post("/api/admin/logout", (_req, res) => res.json({ ok: true }));

app.get("/api/admin/products", requireAdmin, wrap(async (_req, res) => {
  const rows = await db.all("SELECT * FROM products ORDER BY created_at DESC, id DESC");
  for (const r of rows) { r.properties = JSON.parse(r.properties); r.characteristics = JSON.parse(r.characteristics); }
  res.json(rows);
}));

app.post("/api/admin/products", requireAdmin, wrap(async (req, res) => {
  const p = req.body || {};
  const required = ["name", "category_id", "price", "short_desc", "long_desc"];
  for (const k of required) {
    if (p[k] === undefined || p[k] === null || p[k] === "") {
      return res.status(400).json({ error: `Falta el campo ${k}` });
    }
  }
  const id = await db.insert(
    `INSERT INTO products (name, category_id, price, unit, brand, stock, short_desc, long_desc, image, properties, characteristics, featured, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.name, Number(p.category_id), Number(p.price), p.unit || "", p.brand || "", Number(p.stock) || 0,
     p.short_desc, p.long_desc, p.image || "", JSON.stringify(p.properties || []), JSON.stringify(p.characteristics || []),
     p.featured ? 1 : 0, p.active === undefined || p.active ? 1 : 0]
  );
  res.status(201).json({ id });
}));

app.put("/api/admin/products/:id", requireAdmin, wrap(async (req, res) => {
  const p = req.body || {};
  await db.run(
    `UPDATE products SET
      name = ?, category_id = ?, price = ?, unit = ?, brand = ?, stock = ?, short_desc = ?, long_desc = ?,
      image = ?, properties = ?, characteristics = ?, featured = ?, active = ?
     WHERE id = ?`,
    [p.name, Number(p.category_id), Number(p.price), p.unit || "", p.brand || "", Number(p.stock) || 0,
     p.short_desc, p.long_desc, p.image || "", JSON.stringify(p.properties || []), JSON.stringify(p.characteristics || []),
     p.featured ? 1 : 0, p.active === undefined || p.active ? 1 : 0,
     Number(req.params.id)]
  );
  res.json({ ok: true });
}));

app.delete("/api/admin/products/:id", requireAdmin, wrap(async (req, res) => {
  await db.run("DELETE FROM products WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

app.post("/api/admin/categories", requireAdmin, wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existing = await db.get("SELECT id FROM categories WHERE slug = ?", [slug]);
  if (existing) return res.status(400).json({ error: "Ya existe una categoría con ese nombre" });
  await db.run("INSERT INTO categories (name, slug) VALUES (?, ?)", [name.trim(), slug]);
  res.status(201).json({ ok: true });
}));

app.put("/api/admin/categories/:id", requireAdmin, wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dup = await db.get("SELECT id FROM categories WHERE slug = ? AND id != ?", [slug, Number(req.params.id)]);
  if (dup) return res.status(400).json({ error: "Ya existe una categoría con ese nombre" });
  await db.run("UPDATE categories SET name = ?, slug = ? WHERE id = ?", [name.trim(), slug, Number(req.params.id)]);
  res.json({ ok: true });
}));

app.delete("/api/admin/categories/:id", requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const count = await db.get("SELECT COUNT(*) AS n FROM products WHERE category_id = ?", [id]);
  if (count.n > 0) {
    return res.status(400).json({ error: `No se puede eliminar: tiene ${count.n} producto(s). Mueve o elimina primero sus productos.` });
  }
  await db.run("DELETE FROM categories WHERE id = ?", [id]);
  res.json({ ok: true });
}));

app.get("/api/admin/settings", requireAdmin, wrap(async (_req, res) => {
  res.json({
    categories: await db.all(`
      SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
      FROM categories c LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id ORDER BY c.name
    `),
  });
}));

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// ---------- Arranque ----------
const server = app.listen(PORT, "0.0.0.0", async () => {
  try {
    await initSchema();
    await seed();
    await initAdmin();
    console.log(`Tienda de Nutrición corriendo en http://localhost:${PORT} (motor: ${db.engine})`);
  } catch (err) {
    console.error("[fatal] No se pudo inicializar:", err);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  server.close();
  await db.close();
  process.exit(0);
});
