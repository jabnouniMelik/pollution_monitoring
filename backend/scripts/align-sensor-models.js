/**
 * Align existing MongoDB Sensor.model values with the ESP32 hardware stack.
 * Hardware reference: rapport/II3_Couche_IoT.md — §II.3.3 Sélection des capteurs
 *
 * Run:
 *   node scripts/align-sensor-models.js
 */
"use strict";

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Sensor = require("../models/Sensor");

const TARGET_MODELS = {
  CO2: "MH-Z19B",
  NOX: "MQ-131",   // oxyde métallique MOS — remplace ME4-NO2 pour prototype PFE
  SO2: "MQ-136",   // oxyde métallique MOS — remplace ME4-SO2 pour prototype PFE
  PM25: "SDS011",
  PM10: "SDS011",
  COV: "SGP30",
  TEMPERATURE: "DHT22",
  HUMIDITY: "DHT22",
};

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db";
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB: ${mongoUri}`);

  const ops = Object.entries(TARGET_MODELS).map(([type, model]) => ({
    updateMany: {
      filter: { type, model: { $ne: model } },
      update: { $set: { model } },
    },
  }));

  const result = await Sensor.bulkWrite(ops, { ordered: false });
  const updatedCount = result.modifiedCount || 0;
  console.log(`Updated sensor model records: ${updatedCount}`);

  const summary = await Sensor.aggregate([
    { $group: { _id: { type: "$type", model: "$model" }, count: { $sum: 1 } } },
    { $sort: { "_id.type": 1, "_id.model": 1 } },
  ]);

  console.log("Current Sensor(type/model) distribution:");
  for (const row of summary) {
    console.log(`- ${row._id.type}: ${row._id.model} (${row.count})`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to align sensor models:", err);
  process.exit(1);
});
