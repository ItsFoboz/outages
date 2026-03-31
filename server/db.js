import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "outages.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
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
`);

export default db;
