import cron from "node-cron";
import db from "./db.js";
import { geocodePending } from "./geocoder.js";

// Import all scrapers
import scrapeErmZapad from "./scrapers/ermzapad.js";
import scrapeEvn from "./scrapers/evn.js";
import scrapeEnergoPro from "./scrapers/energopro.js";
import scrapeSofiyskavoda from "./scrapers/sofiyskavoda.js";
import scrapeVikSofia from "./scrapers/viksofia.js";
import scrapeToplofikacia from "./scrapers/toplofikacia.js";
import scrapeAvarii from "./scrapers/avarii.js";

const SCRAPERS = [
  { name: "ERM Zapad", fn: scrapeErmZapad },
  { name: "EVN / ER Yug", fn: scrapeEvn },
  { name: "Energo-Pro North", fn: scrapeEnergoPro },
  { name: "Sofiyska Voda", fn: scrapeSofiyskavoda },
  { name: "ViK Sofia Oblast", fn: scrapeVikSofia },
  { name: "Toplofikacia Sofia", fn: scrapeToplofikacia },
  { name: "Avarii.bg", fn: scrapeAvarii },
];

const DELAY_MS = 2500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Upsert an outage record. Deduplication key: provider + start_time + neighborhoods.
 * If exists → update scraped_at and status only.
 * If new → insert.
 */
async function upsertOutage(outage) {
  const { rows } = await db.execute({
    sql: `SELECT id FROM outages
          WHERE provider = ?
            AND start_time = ?
            AND neighborhoods = ?
          LIMIT 1`,
    args: [outage.provider, outage.start_time || "", outage.neighborhoods || ""],
  });

  if (rows.length > 0) {
    await db.execute({
      sql: `UPDATE outages
            SET scraped_at = datetime('now'), status = ?
            WHERE id = ?`,
      args: [outage.status || "active", rows[0].id],
    });
    return "updated";
  } else {
    await db.execute({
      sql: `INSERT INTO outages
              (provider, type, region, city, neighborhoods, description,
               start_time, end_time, status, source_url, raw_html)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        outage.provider,
        outage.type,
        outage.region,
        outage.city || null,
        outage.neighborhoods || null,
        outage.description || null,
        outage.start_time || null,
        outage.end_time || null,
        outage.status || "active",
        outage.source_url || null,
        outage.raw_html || null,
      ],
    });
    return "inserted";
  }
}

async function logScrape(source, status, errorMessage, recordCount) {
  await db.execute({
    sql: `INSERT INTO scrape_log (source, status, error_message, record_count)
          VALUES (?, ?, ?, ?)`,
    args: [source, status, errorMessage || null, recordCount || 0],
  });
}

export async function runAllScrapers() {
  console.log(`[scheduler] Starting scrape cycle at ${new Date().toISOString()}`);

  for (const scraper of SCRAPERS) {
    console.log(`[scheduler] Running ${scraper.name}…`);
    try {
      const outages = await scraper.fn();
      let inserted = 0;
      let updated = 0;

      for (const outage of outages) {
        const result = await upsertOutage(outage);
        if (result === "inserted") inserted++;
        else updated++;
      }

      await logScrape(scraper.name, "ok", null, outages.length);
      console.log(
        `[scheduler] ${scraper.name}: ${outages.length} records (${inserted} new, ${updated} updated)`
      );
    } catch (err) {
      console.error(`[scheduler] ${scraper.name} failed:`, err.message);
      await logScrape(scraper.name, "error", err.message, 0);
    }

    await sleep(DELAY_MS + Math.random() * 1000);
  }

  await geocodePending();

  console.log(`[scheduler] Scrape cycle complete at ${new Date().toISOString()}`);
}

// On Vercel there is no persistent process, so node-cron never fires.
// Instead, vercel.json configures a Vercel Cron job that calls
// POST /api/refresh every 30 minutes.
if (!process.env.VERCEL) {
  cron.schedule("*/30 * * * *", () => {
    runAllScrapers().catch((e) => console.error("[cron] Error:", e));
  });
  console.log("[scheduler] Cron job scheduled (every 30 minutes)");
}
