/**
 * MIGRATION : Update Polluant regulatory limits
 *
 * Updates regulatoryLimit and warningThreshold on existing Polluant documents
 * to match Décret 2018-928, Annexe 1 (valeurs générales — toutes sources fixes).
 *
 * Also clears all open (unresolved) alerts so stale alerts based on old
 * thresholds don't persist in the UI.
 *
 * Usage: node migrations/update-polluant-limits.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) { console.error("❌ MONGO_URI not set"); process.exit(1); }

// New limits — Décret 2018-928, Annexe 1 (valeurs générales)
// Applicables à toutes sources fixes industrielles tunisiennes.
// Pour un déploiement sectoriel spécifique (ex. cimenteries → Annexe 6),
// surcharger ces seuils via ThresholdConfig dans MongoDB.
const NEW_LIMITS = [
  // CO2 : pas de VLE réglementaire — seuil interne suivi KPI
  { code: "CO2",  regulatoryLimit: 800,  warningThreshold: 640,  unit: "ppm"    },
  // NOx : 500 mg/Nm³ — Annexe 1, §4 (flux > 25 kg/h)
  { code: "NOX",  regulatoryLimit: 500,  warningThreshold: 400,  unit: "mg/Nm³" },
  // SO2 : 300 mg/Nm³ — Annexe 1, §3 (flux > 25 kg/h)
  { code: "SO2",  regulatoryLimit: 300,  warningThreshold: 240,  unit: "mg/Nm³" },
  // PM25 : 40 mg/m³ — Annexe 1, §1 (flux > 1 kg/h)
  { code: "PM25", regulatoryLimit: 40,   warningThreshold: 32,   unit: "µg/m³"  },
  // PM10 : même base réglementaire poussières
  { code: "PM10", regulatoryLimit: 48,   warningThreshold: 38,   unit: "µg/m³"  },
  // COV : 110 mg/Nm³ — Annexe 1, §7 (flux > 2 kg/h, carbone total)
  { code: "COV",  regulatoryLimit: 110,  warningThreshold: 88,   unit: "mg/Nm³" },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB\n");

  const Polluant = require("../models/Polluant");
  const Alert    = require("../models/Alert");

  // ── 1. Update polluant limits ──────────────────────────────
  console.log("── Step 1: Updating Polluant limits ──");
  for (const p of NEW_LIMITS) {
    const result = await Polluant.updateOne(
      { code: p.code },
      { $set: { regulatoryLimit: p.regulatoryLimit, warningThreshold: p.warningThreshold, unit: p.unit } },
    );
    if (result.matchedCount === 0) {
      console.warn(`  ⚠️  Polluant not found: ${p.code}`);
    } else {
      console.log(`  ✓ ${p.code}: regulatoryLimit=${p.regulatoryLimit} ${p.unit}, warningThreshold=${p.warningThreshold}`);
    }
  }

  // ── 2. Clear stale open alerts ─────────────────────────────
  // Alerts created with old thresholds (e.g. COV seuil=30) are now invalid.
  // Resolve them automatically so the UI starts clean.
  console.log("\n── Step 2: Resolving stale open alerts ──");
  const staleResult = await Alert.updateMany(
    { resolvedAt: null },
    {
      $set: {
        resolvedAt: new Date(),
        resolutionNote: "Seuils mis à jour — Décret 2018-928. Alerte résolue automatiquement.",
      },
    },
  );
  console.log(`  ✓ ${staleResult.modifiedCount} open alert(s) resolved`);

  // ── 3. Verify ──────────────────────────────────────────────
  console.log("\n── Verification ──");
  const polluants = await Polluant.find().select("code regulatoryLimit warningThreshold unit").lean();
  for (const p of polluants) {
    console.log(`  ${p.code.padEnd(6)} regulatoryLimit=${String(p.regulatoryLimit).padEnd(6)} warningThreshold=${p.warningThreshold} ${p.unit}`);
  }

  await mongoose.disconnect();
  console.log("\n✓ Done. Restart the backend server to reload the alert engine cache.");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
