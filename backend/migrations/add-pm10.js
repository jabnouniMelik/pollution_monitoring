/**
 * MIGRATION : Add PM10 pollutant + sensors on existing nodes
 *
 * - Creates Polluant PM10 if missing
 * - Adds PM10 Sensor (SDS011) on each node that already has PM25
 * - Updates SiteConfig weights (PM25 0.15, PM10 0.10)
 * - Patches active ThresholdConfig with PM10 limits
 *
 * Usage: node migrations/add-pm10.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

const PM10_POLLUTANT = {
  code: "PM10",
  name: "PM10",
  formula: "PM₁₀",
  unit: "µg/m³",
  regulatoryLimit: 48,
  warningThreshold: 38,
  weight: 0.10,
};

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB\n");

  const Polluant = require("../models/Polluant");
  const Sensor = require("../models/Sensor");
  const SensorNode = require("../models/SensorNode");
  const SiteConfig = require("../models/SiteConfig");
  const ThresholdConfig = require("../models/ThresholdConfig");
  const Zone = require("../models/Zone");

  // ── 1. Polluant PM10 ───────────────────────────────────────
  console.log("── Step 1: Polluant PM10 ──");
  let pm10 = await Polluant.findOne({ code: "PM10" });
  if (!pm10) {
    pm10 = await Polluant.create(PM10_POLLUTANT);
    console.log("  ✓ Created PM10 pollutant");
  } else {
    await Polluant.updateOne(
      { _id: pm10._id },
      {
        $set: {
          regulatoryLimit: PM10_POLLUTANT.regulatoryLimit,
          warningThreshold: PM10_POLLUTANT.warningThreshold,
          unit: PM10_POLLUTANT.unit,
          weight: PM10_POLLUTANT.weight,
        },
      },
    );
    console.log("  ✓ Updated existing PM10 pollutant");
  }

  const pm25 = await Polluant.findOne({ code: "PM25" });
  if (pm25) {
    await Polluant.updateOne(
      { _id: pm25._id },
      { $set: { weight: 0.15, unit: "µg/m³" } },
    );
    console.log("  ✓ PM25 weight set to 0.15");
  }

  // ── 2. Sensors PM10 per node ───────────────────────────────
  console.log("\n── Step 2: PM10 sensors ──");
  const pm25Sensors = await Sensor.find({ type: "PM25", isActive: true }).lean();
  let created = 0;
  let skipped = 0;

  for (const ref of pm25Sensors) {
    const exists = await Sensor.findOne({
      sensorNodeId: ref.sensorNodeId,
      type: "PM10",
    });
    if (exists) {
      skipped++;
      continue;
    }
    await Sensor.create({
      sensorNodeId: ref.sensorNodeId,
      PolluantId: pm10._id,
      type: "PM10",
      model: "SDS011",
      unit: "µg/m³",
      calibrationDate: ref.calibrationDate ?? new Date(),
      isActive: true,
    });
    created++;
  }
  console.log(`  ✓ ${created} PM10 sensor(s) created, ${skipped} already present`);

  // ── 3. SiteConfig weights ───────────────────────────────────
  console.log("\n── Step 3: SiteConfig weights ──");
  const siteConfig = await SiteConfig.findOne({ isActive: true });
  if (siteConfig) {
    const w = siteConfig.polluantWeights || {};
    const next = {
      NOx: w.NOx ?? 0.30,
      SO2: w.SO2 ?? 0.25,
      PM25: 0.15,
      PM10: w.PM10 ?? 0.10,
      COV: w.COV ?? 0.15,
      CO2: w.CO2 ?? 0.05,
    };
    siteConfig.polluantWeights = next;
    await siteConfig.save();
    console.log("  ✓ Weights updated:", next);
  } else {
    console.log("  ⏭  No active SiteConfig");
  }

  // ── 4. ThresholdConfig PM10 ─────────────────────────────────
  console.log("\n── Step 4: ThresholdConfig PM10 ──");
  const threshold = await ThresholdConfig.findOne({ actif: true });
  if (threshold) {
    threshold.polluants = threshold.polluants || {};
    threshold.polluants.PM10 = {
      min: 0,
      max: 48,
      warning: 38,
      critical: 58,
      unit: "µg/m³",
      reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)",
    };
    if (threshold.polluants.PM25) {
      threshold.polluants.PM25.unit = "µg/m³";
    }
    threshold.markModified("polluants");
    await threshold.save();
    console.log("  ✓ PM10 thresholds added to active ThresholdConfig");
  } else {
    console.log("  ⏭  No active ThresholdConfig");
  }

  // ── 5. Zone pollutants list ─────────────────────────────────
  console.log("\n── Step 5: Zone pollutants ──");
  const zones = await Zone.find({ actif: { $ne: false } });
  let zonePatched = 0;
  for (const zone of zones) {
    const list = new Set(zone.pollutants ?? []);
    const before = list.size;
    if (list.has("PM")) {
      list.add("PM25");
      list.add("PM10");
    }
    if (list.has("PM25") || list.has("PM")) list.add("PM10");
    if (list.size > before) {
      zone.pollutants = [...list];
      await zone.save();
      zonePatched++;
    }
  }
  console.log(`  ✓ ${zonePatched} zone(s) updated with PM10`);

  const nodeCount = await SensorNode.countDocuments();
  console.log(`\n── Summary: ${nodeCount} node(s), PM10 PolluantId=${pm10._id}`);

  await mongoose.disconnect();
  console.log("\n✓ Done. Re-seed readings or run simulator for PM10 data.");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
