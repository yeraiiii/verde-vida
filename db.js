import Database from "better-sqlite3";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Selección del motor: Postgres si hay DATABASE_URL, si no SQLite local.
const USE_POSTGRES = !!process.env.DATABASE_URL;

const DEFAULT_DATA_DIR = process.env.PROJECT_DOMAIN
  ? path.join(process.cwd(), ".data")
  : path.join(__dirname, "data");
const DATA_DIR = process.env.DATA_DIR || process.env.PWD_DIR || DEFAULT_DATA_DIR;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let sqlite = null;
let pool = null;

if (USE_POSTGRES) {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
} else {
  sqlite = new Database(path.join(DATA_DIR, "tienda.db"));
  sqlite.pragma("journal_mode = WAL");
}

// Convierte marcadores "?" de SQLite a "$1,$2..." de Postgres.
function toPostgres(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  engine: USE_POSTGRES ? "postgres" : "sqlite",

  async all(sql, params = []) {
    if (USE_POSTGRES) {
      const res = await pool.query(toPostgres(sql), params);
      return res.rows;
    }
    return sqlite.prepare(sql).all(...params);
  },

  async get(sql, params = []) {
    if (USE_POSTGRES) {
      const res = await pool.query(toPostgres(sql), params);
      return res.rows[0];
    }
    return sqlite.prepare(sql).get(...params);
  },

  async run(sql, params = []) {
    if (USE_POSTGRES) {
      const res = await pool.query(toPostgres(sql), params);
      return { lastInsertRowid: null, changes: res.rowCount };
    }
    const res = sqlite.prepare(sql).run(...params);
    return { lastInsertRowid: res.lastInsertRowid, changes: res.changes };
  },

  // Inserta y devuelve el id generado (compatible SQLite/Postgres)
  async insert(sql, params = []) {
    if (USE_POSTGRES) {
      const res = await pool.query(toPostgres(sql) + " RETURNING id", params);
      return Number(res.rows[0].id);
    }
    const res = sqlite.prepare(sql).run(...params);
    return Number(res.lastInsertRowid);
  },

  async exec(sql) {
    if (USE_POSTGRES) {
      await pool.query(sql);
    } else {
      sqlite.exec(sql);
    }
  },

  async close() {
    if (pool) await pool.end();
    if (sqlite) sqlite.close();
  },
};

export default db;
