// Vercel serverless entry point.
// Vercel rewrites /api/* → this handler.
// Note: node-cron does NOT run here — use the Vercel Cron job configured in
// vercel.json which calls POST /api/refresh on schedule.

import app from "../server/app.js";

export default app;
