import { Client } from "@googlemaps/google-maps-services-js";
import db from "./db.js";

const client = new Client({});

const CITY_MAP = {
  sofia: "София",
  plovdiv: "Пловдив",
  varna: "Варна",
  burgas: "Бургас",
  "stara-zagora": "Стара Загора",
  haskovo: "Хасково",
  sliven: "Сливен",
  yambol: "Ямбол",
  ruse: "Русе",
  blagoevgrad: "Благоевград",
  montana: "Монтана",
  vidin: "Видин",
  vratsa: "Враца",
  lovech: "Ловеч",
  pleven: "Плевен",
  pernik: "Перник",
  kyustendil: "Кюстендил",
  vt: "Велико Търново",
  "veliko-tarnovo": "Велико Търново",
  gabrovo: "Габрово",
  razgrad: "Разград",
  targovishte: "Търговище",
  shumen: "Шумен",
  dobrich: "Добрич",
  kardzhali: "Кърджали",
  smolyan: "Смолян",
  pazardzhik: "Пазарджик",
};

/**
 * Build the best possible geocoding query from a raw Bulgarian zone string.
 */
export function buildGeocodeQuery(zoneText, region) {
  if (!zoneText) return null;

  let cleaned = zoneText
    .replace(/зона\s+(на\s+)?спиране\s*[:–\-]?\s*/gi, "")
    .replace(/зона\s+за\s+спиране\s*[:–\-]?\s*/gi, "")
    .replace(/авария\s+в\s+община\s*/gi, "")
    .replace(/авария\s+в\s+/gi, "")
    .replace(/планирано\s+спиране.*$/gi, "")
    .replace(/аварийно\s+спиране.*$/gi, "")
    .replace(/ремонт.*$/gi, "")
    .trim();

  // Extract first meaningful location token
  let firstLocation = cleaned.split(",")[0].trim();

  // If it contains specific location markers, prioritise those
  const kvMatch = cleaned.match(/(кв\.|жк\.?|ул\.|бул\.)[^,;]+/i);
  if (kvMatch) {
    firstLocation = kvMatch[0].trim();
  }

  // If it mentions a municipality
  const opshtina = cleaned.match(/община\s+([А-ЯЙа-яй\s]+)/i);
  if (opshtina) {
    firstLocation = `Община ${opshtina[1].trim()}`;
    const city = CITY_MAP[region] || "";
    return city
      ? `${firstLocation}, ${city} област, България`
      : `${firstLocation}, България`;
  }

  // If it mentions a city (гр.)
  const grMatch = cleaned.match(/гр\.\s*([А-ЯЙа-яй\s]+)/i);
  if (grMatch) {
    return `${grMatch[1].trim()}, България`;
  }

  const city = CITY_MAP[region] || region;
  if (!firstLocation || firstLocation.length < 3) return null;

  return `${firstLocation}, ${city}, България`;
}

/**
 * Geocode all outages that haven't been geocoded yet.
 * Skips if no API key configured.
 */
export async function geocodePending() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.log("[geocoder] No GOOGLE_MAPS_API_KEY set — skipping geocoding");
    return;
  }

  const pending = db
    .prepare(
      "SELECT id, neighborhoods, description, region FROM outages WHERE geocoded = 0"
    )
    .all();

  if (pending.length === 0) return;
  console.log(`[geocoder] Geocoding ${pending.length} pending outages…`);

  for (const row of pending) {
    const query = buildGeocodeQuery(
      row.neighborhoods || row.description || "",
      row.region
    );

    if (!query) {
      db.prepare("UPDATE outages SET geocoded=2, geocode_query=? WHERE id=?").run(
        "no-query-built",
        row.id
      );
      continue;
    }

    try {
      const response = await client.geocode({
        params: {
          address: query,
          key: apiKey,
          language: "bg",
          region: "BG",
        },
        timeout: 5000,
      });

      if (response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry.location;
        db.prepare(
          "UPDATE outages SET lat=?, lng=?, geocoded=1, geocode_query=? WHERE id=?"
        ).run(lat, lng, query, row.id);
      } else {
        db.prepare(
          "UPDATE outages SET geocoded=2, geocode_query=? WHERE id=?"
        ).run(query, row.id);
      }
    } catch (err) {
      console.error(`[geocoder] Failed for id=${row.id}: ${err.message}`);
      db.prepare("UPDATE outages SET geocoded=2 WHERE id=?").run(row.id);
    }

    // Polite delay to stay within rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("[geocoder] Done");
}
