/**
 * EVN / ER Yug scraper
 * Covers: Plovdiv, Burgas, Stara Zagora, Sliven, Yambol, Kardzhali, Haskovo, Pazardzhik, Smolyan
 * URL: https://www.eryd.bg/bg/prekysvaniya
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BG-Outages-Monitor/1.0; +https://github.com/bg-avarii)";
const TIMEOUT_MS = 15000;
const SOURCE_URL = "https://www.eryd.bg/bg/prekysvaniya";

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "bg,en;q=0.9",
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

function parsePage(html) {
  const $ = cheerio.load(html);
  const results = [];

  // EVN page typically has a table or list of outage items
  // Try table rows first
  $("table tr").each((i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const colTexts = cells.toArray().map((c) => $(c).text().trim());

    // Skip header rows
    if (colTexts[0].toLowerCase().includes("регион") ||
        colTexts[0].toLowerCase().includes("дата")) return;

    const region = colTexts[0] || "";
    const neighborhoods = colTexts[1] || colTexts[2] || "";
    const description = colTexts[colTexts.length - 1] || "";

    if (!region && !neighborhoods) return;

    // Try to parse time from description or dedicated column
    let startTime = null;
    let endTime = null;
    const fullText = colTexts.join(" ");
    const dateMatch = fullText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    const timeRange = fullText.match(/(\d{1,2}[:.]\d{2})\s*[-–до]\s*(\d{1,2}[:.]\d{2})/);

    if (dateMatch && timeRange) {
      let year = dateMatch[3];
      if (year.length === 2) year = "20" + year;
      const dateStr = `${year}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
      const from = timeRange[1].replace(".", ":").padStart(5, "0");
      const to = timeRange[2].replace(".", ":").padStart(5, "0");
      startTime = `${dateStr}T${from}:00`;
      endTime = `${dateStr}T${to}:00`;
    }

    results.push({
      provider: "EVN / ER Yug",
      type: "electricity",
      region: region,
      city: null,
      neighborhoods: neighborhoods,
      description: description,
      start_time: startTime,
      end_time: endTime,
      status: "planned",
      source_url: SOURCE_URL,
    });
  });

  if (results.length > 0) return results;

  // Fallback: look for content blocks / cards
  $(".outage, .prekusvane, .article-body p, .content-block, .announcement").each(
    (i, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 15) return;

      // Try to extract region from text
      const regionMatch = text.match(/(?:Регион|регион|Oblast|област)[:\s]+([А-ЯЙа-яй\s]+)/i);
      const region = regionMatch ? regionMatch[1].trim() : "Южна България";

      results.push({
        provider: "EVN / ER Yug",
        type: "electricity",
        region: region,
        city: null,
        neighborhoods: text.substring(0, 300),
        description: text.substring(0, 500),
        start_time: null,
        end_time: null,
        status: "planned",
        source_url: SOURCE_URL,
      });
    }
  );

  return results;
}

export default async function scrapeEvn() {
  try {
    const html = await fetchPage(SOURCE_URL);
    const results = parsePage(html);
    console.log(`[evn] Found ${results.length} outages`);
    return results;
  } catch (err) {
    console.error("[evn] Scrape failed:", err.message);
    return [];
  }
}
