import "dotenv/config";
import express from "express";
import cors from "cors";
import db, { initDb } from "./db.js";
import { runAllScrapers } from "./scheduler.js";

const app = express();

// ── Readiness gate ────────────────────────────────────────────────────────────
// On Vercel every cold-start produces an empty /tmp SQLite DB.
// We block ALL requests until the DB schema exists AND (if the DB is empty)
// a full scrape has completed. maxDuration is 60 s in vercel.json, which is
// enough for one scrape cycle.
let _readiness = null;

function getReadiness() {
  if (!_readiness) {
    _readiness = (async () => {
      await initDb();
      const { rows } = await db.execute(
        "SELECT COUNT(*) as count FROM outages"
      );
      if (Number(rows[0].count) === 0) {
        console.log("[app] DB empty — running initial scrape…");
        await runAllScrapers();
        console.log("[app] Initial scrape complete.");
      }
    })().catch((err) => {
      // Reset so the next request retries
      _readiness = null;
      throw err;
    });
  }
  return _readiness;
}

app.use((req, _res, next) => {
  getReadiness().then(() => next()).catch(next);
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(
  cors({
    origin: process.env.VERCEL
      ? true
      : [
          "http://localhost:5173",
          "http://localhost:4173",
          process.env.FRONTEND_URL,
        ].filter(Boolean),
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/outages
app.get("/api/outages", async (req, res) => {
  const { type, region, status } = req.query;

  let sql = `
    SELECT id, provider, type, region, city, neighborhoods,
           description, start_time, end_time, status, source_url,
           scraped_at, lat, lng, geocoded
    FROM outages
    WHERE 1=1
  `;
  const args = [];

  if (type && type !== "all") {
    sql += " AND type = ?";
    args.push(type);
  }

  if (region && region !== "all") {
    sql += " AND (region LIKE ? OR city LIKE ?)";
    args.push(`%${region}%`, `%${region}%`);
  }

  if (status) {
    const statuses = status.split(",");
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    args.push(...statuses);
  } else {
    sql += " AND status IN ('active','planned')";
  }

  sql += " ORDER BY scraped_at DESC, start_time DESC LIMIT 500";

  try {
    const { rows } = await db.execute({ sql, args });
    res.json(rows);
  } catch (err) {
    console.error("[api] /api/outages error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/outages/summary
app.get("/api/outages/summary", async (req, res) => {
  try {
    const [byTypeResult, byRegionResult, totalResult] = await Promise.all([
      db.execute(
        `SELECT type, COUNT(*) as count FROM outages
         WHERE status IN ('active','planned')
         GROUP BY type`
      ),
      db.execute(
        `SELECT region, COUNT(*) as count FROM outages
         WHERE status IN ('active','planned')
         GROUP BY region
         ORDER BY count DESC
         LIMIT 20`
      ),
      db.execute(
        "SELECT COUNT(*) as count FROM outages WHERE status IN ('active','planned')"
      ),
    ]);

    res.json({
      byType: byTypeResult.rows,
      byRegion: byRegionResult.rows,
      total: Number(totalResult.rows[0]?.count ?? 0),
    });
  } catch (err) {
    console.error("[api] /api/outages/summary error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/outages/map — geocoded outages only
app.get("/api/outages/map", async (req, res) => {
  try {
    const { rows } = await db.execute(
      `SELECT id, provider, type, region, city, neighborhoods,
              description, start_time, end_time, status, lat, lng
       FROM outages
       WHERE geocoded = 1
         AND status IN ('active','planned')
       ORDER BY scraped_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("[api] /api/outages/map error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/scrape-log
app.get("/api/scrape-log", async (req, res) => {
  try {
    const { rows } = await db.execute(
      `SELECT * FROM scrape_log ORDER BY scraped_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error("[api] /api/scrape-log error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/refresh — synchronous scrape (awaited before responding).
// On Vercel serverless, fire-and-forget is killed when the response is sent,
// so we must await the full cycle here. maxDuration: 60 s covers this.
app.post("/api/refresh", async (req, res) => {
  try {
    await runAllScrapers();
    res.json({ message: "Scrape cycle complete" });
  } catch (err) {
    console.error("[api] /api/refresh error:", err);
    res.status(500).json({ error: "Scrape failed", detail: err.message });
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

export default app;
