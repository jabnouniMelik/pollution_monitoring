/**
 * ============================================================
 * REAL-TIME IoT SIMULATOR
 * ============================================================
 * Publishes sensor readings to MQTT broker every 10 seconds
 * for all SensorNodes in the database.
 *
 * Topic format: emissions/<zone>/<pollutantType>
 * Payload: { sensorType, model, value, unit, zone, timestamp, isValid }
 *
 * Usage:
 *   node simulator.js           (normal mode)
 *   node simulator.js warning   (elevated values)
 *   node simulator.js critical  (threshold-breaching values)
 *
 * npm run simulate
 * ============================================================
 */

"use strict";
require("dotenv").config();
const mqtt   = require("mqtt");
const mongoose = require("mongoose");

const SensorNode = require("./models/SensorNode");
const Sensor     = require("./models/Sensor");
const Polluant   = require("./models/Polluant");

// ── Config ────────────────────────────────────────────────────
const BROKER      = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const INTERVAL_MS = parseInt(process.env.SIM_INTERVAL_MS) || 10_000; // 10 s
const MODE        = (process.argv[2] || "normal").toLowerCase();

// ── Emission profiles per pollutant ──────────────────────────
// [baseline, amplitude, noise, unit, model]
const PROFILES = {
  CO2:  { baseline: 650, amplitude: 120, noise: 40,  unit: "ppm",    model: "MH-Z19B"   },
  NOX:  { baseline: 85,  amplitude: 30,  noise: 15,  unit: "mg/Nm³", model: "MiCS-6814" },
  SO2:  { baseline: 45,  amplitude: 20,  noise: 10,  unit: "mg/Nm³", model: "MiCS-6814" },
  PM25: { baseline: 28,  amplitude: 12,  noise: 8,   unit: "µg/m³",  model: "SDS011"    },
  COV:  { baseline: 18,  amplitude: 8,   noise: 5,   unit: "mg/Nm³", model: "BME680"    },
};

// Zone multipliers — hotter zones emit more
const ZONE_MULT = {
  "Zone-Four":      1.0,
  "Zone-Broyage":   0.65,
  "Zone-Stockage":  0.55,
  "Zone-Expedition":0.50,
};

// Mode multipliers
const MODE_MULT = {
  normal:   1.0,
  warning:  1.4,   // ~40% above baseline → triggers Warning alerts
  critical: 1.9,   // ~90% above baseline → triggers Critical alerts
  random:   null,  // random between 0.5 and 2.0
};

function getValue(profile, zoneCode) {
  const zoneMult = ZONE_MULT[zoneCode] ?? 1.0;
  let modeMult = MODE_MULT[MODE] ?? 1.0;
  if (MODE === "random") modeMult = 0.5 + Math.random() * 1.5;

  const hour = new Date().getUTCHours();
  const dayFactor = (hour >= 6 && hour <= 18) ? 1.1 : 0.9;
  const wave = Math.sin(Date.now() / (4 * 60 * 60 * 1000));
  const v = (profile.baseline + profile.amplitude * wave + (Math.random() - 0.5) * 2 * profile.noise)
            * zoneMult * modeMult * dayFactor;
  return Math.max(0, Math.round(v * 100) / 100);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  // Connect to MongoDB to read sensor nodes
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db");
  console.log("✓ MongoDB connected");

  // Load all active sensor nodes with their sensors
  const nodes = await SensorNode.find({ Status: "Active" }).lean();
  if (nodes.length === 0) {
    console.error("❌ No active SensorNodes found. Run: node init-fresh.js");
    process.exit(1);
  }

  // Build publish plan: [ { node, sensor, polluant, profile } ]
  const plan = [];
  for (const node of nodes) {
    const sensors = await Sensor.find({ sensorNodeId: node._id, isActive: true })
      .populate("PolluantId", "name code unit")
      .lean();

    for (const sensor of sensors) {
      const code = sensor.PolluantId?.code || sensor.type;
      const profile = PROFILES[code];
      if (!profile) continue; // skip TEMPERATURE/HUMIDITY etc.
      plan.push({ node, sensor, polluant: sensor.PolluantId, profile });
    }
  }

  console.log(`✓ Loaded ${nodes.length} nodes, ${plan.length} sensor channels`);
  console.log(`✓ Mode: ${MODE.toUpperCase()} | Interval: ${INTERVAL_MS / 1000}s\n`);

  // Connect to MQTT broker
  const client = mqtt.connect(BROKER, {
    clientId: "iot-simulator-" + Math.random().toString(16).slice(2, 8),
    keepalive: 60,
    reconnectPeriod: 3000,
  });

  client.on("connect", () => {
    console.log(`✅ Connected to MQTT broker: ${BROKER}`);
    console.log(`📡 Publishing to emissions/<zone>/<pollutant> every ${INTERVAL_MS / 1000}s\n`);

    // Publish immediately, then on interval
    publish();
    setInterval(publish, INTERVAL_MS);
  });

  client.on("error", (err) => {
    console.error("❌ MQTT error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("🔄 Reconnecting to MQTT broker...");
  });

  let tick = 0;

  function publish() {
    tick++;
    const ts = new Date().toISOString();
    let published = 0;

    for (const { node, sensor, polluant, profile } of plan) {
      const zoneCode = node.zone;
      const pollutantCode = polluant?.code || sensor.type;
      const value = getValue(profile, zoneCode);
      const topic = `emissions/${zoneCode}/${pollutantCode}`;

      const payload = JSON.stringify({
        sensorType: pollutantCode,
        model: sensor.model || profile.model,
        value,
        unit: profile.unit,
        zone: zoneCode,
        nodeId: node._id.toString(),
        sensorId: sensor._id.toString(),
        timestamp: ts,
        isValid: value >= 0 && value <= 2000,
      });

      client.publish(topic, payload, { qos: 1 });
      published++;
    }

    // Summary line every tick
    const time = new Date().toLocaleTimeString();
    process.stdout.write(`\r[${time}] Tick #${tick} — ${published} messages published`);
  }
}

main().catch(e => {
  console.error("❌ Simulator failed:", e.message);
  process.exit(1);
});
