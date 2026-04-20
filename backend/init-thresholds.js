/**
 * Script d'initialisation - Seuils par défaut (Décret 2010-2516)
 * Usage: node init-thresholds.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const ThresholdConfig = require("./models/ThresholdConfig");

async function initializeThresholds() {
  try {
    // Connexion MongoDB
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db",
    );
    console.log("✓ MongoDB connecté");

    // Vérifier si config existe déjà
    const existing = await ThresholdConfig.findOne({
      nom: "Configuration Globale",
    });

    if (existing) {
      console.log("✓ Configuration globale déjà existe");
      await mongoose.disconnect();
      return;
    }

    // Créer la configuration par défaut
    const defaultConfig = new ThresholdConfig({
      nom: "Configuration Globale",
      description:
        "Seuils globaux basés sur Décret 2010-2516 (Tunisie) et normes ANPE",
      polluants: {
        NOx: {
          min: 120,
          max: 450,
          unit: "mg/Nm³",
          reference: "Décret 2010-2516",
          warning: 360, // 450 - 20%
          critical: 540, // 450 + 20%
        },
        SO2: {
          min: 35,
          max: 1700,
          unit: "mg/Nm³",
          reference: "Décret 2010-2516",
          warning: 1360, // 1700 - 20%
          critical: 2040, // 1700 + 20%
        },
        PM: {
          min: 5,
          max: 550,
          unit: "mg/m³",
          reference: "Décret 2010-2516",
          warning: 440, // 550 - 20%
          critical: 660, // 550 + 20%
        },
        PM25: {
          min: 5,
          max: 550,
          unit: "mg/m³",
          reference: "Décret 2010-2516",
          warning: 440, // 550 - 20%
          critical: 660, // 550 + 20%
        },
        COV: {
          min: 0,
          max: 110,
          unit: "mg/Nm³",
          reference: "ANPE",
          warning: 88, // 110 - 20%
          critical: 132, // 110 + 20%
        },
        CO2: {
          min: 0,
          max: 800,
          unit: "ppm",
          reference: "Custom",
          warning: 640, // 800 - 20%
          critical: 960, // 800 + 20%
        },
      },
      warningOffsetPercent: 20,
      criticalOffsetPercent: 20,
      actif: true,
    });

    await defaultConfig.save();
    console.log("✅ Configuration des seuils initialisée");
    console.log("\n📊 Seuils d'émission (Décret 2010-2516):");
    console.log("  NOx:   120-450 mg/Nm³   (Warning: 360, Critical: 540)");
    console.log("  SO₂:   35-1700 mg/Nm³   (Warning: 1360, Critical: 2040)");
    console.log("  PM:    5-550 mg/m³      (Warning: 440, Critical: 660)");
    console.log("  PM2.5: 5-550 mg/m³      (Warning: 440, Critical: 660)");
    console.log("  COV:   0-110 mg/Nm³     (Warning: 88, Critical: 132)");
    console.log("  CO₂:   0-800 ppm        (Warning: 640, Critical: 960)");

    await mongoose.disconnect();
    console.log("\n✓ Done");
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  }
}

initializeThresholds();
