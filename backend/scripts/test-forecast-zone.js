require("dotenv").config();
const connectDB = require("../config/db");
require("../models/Site");
require("../models/Industrie");
const aiService = require("../services/AIService");

const zoneId = process.argv[2] || "6a01bef39fe149f4a7f8ac46";

(async () => {
  await connectDB();
  if (process.env.IA_SKIP_IF !== "1") {
    try {
      await aiService.runAnomalyDetectionForZone(zoneId);
      console.log("IF OK");
    } catch (e) {
      console.log("IF skip/error:", e.message);
    }
  }
  const doc = await aiService.runForecastForZone(zoneId);
  console.log(
    "LSTM OK — anchor",
    doc.anchorPeriodStart,
    "steps",
    doc.steps?.length,
  );
  process.exit(0);
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
