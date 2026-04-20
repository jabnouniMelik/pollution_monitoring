/**
 * ============================================================
 * SCRIPT D'INITIALISATION POUR SIMULATEUR
 * ============================================================
 * Crée les données de base nécessaires pour que le simulateur
 * IoT puisse envoyer des mesures et créer des alertes.
 *
 * USAGE: npm run init:simulator
 * ou:    node init-simulator.js
 *
 * Ce script est idempotent (peut être exécuté plusieurs fois)
 * ============================================================
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Industrie = require("./models/Industrie");
const SensorNode = require("./models/SensorNode");
const Polluant = require("./models/Polluant");
const Sensor = require("./models/Sensor");
const Reading = require("./models/Reading");
const Alert = require("./models/Alert");

// Configuration des capteurs du simulateur
// DOIT correspondre à simulatorConfig.js dans iot/config/
const SIMULATOR_SENSORS = [
  {
    type: "CO2",
    model: "MH-Z19B",
    unit: "ppm",
    regulatoryLimit: 800,
    warningThreshold: 640,
    name: "CO2",
    description: "Carbon dioxide concentration",
    formula: "CO2",
  },
  {
    type: "NOX",
    model: "MQ-135",
    unit: "mg/Nm³",
    regulatoryLimit: 120,
    warningThreshold: 96,
    name: "NOX",
    description: "Nitrogen oxides",
    formula: "NO+NO2",
  },
  {
    type: "SO2",
    model: "Alphasense SO2-B4",
    unit: "mg/Nm³",
    regulatoryLimit: 120,
    warningThreshold: 96,
    name: "SO2",
    description: "Sulfur dioxide",
    formula: "SO2",
  },
  {
    type: "COV",
    model: "CCS811",
    unit: "mg/Nm³",
    regulatoryLimit: 30,
    warningThreshold: 24,
    name: "COV",
    description: "Volatile organic compounds",
    formula: "VOC",
  },
  {
    type: "PM25",
    model: "Plantower PMS5003",
    unit: "µg/m³",
    regulatoryLimit: 12,
    warningThreshold: 9.6,
    name: "PM25",
    description: "Fine particulate matter",
    formula: "PM2.5",
  },
  {
    type: "TEMPERATURE",
    model: "SHT31",
    unit: "°C",
    regulatoryLimit: null, // No regulatory limit for temperature
    warningThreshold: null,
    name: "TEMPERATURE",
    description: "Ambient temperature",
    formula: "T",
  },
  {
    type: "HUMIDITY",
    model: "SHT31",
    unit: "%",
    regulatoryLimit: null, // No regulatory limit for humidity
    warningThreshold: null,
    name: "HUMIDITY",
    description: "Relative humidity",
    formula: "H",
  },
];

async function initializeSimulatorDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected\n");

    console.log("🔧 Initializing database for simulator...\n");

    // ════════════════════════════════════════════════════════
    // 1. CREATE OR GET INDUSTRIE
    // ════════════════════════════════════════════════════════
    let industrie = await Industrie.findOne({ nom: "Station-Sfax-01" });
    if (!industrie) {
      industrie = await Industrie.create({
        nom: "Station-Sfax-01",
        secteur: "Monitoring",
        localisation: {
          ville: "Sfax",
          latitude: 34.74,
          longitude: 10.76,
        },
        contact: "+216 XXXXXXXX",
        actif: true,
      });
      console.log("✅ Industrie créée: Station-Sfax-01");
    } else {
      console.log("✅ Industrie existante trouvée: Station-Sfax-01");
    }

    // ════════════════════════════════════════════════════════
    // 2. CREATE OR GET SENSOR NODE
    // ════════════════════════════════════════════════════════
    let sensorNode = await SensorNode.findOne({
      macAddress: "00:1B:44:11:3A:B7",
    });
    if (!sensorNode) {
      sensorNode = await SensorNode.create({
        nom: "Zone-A",
        IndustrieId: industrie._id,
        zone: "Zone-A",
        Status: "Active",
        IPAddress: "192.168.1.100",
        macAddress: "00:1B:44:11:3A:B7",
      });
      console.log("✅ SensorNode créé: Zone-A");
    } else {
      console.log("✅ SensorNode existant trouvé: Zone-A");
    }

    // ════════════════════════════════════════════════════════
    // 3. CREATE OR GET POLLUANTS
    // ════════════════════════════════════════════════════════
    console.log("\n📊 Polluants:");
    const polluantsMap = new Map();

    for (const sensorConfig of SIMULATOR_SENSORS) {
      let polluant = await Polluant.findOne({ name: sensorConfig.name });
      if (!polluant) {
        polluant = await Polluant.create({
          name: sensorConfig.name,
          formula: sensorConfig.formula,
          unit: sensorConfig.unit,
          regulatoryLimit: sensorConfig.regulatoryLimit,
          warningThreshold: sensorConfig.warningThreshold,
          description: sensorConfig.description,
          conversionFactor: 1.0,
        });
        console.log(`  ✅ ${sensorConfig.name} créé`);
      } else {
        console.log(`  ✅ ${sensorConfig.name} existant`);
      }
      polluantsMap.set(sensorConfig.name, polluant._id);
    }

    // ════════════════════════════════════════════════════════
    // 4. CREATE OR GET SENSORS
    // ════════════════════════════════════════════════════════
    console.log("\n📡 Capteurs:");
    for (const sensorConfig of SIMULATOR_SENSORS) {
      const existingSensor = await Sensor.findOne({
        sensorNodeId: sensorNode._id,
        type: sensorConfig.type,
        model: sensorConfig.model,
      });

      if (!existingSensor) {
        await Sensor.create({
          sensorNodeId: sensorNode._id,
          PolluantId: polluantsMap.get(sensorConfig.name),
          type: sensorConfig.type,
          unit: sensorConfig.unit,
          model: sensorConfig.model,
          calibrationDate: new Date(),
          driftThreshold: 5,
          status: "Active",
        });
        console.log(`  ✅ ${sensorConfig.type} (${sensorConfig.model}) créé`);
      } else {
        console.log(
          `  ✅ ${sensorConfig.type} (${sensorConfig.model}) existant`,
        );
      }
    }

    console.log("\n✨ Database initialization complete!");
    console.log(`✅ Industries: 1`);
    console.log(`✅ Sensor Nodes: 1`);
    console.log(`✅ Polluants: ${SIMULATOR_SENSORS.length}`);
    console.log(`✅ Sensors: ${SIMULATOR_SENSORS.length}`);

    console.log("\n💡 Vous pouvez maintenant lancer le simulateur:");
    console.log("   cd iot");
    console.log("   node simulator.js [normal|warning|high|critical|random]\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

initializeSimulatorDatabase();
