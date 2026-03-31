import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./db.js";
import { runAllScrapers } from "./scheduler.js";

const app = express();

app.use(express.json());
app.use(
  cors({
    // In production (Vercel) allow all origins since frontend + backend share
    // the same domain. In dev allow the Vite port.
    origin: process.env.VERCEL
      ? true
      : [
          "http://localhost:5173",
          "http://localhost:4173",
          process.env.FRONTEND_URL,
        ].filter(Boolean),
  })
);

// GET /api/outages
// Query params: type, region, status (default active+planned)
app.get("/api/outages", (req, res) => {
  const { type, region, status } = req.query;

  let query = `
    SELECT id, provider, type, region, city, neighborhoods,
           description, start_time, end_time, status, source_url,
           scraped_at, lat, lng, geocoded
    FROM outages
    WHERE 1=1
  `;
  const params = [];

  if (type && type !== "all") {
    query += " AND type = ?";
    params.push(type);
  }

  if (region && region !== "all") {
    query += " AND (region LIKE ? OR city LIKE ?)";
    params.push(`%${region}%`, `%${region}%`);
  }

  if (status) {
    const statuses = status.split(",");
    query += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  } else {
    query += " AND status IN ('active','planned')";
  }

  query += " ORDER BY scraped_at DESC, start_time DESC LIMIT 500";

  try {
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error("[api] /api/outages error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/outages/summary
app.get("/api/outages/summary", (req, res) => {
  try {
    const byType = db
      .prepare(
        `SELECT type, COUNT(*) as count FROM outages
         WHERE status IN ('active','planned')
         GROUP BY type`
      )
      .all();

    const byRegion = db
      .prepare(
        `SELECT region, COUNT(*) as count FROM outages
         WHERE status IN ('active','planned')
         GROUP BY region
         ORDER BY count DESC
         LIMIT 20`
      )
      .all();

    const total = db
      .prepare(
        "SELECT COUNT(*) as count FROM outages WHERE status IN ('active','planned')"
      )
      .get();

    res.json({ byType, byRegion, total: total.count });
  } catch (err) {
    console.error("[api] /api/outages/summary error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/outages/map — geocoded outages only
app.get("/api/outages/map", (req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, provider, type, region, city, neighborhoods,
                description, start_time, end_time, status, lat, lng
         FROM outages
         WHERE geocoded = 1
           AND status IN ('active','planned')
         ORDER BY scraped_at DESC`
      )
      .all();
    res.json(rows);
  } catch (err) {
    console.error("[api] /api/outages/map error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/scrape-log — last 50 events
app.get("/api/scrape-log", (req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT * FROM scrape_log
         ORDER BY scraped_at DESC
         LIMIT 50`
      )
      .all();
    res.json(rows);
  } catch (err) {
    console.error("[api] /api/scrape-log error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/refresh — trigger scrape cycle
// On Vercel this is also the Vercel Cron target (replaces node-cron).
app.post("/api/refresh", async (req, res) => {
  try {
    res.json({ message: "Scrape cycle started" });
    runAllScrapers().catch((e) =>
      console.error("[api] Manual refresh error:", e)
    );
  } catch (err) {
    console.error("[api] /api/refresh error:", err);
    res.status(500).json({ error: "Failed to start scrape" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

export default app;
