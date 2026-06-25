require("dotenv").config();
const connectDB = require("../config/db");
require("../models/Site");
const Reading = require("../models/Reading");
const AggregateData = require("../models/AggregateData");
const SensorNode = require("../models/SensorNode");
const Sensor = require("../models/Sensor");
const aiService = require("../services/AIService");

const zoneId = process.argv[2] || "6a01bef39fe149f4a7f8ac46";

(async () => {
  await connectDB();
  const nodes = await SensorNode.find({ zoneId }).select("_id").lean();
  const nodeIds = nodes.map((n) => n._id);
  const sensorIds = await Sensor.find({ sensorNodeId: { $in: nodeIds } })
    .distinct("_id")
    .lean();

  const oldest = await Reading.findOne({ sensorId: { $in: sensorIds } })
    .sort({ timestamp: 1 })
    .select("timestamp")
    .lean();
  const newest = await Reading.findOne({ sensorId: { $in: sensorIds } })
    .sort({ timestamp: -1 })
    .select("timestamp")
    .lean();

  const end = new Date();
  end.setMinutes(0, 0, 0);
  const start = new Date(end);
  start.setHours(start.getHours() - 48);

  const aggsInWindow = await AggregateData.countDocuments({
    zoneId,
    period: "HOURLY",
    polluantId: { $ne: null },
    periodStart: { $gte: start, $lte: end },
  });
  const distinctHours = await AggregateData.distinct("periodStart", {
    zoneId,
    period: "HOURLY",
    polluantId: { $ne: null },
    periodStart: { $gte: start, $lte: end },
  });

  console.log("Zone", zoneId);
  console.log("Readings:", oldest?.timestamp, "→", newest?.timestamp);
  console.log("48h window:", start.toISOString(), "→", end.toISOString());
  console.log("Aggregates in window:", aggsInWindow, "distinct hours:", distinctHours.length);

  const { siteId } = await aiService._resolveZoneContext(zoneId);
  console.log("\nSync 48h...");
  await aiService.syncHourlyAggregatesForSite(siteId, end, 48);

  const afterHours = await AggregateData.distinct("periodStart", {
    zoneId,
    period: "HOURLY",
    polluantId: { $ne: null },
    periodStart: { $gte: start, $lte: end },
  });
  console.log("After sync distinct hours:", afterHours.length);

  const m = await aiService.buildLookbackMatrix(zoneId, end, 48);
  console.log("LSTM filled hours:", m.coverage.filledHours, "/ 48");

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
