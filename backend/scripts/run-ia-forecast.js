/**
 * Déclenche IF + LSTM pour toutes les zones (hors scheduler).
 * Usage: node scripts/run-ia-forecast.js [zoneId]
 * Env: IA_SKIP_IF=1 pour LSTM seul
 */
require("dotenv").config();
const connectDB = require("../config/db");
const aiService = require("../services/AIService");

(async () => {
  await connectDB();
  const zoneId = process.argv[2];

  if (zoneId) {
    if (process.env.IA_SKIP_IF !== "1") {
      const ifDoc = await aiService.runAnomalyDetectionForZone(zoneId);
      console.log("IF:", JSON.stringify(ifDoc, null, 2));
    }
    const doc = await aiService.runForecastForZone(zoneId);
    console.log("LSTM:", JSON.stringify(doc, null, 2));
  } else {
    if (process.env.IA_SKIP_IF !== "1") {
      const ifResult = await aiService.runAnomalyDetectionForAllZones();
      console.log("IF:", JSON.stringify(ifResult, null, 2));
    }
    const result = await aiService.runForecastsForAllZones();
    console.log("LSTM:", JSON.stringify(result, null, 2));
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
