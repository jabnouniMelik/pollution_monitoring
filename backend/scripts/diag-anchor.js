require("dotenv").config();
const connectDB = require("../config/db");
const aiService = require("../services/AIService");

const zoneId = "6a01bef39fe149f4a7f8ac46";

(async () => {
  await connectDB();
  const fb = await aiService._findBestAnchorEnd(zoneId, 48, 4);
  console.log("fallback anchor:", fb);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
