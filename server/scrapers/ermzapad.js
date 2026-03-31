/**
 * ERM Zapad / Electrohold scraper
 * Covers: Sofia, Blagoevgrad, Kyustendil, Pernik, Pleven, Lovech, Montana, Vratsa, Vidin
 *
 * Primary: info.ermzapad.bg/webint/vok/avplan.php — HTML table of planned outages
 * Secondary: ermzapad.bg/bg/za-klienta/prekusvania/
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BG-Outages-Monitor/1.0; +https://github.com/bg-avarii)";
const TIMEOUT_MS = 15000;

const PRIMARY_URL = "https://info.ermzapad.bg/webint/vok/avplan.php";
const SECONDARY_URL = "https://ermzapad.bg/bg/za-klienta/prekusvania/";

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "bg,en;q=0.9",
        "Accept-Charset": "utf-8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Parse the avplan.php table.
 * Typical columns: Дата | От | До | Регион | Населено място | Квартал/улица | Причина
 */
function parseAvplanTable(html) {
  const $ = cheerio.load(html);
  const results = [];

  $("table tr").each((i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return; // skip header or empty rows

    const colTexts = cells.toArray().map((c) => $(c).text().trim());

    // Try to detect which columns are which by index
    // Common layout: 0=date, 1=from_time, 2=to_time, 3=region, 4=city, 5=neighborhoods, 6=reason
    let date = colTexts[0] || "";
    let fromTime = colTexts[1] || "";
    let toTime = colTexts[2] || "";
    let region = colTexts[3] || "";
    let city = colTexts[4] || "";
    let neighborhoods = colTexts[5] || "";
    let reason = colTexts[6] || colTexts[5] || "";

    // Skip rows that look like headers
    if (
      date.toLowerCase().includes("дата") ||
      date.toLowerCase().includes("от") ||
      fromTime.toLowerCase().includes("дата")
    ) {
      return;
    }

    // Normalise date — Bulgarian format: dd.mm.yyyy or dd.mm.yy
    let startTime = null;
    let endTime = null;
    const dateMatch = date.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (dateMatch) {
      let year = dateMatch[3];
      if (year.length === 2) year = "20" + year;
      const dateStr = `${year}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;

      const fromMatch = fromTime.match(/(\d{1,2})[:\.](\d{2})/);
      const toMatch = toTime.match(/(\d{1,2})[:\.](\d{2})/);

      if (fromMatch) {
        startTime = `${dateStr}T${fromMatch[1].padStart(2, "0")}:${fromMatch[2]}:00`;
      }
      if (toMatch) {
        endTime = `${dateStr}T${toMatch[1].padStart(2, "0")}:${toMatch[2]}:00`;
      }
    }

    if (!region && !city && !neighborhoods) return;

    results.push({
      provider: "ERM Zapad",
      type: "electricity",
      region: region || "неизвестен",
      city: city || null,
      neighborhoods: neighborhoods || null,
      description: reason || "Планов ремонт",
      start_time: startTime,
      end_time: endTime,
      status: "planned",
      source_url: PRIMARY_URL,
    });
  });

  return results;
}

/**
 * Parse the secondary ERM Zapad page — announcement blocks.
 */
function parseSecondaryPage(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Look for announcement cards / list items
  $(".outage-item, .prekusvane-item, article, .news-item, .entry").each(
    (i, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 10) return;

      results.push({
        provider: "ERM Zapad",
        type: "electricity",
        region: "София",
        city: null,
        neighborhoods: text.substring(0, 300),
        description: text.substring(0, 500),
        start_time: null,
        end_time: null,
        status: "planned",
        source_url: SECONDARY_URL,
      });
    }
  );

  return results;
}

export default async function scrapeErmZapad() {
  try {
    // Try primary source first
    const html = await fetchPage(PRIMARY_URL);
    const results = parseAvplanTable(html);

    if (results.length > 0) {
      console.log(`[ermzapad] Found ${results.length} planned outages`);
      return results;
    }

    // If primary returns nothing, try secondary
    console.log("[ermzapad] Primary returned 0, trying secondary…");
    const html2 = await fetchPage(SECONDARY_URL);
    const results2 = parseSecondaryPage(html2);
    console.log(`[ermzapad] Secondary found ${results2.length} records`);
    return results2;
  } catch (err) {
    console.error("[ermzapad] Scrape failed:", err.message);
    return [];
  }
}
