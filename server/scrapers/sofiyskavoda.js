/**
 * Sofiyska Voda scraper
 * Covers: Sofia city
 * URL: https://www.sofiyskavoda.bg/water-stops
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BG-Outages-Monitor/1.0; +https://github.com/bg-avarii)";
const TIMEOUT_MS = 15000;
const SOURCE_URL = "https://www.sofiyskavoda.bg/water-stops";

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

  // Sofiyska Voda page typically has list items or paragraphs describing water stops
  // Try various selectors
  const selectors = [
    ".water-stop",
    ".stop-item",
    ".outage-item",
    ".news-item",
    ".field-items .field-item",
    "article",
    ".view-content .views-row",
    "ul.outages li",
  ];

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      elements.each((i, el) => {
        const text = $(el).text().trim();
        if (!text || text.length < 15) return;

        // Extract date/time if present
        const dateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        const timeRange = text.match(
          /(\d{1,2}[:.]\d{2})\s*[-–до]\s*(\d{1,2}[:.]\d{2})/
        );

        let startTime = null;
        let endTime = null;
        if (dateMatch) {
          let year = dateMatch[3];
          if (year.length === 2) year = "20" + year;
          const dateStr = `${year}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
          if (timeRange) {
            const from = timeRange[1].replace(".", ":").padStart(5, "0");
            const to = timeRange[2].replace(".", ":").padStart(5, "0");
            startTime = `${dateStr}T${from}:00`;
            endTime = `${dateStr}T${to}:00`;
          } else {
            startTime = `${dateStr}T00:00:00`;
          }
        }

        // Extract neighborhood info — look for кв., ул., etc.
        const areaMatch = text.match(
          /(?:кв\.|жк\.?|ул\.|бул\.)[^\n\r]{3,80}/i
        );

        results.push({
          provider: "Sofiyska Voda",
          type: "water",
          region: "София",
          city: "София",
          neighborhoods: areaMatch ? areaMatch[0].trim() : text.substring(0, 200),
          description: text.substring(0, 500),
          start_time: startTime,
          end_time: endTime,
          status: startTime ? "planned" : "active",
          source_url: SOURCE_URL,
        });
      });

      if (results.length > 0) break;
    }
  }

  // Last resort: grab all paragraphs that mention water stops
  if (results.length === 0) {
    $("p, li").each((i, el) => {
      const text = $(el).text().trim();
      if (
        text.length > 20 &&
        (text.includes("вода") ||
          text.includes("спиране") ||
          text.includes("водоснабдяване"))
      ) {
        results.push({
          provider: "Sofiyska Voda",
          type: "water",
          region: "София",
          city: "София",
          neighborhoods: text.substring(0, 200),
          description: text.substring(0, 500),
          start_time: null,
          end_time: null,
          status: "active",
          source_url: SOURCE_URL,
        });
      }
    });
  }

  return results;
}

export default async function scrapeSofiyskavoda() {
  try {
    const html = await fetchPage(SOURCE_URL);
    const results = parsePage(html);
    console.log(`[sofiyskavoda] Found ${results.length} outages`);
    return results;
  } catch (err) {
    console.error("[sofiyskavoda] Scrape failed:", err.message);
    return [];
  }
}
