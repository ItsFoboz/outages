/**
 * Energo-Pro North scraper
 * Covers: Varna, Dobrich, Veliko Tarnovo, Gabrovo, Ruse, Razgrad, Targovishte, Shumen
 * URL: https://www.erpsever.bg/bg/prekysvaniya
 *
 * NOTE: This page uses JavaScript rendering. Cheerio will only get static HTML.
 * If the result is empty, the scheduler will fall back to avarii.bg for these regions.
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BG-Outages-Monitor/1.0; +https://github.com/bg-avarii)";
const TIMEOUT_MS = 15000;
const SOURCE_URL = "https://www.erpsever.bg/bg/prekysvaniya";

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

/**
 * Try to extract JSON data embedded in the page (SPA pattern).
 */
function extractEmbeddedJson(html) {
  // Look for JSON data in script tags
  const scriptMatch = html.match(
    /window\.__(?:NUXT|DATA|INITIAL_STATE)__\s*=\s*({[\s\S]+?})\s*;?\s*<\/script>/
  );
  if (scriptMatch) {
    try {
      return JSON.parse(scriptMatch[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function parsePage(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Try embedded JSON first
  const json = extractEmbeddedJson(html);
  if (json) {
    // Flatten any outage arrays found
    const flat = JSON.stringify(json);
    if (flat.includes("прекъсване") || flat.includes("авария")) {
      // Best-effort: can't parse unknown schema, fall through to HTML
    }
  }

  // Try table rows
  $("table tr").each((i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const colTexts = cells.toArray().map((c) => $(c).text().trim());
    if (
      colTexts[0].toLowerCase().includes("дата") ||
      colTexts[0].toLowerCase().includes("регион")
    )
      return;

    const fullText = colTexts.join(" | ");
    if (fullText.length < 10) return;

    const dateMatch = fullText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    const timeRange = fullText.match(
      /(\d{1,2}[:.]\d{2})\s*[-–до]\s*(\d{1,2}[:.]\d{2})/
    );

    let startTime = null;
    let endTime = null;
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
      provider: "Energo-Pro North",
      type: "electricity",
      region: colTexts[0] || "Североизточна България",
      city: colTexts[1] || null,
      neighborhoods: colTexts[2] || null,
      description: colTexts[colTexts.length - 1] || "Планово прекъсване",
      start_time: startTime,
      end_time: endTime,
      status: "planned",
      source_url: SOURCE_URL,
    });
  });

  // Fallback: content blocks
  if (results.length === 0) {
    $(".outage, .prekusvane, .schedule-item, .content p").each((i, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 15) return;

      results.push({
        provider: "Energo-Pro North",
        type: "electricity",
        region: "Североизточна България",
        city: null,
        neighborhoods: text.substring(0, 300),
        description: text.substring(0, 500),
        start_time: null,
        end_time: null,
        status: "planned",
        source_url: SOURCE_URL,
      });
    });
  }

  return results;
}

export default async function scrapeEnergoPro() {
  try {
    const html = await fetchPage(SOURCE_URL);
    const results = parsePage(html);
    console.log(`[energopro] Found ${results.length} outages`);
    return results;
  } catch (err) {
    console.error("[energopro] Scrape failed:", err.message);
    return [];
  }
}
