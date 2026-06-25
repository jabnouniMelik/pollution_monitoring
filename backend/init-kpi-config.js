/**
 * INIT : KPI SITE CONFIG
 * Crée ou met à jour la configuration active (airflow, poids IPE, objectifs KPI).
 *
 * Usage : npm run init:kpi
 */

require("dotenv").config();
const mongoose = require("mongoose");
const SiteConfig = require("./models/SiteConfig");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/pollution_db";

async function initKpiConfig() {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connecté à MongoDB");

  const existing = await SiteConfig.findOne({ isActive: true });
  if (existing) {
    console.log("✓ Configuration KPI active déjà présente:", existing.siteName);
    await mongoose.disconnect();
    return;
  }

  await SiteConfig.updateMany({}, { isActive: false });

  const config = await SiteConfig.create({
    siteName: "Cimenterie de Gabès",
    airflow: 3.5,
    baselineCo2: 650,
    expectedSampleIntervalSeconds: 30,
    polluantWeights: {
      NOx: 0.3,
      SO2: 0.25,
      PM25: 0.15,
      PM10: 0.1,
      COV: 0.15,
      CO2: 0.05,
    },
    targets: {
      tauxDepassement: 2.0,
      ipe: 95,
      reductionCO2: -5.0,
      EMJ: null,
    },
    location: { type: "Point", coordinates: [10.0982, 33.8815] },
    isActive: true,
  });

  console.log("✓ SiteConfig créée:", config.siteName);
  console.log("  airflow:", config.airflow, "Nm³/s");
  console.log("  baseline CO₂:", config.baselineCo2, "ppm");
  await mongoose.disconnect();
}

initKpiConfig().catch((err) => {
  console.error(err);
  process.exit(1);
});
