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
require("./models/Zone");   // must be registered for SensorNode.zoneId populate

// ── Config ────────────────────────────────────────────────────
const BROKER      = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const INTERVAL_MS = parseInt(process.env.SIM_INTERVAL_MS) || 10_000; // 10 s
const MODE        = (process.argv[2] || "normal").toLowerCase();

// ── Emission profiles per pollutant ──────────────────────────
// Baselines calibrated against Décret 2018-928, Annexe 1 (valeurs générales) :
//   CO2  : 800 ppm   (suivi interne — pas de VLE réglementaire)
//   NOX  : 500 mg/Nm³ (Annexe 1, §4 — flux > 25 kg/h)
//   SO2  : 300 mg/Nm³ (Annexe 1, §3 — flux > 25 kg/h)
//   PM25 : 40 mg/m³   (Annexe 1, §1 — flux > 1 kg/h)
//   COV  : 110 mg/Nm³ (Annexe 1, §7 — flux > 2 kg/h)
//
// Baselines ≈ 80% VLE (zone "Four" à pleine charge) — zone normale sous seuil,
// avec variations sinusoïdales + bruit pour générer naturellement des warnings.
const PROFILES = {
  CO2:  { baseline: 650, amplitude: 120, noise: 40,  unit: "ppm",    model: "MH-Z19B"   },
  NOX:  { baseline: 400, amplitude: 80,  noise: 40,  unit: "mg/Nm³", model: "MQ-131"    },
  SO2:  { baseline: 240, amplitude: 50,  noise: 30,  unit: "mg/Nm³", model: "MQ-136"    },
  PM25: { baseline: 32,  amplitude: 8,   noise: 4,   unit: "µg/m³",  model: "SDS011"    },
  PM10: { baseline: 38,  amplitude: 10,  noise: 5,   unit: "µg/m³",  model: "SDS011"    },
  COV:  { baseline: 88,  amplitude: 15,  noise: 10,  unit: "mg/Nm³", model: "SGP30"     },
};

// Per-pollutant validity ceiling (10× the VLE — anything above is a sensor fault)
// Aligned with ReadingService.js validation logic.
const VALIDITY_MAX = {
  CO2:  8000,   // ppm   (10× 800)
  NOX:  5000,   // mg/Nm³ (10× 500)
  SO2:  3000,   // mg/Nm³ (10× 300)
  PM25: 400,    // µg/m³
  PM10: 480,    // µg/m³
  COV:  1100,   // mg/Nm³ (10× 110)
};

// Zone multipliers — hotter zones emit more
const ZONE_MULT = {
  "Zone-Four":      1.0,
  "Zone-Broyage":   0.65,
  "Zone-Stockage":  0.55,
  "Zone-Expedition":0.50,
};

// ── Regulatory limits — Décret 2018-928, Annexe 1 (valeurs générales) ───────
// Used in critical mode to guarantee threshold breaches.
// These are the authoritative VLEs for a generic industrial platform.
// Sector-specific overrides (e.g. Annexe 6 for cimenteries) must be
// configured via ThresholdConfig in MongoDB, not hardcoded here.
const REGULATORY_LIMITS = {
  CO2:  800,   // ppm     — seuil interne (pas de VLE réglementaire)
  NOX:  500,   // mg/Nm³  — Annexe 1, §4 (flux > 25 kg/h)
  SO2:  300,   // mg/Nm³  — Annexe 1, §3 (flux > 25 kg/h)
  PM25: 40,    // µg/m³   — seuil indicatif (capteur SDS011)
  PM10: 48,    // µg/m³   — seuil indicatif (capteur SDS011)
  COV:  110,   // mg/Nm³  — Annexe 1, §7 (flux > 2 kg/h)
};

// Mode multipliers
const MODE_MULT = {
  normal:   1.0,
  warning:  1.4,   // ~40% above baseline → triggers Warning alerts
  random:   null,  // random between 0.5 and 2.0
};

function getValue(profile, zoneCode, pollutantCode) {
  // Critical mode: always send 1.6× the regulatory limit (above the 1.5× Critical threshold)
  // regardless of zone or time-of-day factors.
  if (MODE === "critical") {
    const limit = REGULATORY_LIMITS[pollutantCode] ?? profile.baseline;
    const jitter = (Math.random() - 0.5) * 0.1 * limit; // ±5% jitter
    return Math.round((limit * 1.6 + jitter) * 100) / 100;
  }

  // Warning mode: send values between warningThreshold (80% VLE) and VLE
  // i.e. 85–99% of the regulatory limit — guaranteed Warning, not Critical.
  if (MODE === "warning") {
    const limit = REGULATORY_LIMITS[pollutantCode] ?? profile.baseline;
    const pct = 0.85 + Math.random() * 0.13; // 85–98% of VLE
    return Math.round(limit * pct * 100) / 100;
  }

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
  const nodes = await SensorNode.find({ Status: "Active" })
    .populate("zoneId", "code nom")
    .lean();
  if (nodes.length === 0) {
    console.error("❌ No active SensorNodes found. Run: node init-fresh.js");
    process.exit(1);
  }

  // Build publish plan: [ { node, sensor, polluant, profile, zoneCode } ]
  const plan = [];
  for (const node of nodes) {
    // Support both new schema (zoneId populated) and legacy (zone string)
    const zoneCode = node.zoneId?.code || node.zoneId?.nom || node.zone || "Zone-Unknown";

    const sensors = await Sensor.find({ sensorNodeId: node._id, isActive: true })
      .populate("PolluantId", "name code unit")
      .lean();

    for (const sensor of sensors) {
      const code = sensor.PolluantId?.code || sensor.type;
      const profile = PROFILES[code];
      if (!profile) continue; // skip TEMPERATURE/HUMIDITY etc.
      plan.push({ node, sensor, polluant: sensor.PolluantId, profile, zoneCode });
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
    tick++
    let published = 0
    let offset = 0

    for (const { node, sensor, polluant, profile, zoneCode } of plan) {
      const pollutantCode = polluant?.code || sensor.type
      const value = getValue(profile, zoneCode, pollutantCode)
      const topic = `emissions/${zoneCode}/${pollutantCode}`

      // Give each reading a unique timestamp (1 ms apart) so the history
      // chart never receives two points with the exact same x value.
      const ts = new Date(Date.now() + offset).toISOString()
      offset++

      const payload = JSON.stringify({
        sensorType: pollutantCode,
        model: sensor.model || profile.model,
        value,
        unit: profile.unit,
        zone: zoneCode,
        nodeId: node._id.toString(),
        sensorId: sensor._id.toString(),
        timestamp: ts,
        isValid: value >= 0 && value <= (VALIDITY_MAX[pollutantCode] ?? 2000),
      })

      client.publish(topic, payload, { qos: 1 })
      published++
    }

    // Summary line every tick
    const time = new Date().toLocaleTimeString()
    process.stdout.write(`\r[${time}] Tick #${tick} — ${published} messages published`)
  }
}

main().catch(e => {
  console.error("❌ Simulator failed:", e.message);
  process.exit(1);
});
