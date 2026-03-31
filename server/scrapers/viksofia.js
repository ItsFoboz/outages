/**
 * ViK Sofia Oblast scraper
 * Covers: Sofia region (surrounding municipalities)
 * URL: https://viksofbg.com/avarii/
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BG-Outages-Monitor/1.0; +https://github.com/bg-avarii)";
const TIMEOUT_MS = 15000;
const SOURCE_URL = "https://viksofbg.com/avarii/";

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

  // ViK Sofia uses a WordPress-like structure
  const articleSelectors = [
    "article",
    ".post",
    ".entry",
    ".avaria",
    ".news-item",
    ".blog-post",
    ".content-item",
  ];

  for (const selector of articleSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      elements.each((i, el) => {
        const title = $(el).find("h1, h2, h3, .title, .entry-title").first().text().trim();
        const body = $(el).find("p, .content, .entry-content").first().text().trim();
        const text = title ? `${title}\n${body}` : body;

        if (!text || text.length < 10) return;

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

        // Extract municipality from title or body
        const communeMatch = text.match(/(?:с\.|гр\.|село|град)\s+([А-ЯЙа-яй][а-яй\s]{2,30})/i);
        const city = communeMatch ? communeMatch[0].trim() : null;

        results.push({
          provider: "ViK Sofia Oblast",
          type: "water",
          region: "София Област",
          city: city,
          neighborhoods: title || text.substring(0, 200),
          description: text.substring(0, 500),
          start_time: startTime,
          end_time: endTime,
          status: "active",
          source_url: SOURCE_URL,
        });
      });

      if (results.length > 0) break;
    }
  }

  // Fallback: any paragraphs with outage keywords
  if (results.length === 0) {
    $("p, li, td").each((i, el) => {
      const text = $(el).text().trim();
      if (
        text.length > 20 &&
        (text.includes("авария") ||
          text.includes("спиране") ||
          text.includes("водоснабдяване") ||
          text.includes("вода"))
      ) {
        results.push({
          provider: "ViK Sofia Oblast",
          type: "water",
          region: "София Област",
          city: null,
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

export default async function scrapeVikSofia() {
  try {
    const html = await fetchPage(SOURCE_URL);
    const results = parsePage(html);
    console.log(`[viksofia] Found ${results.length} outages`);
    return results;
  } catch (err) {
    console.error("[viksofia] Scrape failed:", err.message);
    return [];
  }
}
