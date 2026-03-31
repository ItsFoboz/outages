// Local development entry point.
// On Vercel, api/server.js is used instead.
import "dotenv/config";
import app from "./app.js";
import { initDb } from "./db.js";
import { runAllScrapers } from "./scheduler.js";

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`[server] BG Аварии backend listening on port ${PORT}`);
  await initDb();
  runAllScrapers().catch((e) =>
    console.error("[server] Initial scrape error:", e)
  );
});
