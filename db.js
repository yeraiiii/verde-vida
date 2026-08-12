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

  // Ejecuta fn con un runner de consultas dentro de una transacción atómica.
  // En Postgres usa una conexión dedicada + advisory lock (serializa siembras
  // concurrentes entre instancias); en SQLite usa BEGIN EXCLUSIVE.
  async tx(fn) {
    if (USE_POSTGRES) {
      const client = await pool.connect();
      const runner = {
        all: async (sql, params = []) => (await client.query(toPostgres(sql), params)).rows,
        get: async (sql, params = []) => (await client.query(toPostgres(sql), params)).rows[0],
        run: async (sql, params = []) => {
          await client.query(toPostgres(sql), params);
        },
        insert: async (sql, params = []) =>
          Number((await client.query(toPostgres(sql) + " RETURNING id", params)).rows[0].id),
      };
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(845120001)");
        const out = await fn(runner);
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    sqlite.exec("BEGIN EXCLUSIVE");
    const runner = {
      all: (sql, params = []) => sqlite.prepare(sql).all(...params),
      get: (sql, params = []) => sqlite.prepare(sql).get(...params),
      run: (sql, params = []) => {
        sqlite.prepare(sql).run(...params);
      },
      insert: (sql, params = []) => Number(sqlite.prepare(sql).run(...params).lastInsertRowid),
    };
    try {
      const out = await fn(runner);
      sqlite.exec("COMMIT");
      return out;
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  },

  async close() {
    if (pool) await pool.end();
    if (sqlite) sqlite.close();
  },
};

export default db;
