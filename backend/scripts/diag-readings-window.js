require("dotenv").config();
const connectDB = require("../config/db");
const Reading = require("../models/Reading");
const SensorNode = require("../models/SensorNode");

const zoneId = "6a01bef39fe149f4a7f8ac46";

(async () => {
  await connectDB();
  const nodeId = (await SensorNode.findOne({ zoneId }).select("_id").lean())?._id;

  const withNode = await Reading.countDocuments({ nodeId: { $exists: true, $ne: null } });
  const withoutNode = await Reading.countDocuments({
    $or: [{ nodeId: null }, { nodeId: { $exists: false } }],
  });
  const forNode = await Reading.countDocuments({ nodeId });

  console.log("Readings with nodeId:", withNode, "without:", withoutNode, "for zone node:", forNode);

  const end = new Date();
  end.setMinutes(0, 0, 0);
  const start = new Date(end);
  start.setHours(start.getHours() - 48);

  const inWindow = await Reading.countDocuments({
    nodeId,
    timestamp: { $gte: start, $lt: end },
    isValid: true,
  });
  console.log("Zone node readings in 48h (excl current hour):", inWindow);

  const oldestForNode = await Reading.findOne({ nodeId })
    .sort({ timestamp: 1 })
    .select("timestamp")
    .lean();
  const newestForNode = await Reading.findOne({ nodeId })
    .sort({ timestamp: -1 })
    .select("timestamp")
    .lean();
  console.log("Node reading range:", oldestForNode?.timestamp, "→", newestForNode?.timestamp);

  // Hourly distribution last 6 hours
  for (let h = 1; h <= 6; h++) {
    const ps = new Date(end);
    ps.setHours(ps.getHours() - h);
    const pe = new Date(ps);
    pe.setHours(pe.getHours() + 1);
    const cnt = await Reading.countDocuments({
      nodeId,
      timestamp: { $gte: ps, $lt: pe },
      isValid: true,
    });
    if (cnt > 0) console.log(`  h-${h}: ${cnt}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
