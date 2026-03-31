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

const DELAY_MS = 2500; // 2.5 seconds between scrapers

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Upsert an outage record. Deduplication key: provider + start_time + neighborhoods.
 * If exists → update scraped_at and status only.
 * If new → insert.
 */
function upsertOutage(outage) {
  const existing = db
    .prepare(
      `SELECT id FROM outages
       WHERE provider = ?
         AND start_time = ?
         AND neighborhoods = ?
       LIMIT 1`
    )
    .get(outage.provider, outage.start_time || "", outage.neighborhoods || "");

  if (existing) {
    db.prepare(
      `UPDATE outages
       SET scraped_at = datetime('now'), status = ?
       WHERE id = ?`
    ).run(outage.status || "active", existing.id);
    return "updated";
  } else {
    db.prepare(
      `INSERT INTO outages
         (provider, type, region, city, neighborhoods, description,
          start_time, end_time, status, source_url, raw_html)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
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
      outage.raw_html || null
    );
    return "inserted";
  }
}

function logScrape(source, status, errorMessage, recordCount) {
  db.prepare(
    `INSERT INTO scrape_log (source, status, error_message, record_count)
     VALUES (?, ?, ?, ?)`
  ).run(source, status, errorMessage || null, recordCount || 0);
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
        const result = upsertOutage(outage);
        if (result === "inserted") inserted++;
        else updated++;
      }

      logScrape(scraper.name, "ok", null, outages.length);
      console.log(
        `[scheduler] ${scraper.name}: ${outages.length} records (${inserted} new, ${updated} updated)`
      );
    } catch (err) {
      console.error(`[scheduler] ${scraper.name} failed:`, err.message);
      logScrape(scraper.name, "error", err.message, 0);
    }

    // Polite delay between scrapers
    await sleep(DELAY_MS + Math.random() * 1000);
  }

  // Geocode any new outages
  await geocodePending();

  console.log(`[scheduler] Scrape cycle complete at ${new Date().toISOString()}`);
}

// Schedule: every 30 minutes
cron.schedule("*/30 * * * *", () => {
  runAllScrapers().catch((e) => console.error("[cron] Error:", e));
});

console.log("[scheduler] Cron job scheduled (every 30 minutes)");
