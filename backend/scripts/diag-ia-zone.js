require("dotenv").config();
const connectDB = require("../config/db");
const AggregateData = require("../models/AggregateData");
const Zone = require("../models/Zone");
const Reading = require("../models/Reading");
const SensorNode = require("../models/SensorNode");
const aiService = require("../services/AIService");

const zoneIdArg = process.argv[2];

(async () => {
  await connectDB();
  const zones = zoneIdArg
    ? [await Zone.findById(zoneIdArg).lean()].filter(Boolean)
    : await Zone.find({ actif: true }).limit(5).lean();

  console.log("Total readings:", await Reading.countDocuments({}));

  for (const z of zones) {
    const zid = z._id.toString();
    const nodes = await SensorNode.find({ zoneId: z._id }).lean();
    const aggCount = await AggregateData.countDocuments({
      zoneId: z._id,
      period: "HOURLY",
      sensorNodeId: null,
      polluantId: { $ne: null },
    });
    const recent = await AggregateData.find({
      zoneId: z._id,
      period: "HOURLY",
      polluantId: { $ne: null },
    })
      .sort({ periodStart: -1 })
      .limit(5)
      .populate("polluantId", "name")
      .lean();

    console.log("\n--- Zone", z.nom || zid, "---");
    console.log("  nodes:", nodes.length);
    console.log("  hourly pollutant aggs:", aggCount);
    for (const r of recent) {
      console.log(
        "  ",
        r.periodStart?.toISOString(),
        r.polluantId?.name,
        r.avgValue?.toFixed?.(2),
      );
    }

    try {
      const end = new Date();
      end.setMinutes(0, 0, 0);
      const ifv = await aiService.buildIfFeatureVector(zid, end);
      console.log(
        "  IF vector:",
        ifv.filledFeatures,
        "/",
        require("../config/ia").IA_CONFIG.ifMinFeatures,
        "complete:",
        ifv.complete,
      );
    } catch (e) {
      console.log("  IF build error:", e.message);
    }
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
