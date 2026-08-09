import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Directorio de datos persistente
// Glitch expone /.data (persistente), Render/Koyeb usan DATA_DIR o PWD_DIR,
// local: ./data
const DEFAULT_DATA_DIR = process.env.PROJECT_DOMAIN ? "/.data" : path.join(__dirname, "data");
const DATA_DIR = process.env.DATA_DIR || process.env.PWD_DIR || DEFAULT_DATA_DIR;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "tienda.db"));
db.pragma("journal_mode = WAL");

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

// ---------- Middleware ----------
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

// Middleware sencillo de cookies
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
db.exec(`
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
    short_desc TEXT NOT NULL DEFAULT '',
    long_desc TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    properties TEXT NOT NULL DEFAULT '[]',
    characteristics TEXT NOT NULL DEFAULT '[]',
    featured INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- Datos iniciales ----------
function seed() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
  if (count > 0) return;

  const cats = [
    ["Aceites y Grasas Saludables", "aceites"],
    ["Cereales y Semillas", "cereales"],
    ["Frutos Secos y Superalimentos", "frutos-secos"],
    ["Hierbas y Especias", "hierbas"],
    ["Infusiones y Tés", "infusiones"],
    ["Mieles y Endulzantes Naturales", "mieles"],
    ["Suplementos Nutricionales", "suplementos"],
  ];
  const insCat = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)");
  for (const [name, slug] of cats) insCat.run(name, slug);

  const insProd = db.prepare(`
    INSERT INTO products (name, category_id, price, unit, short_desc, long_desc, image, properties, characteristics, featured, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const catId = (slug) => db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug).id;

  const products = [
    {
      name: "Aceite de Oliva Virgen Extra Ecológico",
      cat: "aceites",
      price: 12.5,
      unit: "500 ml",
      short: "AOVE prensado en frío de aceitunas arbequinas.",
      long: "Aceite de oliva virgen extra procedente de cultivo ecológico, obtenido únicamente mediante extracción en frío. Conserva todos los polifenoles y el sabor afrutado característico de la variedad arbequina.",
      props: ["Rico en ácidos grasos monoinsaturados", "Alto contenido en polifenoles", "Vitamina E"],
      chars: ["Prensado en frío", "Acidez ≤ 0,2°", "Cultivo ecológico certificado"],
    },
    {
      name: "Aceite de Coco Virgen",
      cat: "aceites",
      price: 9.9,
      unit: "350 g",
      short: "Aceite de coco prensado en frío, ideal para cocinar.",
      long: "Aceite de coco virgen extra obtenido por prensado en frío de la pulpa fresca de cocos ecológicos. Aporta triglicéridos de cadena media (MCT) de rápida asimilación.",
      props: ["MCT de rápida absorción", "Ácido láurico", "Sin refinar"],
      chars: ["Prensado en frío", "Apto vegano", "Uso culinario y cosmético"],
    },
    {
      name: "Avena Integral Ecológica",
      cat: "cereales",
      price: 3.8,
      unit: "1 kg",
      short: "Copos de avena integrales de cultivo ecológico.",
      long: "Copos de avena integral provenientes de agricultura ecológica. Excelente fuente de carbohidratos complejos, fibra soluble (beta-glucanos) y proteína vegetal. Base perfecta para desayunos saludables.",
      props: ["Alta en beta-glucanos", "Rica en fibra", "Proteína vegetal", "Magnesio y hierro"],
      chars: ["Sin gluten añadido*", "Cultivo ecológico", "Tostado suave"],
    },
    {
      name: "Quinoa Real Blanca",
      cat: "cereales",
      price: 7.2,
      unit: "500 g",
      short: "Quinoa real del Altiplano, fuente completa de proteínas.",
      long: "Quinoa real blanca seleccionada del Altiplano andino. Contiene los nueve aminoácidos esenciales, por lo que es una proteína completa de origen vegetal, naturalmente sin gluten.",
      props: ["Proteína completa", "Sin gluten", "Rica en fibra", "Hierro y zinc"],
      chars: ["Lavada y lista para cocinar", "Origen Altiplano", "Apta vegana"],
    },
    {
      name: "Chía Ecológica",
      cat: "cereales",
      price: 6.5,
      unit: "300 g",
      short: "Semillas de chía ricas en omega-3 y fibra.",
      long: "Semillas de chía ecológicas de alta pureza. Una de las fuentes vegetales más ricas en ácido alfa-linolénico (omega-3), fibra y minerales como calcio y magnesio.",
      props: ["Omega-3 (ALA)", "Alta en fibra", "Calcio y magnesio", "Antioxidantes"],
      chars: ["Cultivo ecológico", "Forma gel al hidratarse", "Apta vegana"],
    },
    {
      name: "Semillas de Lino Dorado",
      cat: "cereales",
      price: 4.2,
      unit: "250 g",
      short: "Semillas de lino dorado, aliadas de la digestión.",
      long: "Semillas de lino dorado molidas al momento de envasar para conservar sus propiedades. Ricas en lignanos, fibra y omega-3.",
      props: ["Lignanos antioxidantes", "Fibra soluble", "Omega-3", "Reguladoras del tránsito"],
      chars: ["Molidas al envasar", "Sin gluten", "Apto vegano"],
    },
    {
      name: "Almendra Ecológica Tostada",
      cat: "frutos-secos",
      price: 8.9,
      unit: "200 g",
      short: "Almendras marcona ecológicas tostadas y sin sal.",
      long: "Almendras ecológicas tostadas suavemente y sin sal añadida. Ricas en vitamina E, magnesio y grasas saludables. Snack ideal para media mañana.",
      props: ["Vitamina E", "Magnesio", "Grasas monoinsaturadas", "Proteína vegetal"],
      chars: ["Tostado suave", "Sin sal", "Sin aceite añadido"],
    },
    {
      name: "Nueces de Macadamia Crudas",
      cat: "frutos-secos",
      price: 11.9,
      unit: "200 g",
      short: "Macadamias crudas con la mayor concentración de grasa monoinsaturada.",
      long: "Nueces de macadamia crudas sin tostar. Son el fruto seco con mayor contenido en grasas monoinsaturadas, especialmente beneficiosas para el sistema cardiovascular.",
      props: ["Grasas monoinsaturadas", "Tiamina (B1)", "Manganeso", "Sin colesterol"],
      chars: ["Crudas", "Sin sal", "Origen controlado"],
    },
    {
      name: "Cacao Puro en Polvo",
      cat: "frutos-secos",
      price: 7.8,
      unit: "250 g",
      short: "Cacao crudo 100% puro, sin azúcares añadidos.",
      long: "Cacao en polvo crudo desgrasado, 100% puro, sin azúcares añadidos. Una de las fuentes vegetales más ricas en antioxidantes (flavonoides), magnesio y hierro.",
      props: ["Flavonoides antioxidantes", "Magnesio", "Hierro", "Teobromina"],
      chars: ["100% puro", "Sin azúcar añadido", "Crudo (no alcalino)"],
    },
    {
      name: "Bayas de Goji Ecológicas",
      cat: "frutos-secos",
      price: 9.5,
      unit: "200 g",
      short: "Bayas de goji ricas en antioxidantes y zeaxantina.",
      long: "Bayas de goji ecológicas deshidratadas de forma natural. Destacan por su contenido en antioxidantes, vitamina C y zeaxantina, compuesto beneficioso para la salud visual.",
      props: ["Vitamina C", "Zeaxantina", "Polisacáridos", "Antioxidantes"],
      chars: ["Deshidratadas naturalmente", "Cultivo ecológico", "Sin conservantes"],
    },
    {
      name: "Cúrcuma Raíz Entera",
      cat: "hierbas",
      price: 5.6,
      unit: "100 g",
      short: "Raíz de cúrcuma entera con alto contenido en curcumina.",
      long: "Raíz de cúrcuma seleccionada con elevado contenido en curcumina, el principio activo responsable de sus propiedades antioxidantes y antiinflamatorias.",
      props: ["Curcumina", "Antiinflamatoria", "Antioxidante", "Digestiva"],
      chars: ["Raíz entera", "Origen controlado", "Sin aditivos"],
    },
    {
      name: "Jengibre Deshidratado en Polvo",
      cat: "hierbas",
      price: 4.9,
      unit: "150 g",
      short: "Jengibre en polvo picante y aromático.",
      long: "Jengibre en polvo procedente de raíz deshidratada y molida. Conocido por sus propiedades digestivas, antieméticas y su efecto cálido y picante.",
      props: ["Gingerol", "Digestivo", "Antiemético", "Efecto cálido"],
      chars: ["100% raíz de jengibre", "Sin azúcares", "Sin aditivos"],
    },
    {
      name: "Té Verde Matcha Ceremonial",
      cat: "infusiones",
      price: 14.9,
      unit: "30 g",
      short: "Matcha ceremonial en polvo de primera cosecha.",
      long: "Matcha ceremonial de primera cosecha, molido en molino de piedra. Rico en L-teanina y catequinas (EGCG), ofrece energía sostenida sin nerviosismo.",
      props: ["L-teanina", "Catequinas (EGCG)", "Antioxidantes", "Energía sostenida"],
      chars: ["Primera cosecha", "Molido en piedra", "Grado ceremonial"],
    },
    {
      name: "Infusión de Manzanilla con Anís",
      cat: "infusiones",
      price: 3.9,
      unit: "40 g",
      short: "Mezcla relajante de manzanilla y anís en hebras.",
      long: "Mezcla de flores de manzanilla y semillas de anís en hebras. Tradicionalmente utilizada como digestiva y relajante antes de dormir.",
      props: ["Digestiva", "Relajante", "Calmante natural"],
      chars: ["En hebras", "Sin aromas artificiales", "Mezcla artesanal"],
    },
    {
      name: "Rooibos de Sudáfrica",
      cat: "infusiones",
      price: 4.5,
      unit: "50 g",
      short: "Rooibos natural, dulce y sin teína.",
      long: "Rooibos natural originario de Sudáfrica. Infusión dulce y aromática sin teína, rica en flavonoides como el aspalathin y apta para toda la familia, incluso embarazadas.",
      props: ["Sin teína", "Flavonoides", "Minerales", "Apto para embarazadas"],
      chars: ["100% rooibos natural", "Sin teína", "Sin cafeína"],
    },
    {
      name: "Miel de Romero Artesanal",
      cat: "mieles",
      price: 8.2,
      unit: "400 g",
      short: "Miel monofloral de romero, cruda y sin pasteurizar.",
      long: "Miel cruda monofloral de romero, extraída en frío y sin pasteurizar. Conserva todas las enzimas y polen activos. Textura cremosa y aroma intenso.",
      props: ["Enzimas activas", "Polen natural", "Antioxidantes", "Aperitiva"],
      chars: ["Cruda y sin pasteurizar", "Monofloral", "Producción local"],
    },
    {
      name: "Sirop de Ágave Azul",
      cat: "mieles",
      price: 5.4,
      unit: "350 g",
      short: "Endulzante natural de bajo índice glucémico.",
      long: "Sirop de agave azul obtenido de la planta de agave tequilana. Endulzante natural con índice glucémico más bajo que el azúcar refinado.",
      props: ["Bajo índice glucémico", "Más dulce que el azúcar", "Minerales"],
      chars: ["100% agave azul", "Sin aditivos", "Apto vegano"],
    },
    {
      name: "Espirulina en Polvo Ecológica",
      cat: "suplementos",
      price: 15.5,
      unit: "200 g",
      short: "Microalga completa rica en proteínas y clorofila.",
      long: "Espirulina ecológica en polvo de cultivo controlado. Microalga con hasta un 60% de proteína completa, clorofila, hierro y vitaminas del grupo B.",
      props: ["Proteína ~60%", "Clorofila", "Hierro", "Vitaminas B"],
      chars: ["Cultivo controlado", "Ecológica", "Sin excipientes"],
    },
    {
      name: "Proteína Vegetal de Guisante",
      cat: "suplementos",
      price: 18.9,
      unit: "500 g",
      short: "Proteína aislada de guisante, sin sabor, fácil digestión.",
      long: "Proteína aislada de guisante al 80% de pureza, sin sabores añadidos. Proteína vegetal de fácil digestión con excelente perfil de aminoácidos, ideal para dietas veganas y deportistas.",
      props: ["80% proteína", "Aminoácidos esenciales", "Baja en carbohidratos", "Fácil digestión"],
      chars: ["Sin sabor añadido", "Sin gluten", "Apta vegana"],
    },
    {
      name: "Magnesio Bisglicinato",
      cat: "suplementos",
      price: 12.4,
      unit: "90 cápsulas",
      short: "Magnesio de alta absorción para músculo y descanso.",
      long: "Magnesio bisglicinato, forma de magnesio unida al aminoácido glicina que favorece una alta absorción y tolerancia digestiva. Contribuye a la función muscular, al sistema nervioso y al descanso.",
      props: ["Alta absorción", "Tolerancia digestiva", "Función muscular", "Descanso"],
      chars: ["Bisglicinato de magnesio", "90 cápsulas", "Sin gluten y sin lactosa"],
    },
    {
      name: "Complejo de Vitaminas B",
      cat: "suplementos",
      price: 10.9,
      unit: "60 cápsulas",
      short: "Complejo completo de las 8 vitaminas B esenciales.",
      long: "Fórmula que reúne las ocho vitaminas del grupo B, fundamentales para el metabolismo energético, el sistema nervioso y la reducción del cansancio y la fatiga.",
      props: ["Metabolismo energético", "Sistema nervioso", "Reduce el cansancio"],
      chars: ["8 vitaminas B", "60 cápsulas", "Formato vegano"],
    },
  ];

  const colors = [
    ["#6b8f71", "#dce8df"], ["#b08968", "#f0e4d8"], ["#7f9c5d", "#e3ecd4"],
    ["#8f9aa0", "#e6eaec"], ["#9b6b43", "#efe2d3"], ["#5c7d6a", "#dbe7dd"],
    ["#a58b5f", "#ece3d0"], ["#7d7a9b", "#e5e4ef"],
  ];

  products.forEach((p, i) => {
    const [bg, soft] = colors[i % colors.length];
    const svg = makeImage(p.name, bg, soft, p.cat);
    const catIdNum = catId(p.cat);
    insProd.run(
      p.name, catIdNum, p.price, p.unit, p.short, p.long, svg,
      JSON.stringify(p.props), JSON.stringify(p.chars),
      i % 3 === 0 ? 1 : 0
    );
  });
}

function makeImage(name, bg, soft, catSlug) {
  const letters = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  const catLabel = {
    aceites: "Aceite",
    cereales: "Cereales",
    "frutos-secos": "Fruto Seco",
    hierbas: "Hierbas",
    infusiones: "Infusión",
    mieles: "Endulzante",
    suplementos: "Suplemento",
  }[catSlug] || catSlug;
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
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  const file = path.join(__dirname, "public", "img", `${slug}.svg`);
  fs.writeFileSync(file, svg);
  return `/img/${slug}.svg`;
}

seed();

// ---------- API pública ----------
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/categories", (_req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
    GROUP BY c.id ORDER BY c.name
  `).all();
  res.json(rows);
});

app.get("/api/products", (req, res) => {
  const { category, search, featured } = req.query;
  let sql = `SELECT * FROM products WHERE active = 1`;
  const params = [];
  if (category) { sql += ` AND category_id = ?`; params.push(category); }
  if (search) { sql += ` AND (name LIKE ? OR short_desc LIKE ? OR long_desc LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (featured) { sql += ` AND featured = 1`; }
  sql += ` ORDER BY featured DESC, name`;
  const rows = db.prepare(sql).all(...params);
  for (const r of rows) {
    r.properties = JSON.parse(r.properties);
    r.characteristics = JSON.parse(r.characteristics);
  }
  res.json(rows);
});

app.get("/api/products/featured", (_req, res) => {
  const rows = db.prepare("SELECT * FROM products WHERE active = 1 AND featured = 1 LIMIT 6").all();
  for (const r of rows) { r.properties = JSON.parse(r.properties); r.characteristics = JSON.parse(r.characteristics); }
  res.json(rows);
});

app.get("/api/products/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Producto no encontrado" });
  row.properties = JSON.parse(row.properties);
  row.characteristics = JSON.parse(row.characteristics);
  res.json(row);
});

// ---------- API admin ----------
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== "admin") return res.status(401).json({ error: "Credenciales incorrectas" });
  const salt = db.prepare("SELECT value FROM settings WHERE key = 'password_salt'").get()?.value || "admin";
  const stored = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get()?.value;
  if (hashPassword(password, salt) !== stored) return res.status(401).json({ error: "Credenciales incorrectas" });
  res.json({ token: createToken("admin") });
});

app.post("/api/admin/logout", (_req, res) => res.json({ ok: true }));

app.get("/api/admin/products", requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC, id DESC").all();
  for (const r of rows) { r.properties = JSON.parse(r.properties); r.characteristics = JSON.parse(r.characteristics); }
  res.json(rows);
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const p = req.body || {};
  const required = ["name", "category_id", "price", "short_desc", "long_desc"];
  for (const k of required) {
    if (p[k] === undefined || p[k] === null || p[k] === "") {
      return res.status(400).json({ error: `Falta el campo ${k}` });
    }
  }
  const result = db.prepare(`
    INSERT INTO products (name, category_id, price, unit, short_desc, long_desc, image, properties, characteristics, featured, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.name, Number(p.category_id), Number(p.price), p.unit || "", p.short_desc, p.long_desc,
    p.image || "", JSON.stringify(p.properties || []), JSON.stringify(p.characteristics || []),
    p.featured ? 1 : 0, p.active === undefined || p.active ? 1 : 0
  );
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const p = req.body || {};
  db.prepare(`
    UPDATE products SET
      name = ?, category_id = ?, price = ?, unit = ?, short_desc = ?, long_desc = ?,
      image = ?, properties = ?, characteristics = ?, featured = ?, active = ?
    WHERE id = ?
  `).run(
    p.name, Number(p.category_id), Number(p.price), p.unit || "", p.short_desc, p.long_desc,
    p.image || "", JSON.stringify(p.properties || []), JSON.stringify(p.characteristics || []),
    p.featured ? 1 : 0, p.active === undefined || p.active ? 1 : 0,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: "name y slug son obligatorios" });
  db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run(name, slug);
  res.status(201).json({ ok: true });
});

app.get("/api/admin/settings", requireAdmin, (_req, res) => {
  res.json({
    categories: db.prepare("SELECT * FROM categories ORDER BY name").all(),
  });
});

// Inicialización de la contraseña del admin (por defecto admin/admin)
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
if (!db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get()) {
  const salt = crypto.randomBytes(16).toString("hex");
  const pass = process.env.ADMIN_PASSWORD || "admin";
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('password_salt', ?)").run(salt);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', ?)").run(hashPassword(pass, salt));
  console.log(`[admin] Credenciales iniciales: admin / ${pass}. Cámbialas con ADMIN_PASSWORD.`);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tienda de Nutrición corriendo en http://localhost:${PORT}`);
});
