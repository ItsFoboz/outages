// Local development entry point.
// On Vercel, api/server.js is used instead.
import "dotenv/config";
import app from "./app.js";
import { runAllScrapers } from "./scheduler.js";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[server] BG Аварии backend listening on port ${PORT}`);
  // Run scrapers immediately on local startup
  runAllScrapers().catch((e) =>
    console.error("[server] Initial scrape error:", e)
  );
});
