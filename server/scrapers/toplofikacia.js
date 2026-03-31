/**
 * Toplofikacia Sofia scraper
 * Covers: Sofia city heating network
 * URLs:
 *   https://toplo.bg/accidents-and-maintenance  (planned maintenance)
 *   https://toplo.bg/breakdowns                  (emergency breakdowns)
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BG-Outages-Monitor/1.0; +https://github.com/bg-avarii)";
const TIMEOUT_MS = 15000;

const URLS = [
  { url: "https://toplo.bg/accidents-and-maintenance", status: "planned" },
  { url: "https://toplo.bg/breakdowns", status: "active" },
];

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

function parsePage(html, sourceUrl, defaultStatus) {
  const $ = cheerio.load(html);
  const results = [];

  // Toplofikacia typically uses structured announcement blocks or tables
  const blockSelectors = [
    ".accident-item",
    ".maintenance-item",
    ".breakdown-item",
    ".news-item",
    "article",
    ".entry",
    "tr",
    ".content-block",
  ];

  for (const selector of blockSelectors) {
    const elements = $(selector);
    if (elements.length === 0) continue;

    elements.each((i, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 15) return;

      // Skip pure header rows
      if (
        text.toLowerCase().includes("дата") &&
        text.toLowerCase().includes("адрес") &&
        text.length < 60
      )
        return;

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

      // Extract street / neighborhood
      const streetMatch = text.match(
        /(?:ул\.|бул\.|кв\.|жк\.?|пл\.)[^\n\r]{3,100}/i
      );
      const addressMatch = text.match(
        /(?:адрес|район|квартал)\s*[:\s]+([^\n\r]{5,100})/i
      );

      const neighborhoods =
        streetMatch?.[0]?.trim() ||
        addressMatch?.[1]?.trim() ||
        text.substring(0, 200);

      results.push({
        provider: "Toplofikacia Sofia",
        type: "heating",
        region: "София",
        city: "София",
        neighborhoods: neighborhoods,
        description: text.substring(0, 500),
        start_time: startTime,
        end_time: endTime,
        status: defaultStatus,
        source_url: sourceUrl,
      });
    });

    if (results.length > 0) break;
  }

  return results;
}

export default async function scrapeToplofikacia() {
  const allResults = [];

  for (const { url, status } of URLS) {
    try {
      const html = await fetchPage(url);
      const results = parsePage(html, url, status);
      allResults.push(...results);
      console.log(`[toplofikacia] ${url}: ${results.length} records`);
    } catch (err) {
      console.error(`[toplofikacia] Failed for ${url}:`, err.message);
    }

    // Small delay between the two URLs
    await new Promise((r) => setTimeout(r, 1000));
  }

  return allResults;
}
