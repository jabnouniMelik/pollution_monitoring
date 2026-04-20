/**
 * SCRIPT DE DIAGNOSTIC
 * Affiche l'état complet des capteurs et polluants dans la DB
 * pour identifier pourquoi certains polluants ne créent pas d'alertes
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Sensor = require("./models/Sensor");
const Polluant = require("./models/Polluant");
const Reading = require("./models/Reading");
const Alert = require("./models/Alert");

async function diagnoseDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected\n");

    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║           DIAGNOSTIC: Capteurs, Polluants & Alertes            ║",
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝\n",
    );

    // ════════════════════════════════════════════════════════════════
    // 1. AFFICHER TOUS LES POLLUANTS ET LEURS SEUILS
    // ════════════════════════════════════════════════════════════════
    console.log("📊 POLLUANTS DANS LA DB:");
    console.log("─".repeat(70));

    const polluants = await Polluant.find().lean();
    polluants.forEach((p) => {
      console.log(`\n  ${p.name}`);
      console.log(`    ID: ${p._id}`);
      console.log(`    Unit: ${p.unit}`);
      console.log(`    Regulatory Limit: ${p.regulatoryLimit}`);
      console.log(`    Warning Threshold: ${p.warningThreshold}`);
    });

    // ════════════════════════════════════════════════════════════════
    // 2. AFFICHER TOUS LES CAPTEURS ET LEURS LIENS
    // ════════════════════════════════════════════════════════════════
    console.log("\n\n📡 CAPTEURS DANS LA DB:");
    console.log("─".repeat(70));

    const sensors = await Sensor.find().populate("PolluantId").lean();
    sensors.forEach((s) => {
      const polluantName = s.PolluantId?.name || "UNKNOWN";
      console.log(`\n  ${s.type} (${s.model})`);
      console.log(`    Sensor ID: ${s._id}`);
      console.log(`    Polluant ID: ${s.PolluantId?._id || "NULL"}`);
      console.log(`    Polluant Name: ${polluantName}`);
      console.log(`    Status: ${s.status}`);
    });

    // ════════════════════════════════════════════════════════════════
    // 3. COMPTER LES READINGS PAR POLLUANT
    // ════════════════════════════════════════════════════════════════
    console.log("\n\n📈 READINGS PAR POLLUANT:");
    console.log("─".repeat(70));

    for (const polluant of polluants) {
      const count = await Reading.countDocuments({
        PolluantId: polluant._id,
      });
      console.log(`  ${polluant.name}: ${count} readings`);
    }

    // ════════════════════════════════════════════════════════════════
    // 4. COMPTER LES ALERTES PAR POLLUANT
    // ════════════════════════════════════════════════════════════════
    console.log("\n\n🚨 ALERTES PAR POLLUANT:");
    console.log("─".repeat(70));

    for (const polluant of polluants) {
      const count = await Alert.countDocuments({
        PolluantId: polluant._id,
      });
      const latestAlert = await Alert.findOne({
        PolluantId: polluant._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      console.log(`\n  ${polluant.name}:`);
      console.log(`    Total alerts: ${count}`);
      if (latestAlert) {
        console.log(
          `    Latest alert: ${latestAlert.severity} at ${new Date(latestAlert.createdAt).toLocaleTimeString()}`,
        );
        console.log(`    Value: ${latestAlert.value} ${latestAlert.unit}`);
      } else {
        console.log(`    Latest alert: NONE`);
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 5. AFFICHER LES DERNIÈRES READINGS
    // ════════════════════════════════════════════════════════════════
    console.log("\n\n📋 DERNIÈRES READINGS (dernière heure):");
    console.log("─".repeat(70));

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReadings = await Reading.find({
      createdAt: { $gte: oneHourAgo },
    })
      .populate("PolluantId")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const readingsByPolluant = {};
    recentReadings.forEach((r) => {
      const name = r.PolluantId?.name || "UNKNOWN";
      if (!readingsByPolluant[name]) {
        readingsByPolluant[name] = [];
      }
      readingsByPolluant[name].push(r);
    });

    Object.entries(readingsByPolluant).forEach(([name, readings]) => {
      console.log(`\n  ${name}: ${readings.length} readings in last hour`);
      const sample = readings[0];
      if (sample) {
        console.log(
          `    Sample: ${sample.value} ${sample.unit} at ${new Date(sample.timestamp).toLocaleTimeString()}`,
        );
      }
    });

    console.log("\n\n✅ Diagnostic complete!\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

diagnoseDatabase();
