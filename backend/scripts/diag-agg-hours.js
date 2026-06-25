require("dotenv").config();
const connectDB = require("../config/db");
const Reading = require("../models/Reading");
const AggregateData = require("../models/AggregateData");
const SensorNode = require("../models/SensorNode");
const aggregationService = require("../services/AggregationService");
const Zone = require("../models/Zone");

const zoneId = "6a01bef39fe149f4a7f8ac46";

(async () => {
  await connectDB();
  const zone = await Zone.findById(zoneId).lean();
  const nodes = await SensorNode.find({ zoneId }).select("_id").lean();
  const nodeId = nodes[0]?._id;

  const end = new Date();
  end.setMinutes(0, 0, 0);

  for (const h of [1, 2, 12, 24]) {
    const ps = new Date(end);
    ps.setHours(ps.getHours() - h);
    const pe = new Date(ps);
    pe.setHours(pe.getHours() + 1);
    const cnt = await Reading.countDocuments({
      nodeId,
      timestamp: { $gte: ps, $lt: pe },
      isValid: true,
    });
    console.log(`h-${h}: readings=${cnt} ${ps.toISOString()}`);
    if (cnt > 0) {
      const r = await aggregationService.aggregateAllPolluantsForZone(
        "HOURLY",
        ps,
        pe,
        zoneId,
        zone.siteId.toString(),
      );
      console.log(`  -> agg created: ${r.length}`);
    }
  }

  const start = new Date(end);
  start.setHours(start.getHours() - 48);
  const hours = await AggregateData.distinct("periodStart", {
    zoneId,
    period: "HOURLY",
    polluantId: { $ne: null },
    periodStart: { $gte: start, $lte: end },
  });
  console.log("\nDistinct agg hours in 48h after test:", hours.length);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
