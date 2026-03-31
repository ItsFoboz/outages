/**
 * Avarii.bg aggregator scraper — primary source and fallback
 * URL pattern: https://www.avarii.bg/{region}
 *              https://www.avarii.bg/vik/{region}
 *              https://www.avarii.bg/eon/{region}
 *
 * This is a SvelteKit app — look for JSON in <script> tags and also parse HTML cards.
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BG-Outages-Monitor/1.0; +https://github.com/bg-avarii)";
const TIMEOUT_MS = 15000;

// Regions to scrape and their Bulgarian names
const REGIONS = [
  { slug: "sofia", name: "София", city: "София" },
  { slug: "plovdiv", name: "Пловдив", city: "Пловдив" },
  { slug: "varna", name: "Варна", city: "Варна" },
  { slug: "burgas", name: "Бургас", city: "Бургас" },
  { slug: "stara-zagora", name: "Стара Загора", city: "Стара Загора" },
  { slug: "haskovo", name: "Хасково", city: "Хасково" },
  { slug: "yambol", name: "Ямбол", city: "Ямбол" },
  { slug: "sliven", name: "Сливен", city: "Сливен" },
  { slug: "ruse", name: "Русе", city: "Русе" },
  { slug: "blagoevgrad", name: "Благоевград", city: "Благоевград" },
  { slug: "montana", name: "Монтана", city: "Монтана" },
  { slug: "vidin", name: "Видин", city: "Видин" },
  { slug: "vratsa", name: "Враца", city: "Враца" },
  { slug: "lovech", name: "Ловеч", city: "Ловеч" },
  { slug: "pleven", name: "Плевен", city: "Плевен" },
  { slug: "pernik", name: "Перник", city: "Перник" },
  { slug: "kyustendil", name: "Кюстендил", city: "Кюстендил" },
  { slug: "vt", name: "Велико Търново", city: "Велико Търново" },
  { slug: "gabrovo", name: "Габрово", city: "Габрово" },
  { slug: "razgrad", name: "Разград", city: "Разград" },
  { slug: "shumen", name: "Шумен", city: "Шумен" },
  { slug: "dobrich", name: "Добрич", city: "Добрич" },
];

// Type prefixes to scrape per region
const TYPE_PATHS = [
  { path: "", type: "electricity" },
  { path: "vik/", type: "water" },
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

/**
 * Try to extract JSON data embedded by SvelteKit in the page.
 */
function extractSvelteData(html) {
  const results = [];

  // SvelteKit embeds data in <script type="application/json"> or as JS variables
  const jsonMatches = html.matchAll(
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const match of jsonMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data)) results.push(...data);
      else if (data && typeof data === "object") results.push(data);
    } catch {
      // ignore
    }
  }

  return results;
}

/**
 * Parse HTML from avarii.bg page.
 * The site renders outage cards and a table.
 */
function parseAvariiPage(html, region, regionName, city, outageType) {
  const $ = cheerio.load(html);
  const results = [];
  const sourceUrl = `https://www.avarii.bg/${outageType === "water" ? "vik/" : ""}${region}`;

  // Look for outage cards — avarii.bg uses div/article based cards
  const cardSelectors = [
    ".avaria",
    ".outage-card",
    ".card",
    ".outage",
    ".prekusvane",
    "article",
    ".item",
    ".row-item",
  ];

  const tableRows = $("table tr");
  if (tableRows.length > 1) {
    tableRows.each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      const texts = cells.toArray().map((c) => $(c).text().trim());
      const fullText = texts.join(" | ");

      if (!fullText || fullText.length < 10) return;
      // skip header
      if (texts[0].toLowerCase().includes("зона") && i === 0) return;

      const dateMatch = fullText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
      const timeRange = fullText.match(
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

      // First cell is typically zone, last is provider
      const zones = texts[0];
      const description = texts[1] || texts[0];
      const provider = texts[texts.length - 1];

      const isPlanned =
        fullText.toLowerCase().includes("планира") ||
        fullText.toLowerCase().includes("planir");

      // Determine provider from the text if possible
      let detectedProvider = "Avarii.bg";
      if (provider.length < 60 && !provider.match(/\d{2}\.\d{2}/)) {
        detectedProvider = provider;
      }

      results.push({
        provider: detectedProvider,
        type: outageType,
        region: regionName,
        city: city,
        neighborhoods: zones,
        description: description,
        start_time: startTime,
        end_time: endTime,
        status: isPlanned ? "planned" : "active",
        source_url: sourceUrl,
      });
    });
  }

  if (results.length > 0) return results;

  // Card-based fallback
  for (const selector of cardSelectors) {
    const els = $(selector);
    if (els.length === 0) continue;

    els.each((i, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 15) return;

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
        }
      }

      const isPlanned =
        text.toLowerCase().includes("планира") ||
        text.toLowerCase().includes("ремонт");

      results.push({
        provider: "Avarii.bg",
        type: outageType,
        region: regionName,
        city: city,
        neighborhoods: text.substring(0, 300),
        description: text.substring(0, 500),
        start_time: startTime,
        end_time: endTime,
        status: isPlanned ? "planned" : "active",
        source_url: sourceUrl,
      });
    });

    if (results.length > 0) break;
  }

  return results;
}

export default async function scrapeAvarii() {
  const allResults = [];

  for (const region of REGIONS) {
    for (const typePath of TYPE_PATHS) {
      const url = `https://www.avarii.bg/${typePath.path}${region.slug}`;
      try {
        const html = await fetchPage(url);
        const results = parseAvariiPage(
          html,
          region.slug,
          region.name,
          region.city,
          typePath.type
        );
        allResults.push(...results);

        if (results.length > 0) {
          console.log(
            `[avarii] ${url}: ${results.length} ${typePath.type} outages`
          );
        }
      } catch (err) {
        // Silently skip non-existent region/type combos
        if (!err.message.includes("HTTP 404")) {
          console.error(`[avarii] Failed for ${url}:`, err.message);
        }
      }

      // Polite delay between requests
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`[avarii] Total: ${allResults.length} outages across all regions`);
  return allResults;
}
