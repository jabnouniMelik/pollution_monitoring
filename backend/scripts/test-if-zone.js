/**
 * Test rapide IF pour une zone : node scripts/test-if-zone.js [zoneId]
 */
require("dotenv").config();
const connectDB = require("../config/db");
const AIService = require("../services/AIService");

const zoneId = process.argv[2] || "6a01bef39fe149f4a7f8ac48";

(async () => {
  await connectDB();
  try {
    const doc = await AIService.runAnomalyDetectionForZone(zoneId);
    console.log("OK", {
      zoneId,
      periodStart: doc?.periodStart,
      isAnomaly: doc?.isAnomaly,
      score: doc?.anomalyScore,
    });
  } catch (err) {
    console.error("FAIL", err.message);
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
})();
