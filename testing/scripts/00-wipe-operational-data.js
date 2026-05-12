/**
 * SCRIPT 00 — WIPE OPERATIONAL DATA
 * Clears all operational/transactional data while keeping
 * structural data (polluants, threshold configs, site configs, users).
 *
 * Wiped collections:
 *   - readings
 *   - alerts
 *   - aggregatedatas (KPI history)
 *   - reports
 *   - refreshtokens
 *   - industries
 *   - sites
 *   - zones
 *   - sensornodes
 *   - sensors
 *
 * Kept collections:
 *   - users          (keep superadmin + demo users)
 *   - polluants      (regulatory reference data)
 *   - thresholdconfigs
 *   - siteconfigs
 *
 * Usage: node testing/scripts/00-wipe-operational-data.js
 */

// Resolve modules from backend/node_modules so this script runs from any cwd
const path = require("path");
const BACKEND = path.join(__dirname, "../../backend");
require(path.join(BACKEND, "node_modules/dotenv")).config({ path: path.join(BACKEND, ".env") });
const mongoose = require(path.join(BACKEND, "node_modules/mongoose"));

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db";

async function wipe() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected to: ${MONGO_URI}\n`);

  const db = mongoose.connection.db;

  const targets = [
    "readings",
    "alerts",
    "aggregatedatas",
    "reports",
    "refreshtokens",
    "industries",
    "sites",
    "zones",
    "sensornodes",
    "sensors",
  ];

  console.log("🗑️  Wiping operational collections...\n");

  for (const col of targets) {
    try {
      const result = await db.collection(col).deleteMany({});
      console.log(`  ✅ ${col.padEnd(20)} → ${result.deletedCount} documents deleted`);
    } catch (e) {
      // Collection may not exist yet — that's fine
      console.log(`  ⚠️  ${col.padEnd(20)} → skipped (${e.message})`);
    }
  }

  console.log("\n✨ Operational data wiped. Structural data (users, polluants, thresholds, siteconfigs) kept.");
  await mongoose.disconnect();
  console.log("🔌 Disconnected.\n");
}

wipe().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
