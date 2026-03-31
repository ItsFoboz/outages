import { createClient } from "@libsql/client";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// On Vercel only /tmp is writable. DB is ephemeral (wiped on cold-start);
// POST /api/refresh re-populates it (call manually or via Vercel Cron on Pro).
const DB_URL = process.env.VERCEL
  ? "file:/tmp/outages.db"
  : `file:${join(__dirname, "..", "outages.db")}`;

const db = createClient({ url: DB_URL });

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS outages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    type TEXT NOT NULL,
    region TEXT NOT NULL,
    city TEXT,
    neighborhoods TEXT,
    description TEXT,
    start_time TEXT,
    end_time TEXT,
    status TEXT DEFAULT 'active',
    source_url TEXT,
    scraped_at TEXT DEFAULT (datetime('now')),
    raw_html TEXT,
    lat REAL,
    lng REAL,
    geocoded INTEGER DEFAULT 0,
    geocode_query TEXT
  );
  CREATE TABLE IF NOT EXISTS scrape_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    status TEXT,
    error_message TEXT,
    scraped_at TEXT DEFAULT (datetime('now')),
    record_count INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_outages_type ON outages(type);
  CREATE INDEX IF NOT EXISTS idx_outages_region ON outages(region);
  CREATE INDEX IF NOT EXISTS idx_outages_status ON outages(status);
  CREATE INDEX IF NOT EXISTS idx_outages_geocoded ON outages(geocoded);
  CREATE INDEX IF NOT EXISTS idx_scrape_log_source ON scrape_log(source);
`;

// Lazily-resolved initialization promise — safe with Vercel bundler.
// No top-level await; caller uses `await initDb()` before first query.
let _initPromise = null;

export async function initDb() {
  if (!_initPromise) {
    _initPromise = db.executeMultiple(SCHEMA);
  }
  return _initPromise;
}

export default db;
