/**
 * SCRIPT 02 — MULTI-NODE IoT SIMULATOR
 * Simulates 6 sensor nodes across 3 industries × 2 zones each.
 * Publishes MQTT messages on topics: emissions/<zone>/<type>
 *
 * Each node publishes 7 sensor types:
 *   CO2, NOX, SO2, PM25, COV, TEMPERATURE, HUMIDITY
 *
 * Scenarios (pass as CLI arg):
 *   node 02-multi-simulator.js random    ← default, mix of all levels
 *   node 02-multi-simulator.js normal    ← all values in safe range
 *   node 02-multi-simulator.js warning   ← values near threshold
 *   node 02-multi-simulator.js critical  ← values above threshold (triggers alerts)
 *
 * Usage: node testing/scripts/02-multi-simulator.js [scenario]
 *
 * Requires: Mosquitto running on localhost:1883
 */

// Resolve mqtt from iot/node_modules so this script runs from any cwd
const path = require("path");
const IOT = path.join(__dirname, "../../iot");
require(path.join(IOT, "node_modules/dotenv")).config({ path: path.join(IOT, ".env") });
const mqtt = require(path.join(IOT, "node_modules/mqtt"));

const SCENARIO = process.argv[2] || "random";
const VALID_SCENARIOS = ["random", "normal", "warning", "critical"];

if (!VALID_SCENARIOS.includes(SCENARIO)) {
  console.error(`❌ Invalid scenario: ${SCENARIO}`);
  console.error(`   Valid: ${VALID_SCENARIOS.join(", ")}`);
  process.exit(1);
}

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";

// ═══════════════════════════════════════════════════════════════
// SENSOR DEFINITIONS
// Each sensor has ranges for each scenario level
// ═══════════════════════════════════════════════════════════════

const SENSOR_TYPES = [
  {
    type: "CO2",
    model: "MH-Z19B",
    unit: "ppm",
    intervalMs: 10000,
    ranges: {
      normal:   { min: 400,  max: 700  },
      warning:  { min: 640,  max: 800  },
      critical: { min: 800,  max: 1200 },
    },
  },
  {
    type: "NOX",
    model: "MQ-131",
    unit: "mg/Nm³",
    intervalMs: 30000,
    ranges: {
      normal:   { min: 20,  max: 400  },
      warning:  { min: 400, max: 500  },
      critical: { min: 500, max: 750  },
    },
  },
  {
    type: "SO2",
    model: "MQ-136",
    unit: "mg/Nm³",
    intervalMs: 30000,
    ranges: {
      normal:   { min: 10,  max: 240  },
      warning:  { min: 240, max: 300  },
      critical: { min: 300, max: 450  },
    },
  },
  {
    type: "PM25",
    model: "SDS011",
    unit: "µg/m³",
    intervalMs: 15000,
    ranges: {
      normal:   { min: 2,    max: 12   },
      warning:  { min: 12,   max: 25   },
      critical: { min: 25,   max: 100  },
    },
  },
  {
    type: "PM10",
    model: "SDS011",
    unit: "µg/m³",
    intervalMs: 15000,
    ranges: {
      normal:   { min: 3,    max: 15   },
      warning:  { min: 15,   max: 30   },
      critical: { min: 30,   max: 120  },
    },
  },
    model: "SGP30",
    unit: "mg/Nm³",
    intervalMs: 30000,
    ranges: {
      normal:   { min: 5,  max: 88   },
      warning:  { min: 88, max: 110  },
      critical: { min: 110, max: 165 },
    },
  },
  {
    type: "TEMPERATURE",
    model: "DHT22",
    unit: "°C",
    intervalMs: 10000,
    ranges: {
      normal:   { min: 18, max: 28  },
      warning:  { min: 28, max: 35  },
      critical: { min: 35, max: 52  },
    },
  },
  {
    type: "HUMIDITY",
    model: "DHT22",
    unit: "%RH",
    intervalMs: 10000,
    ranges: {
      normal:   { min: 30, max: 50  },
      warning:  { min: 48, max: 60  },
      critical: { min: 60, max: 90  },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// NODES — one per zone (must match zones created by 01-seed)
// Topic format: emissions/<zone>/<sensorType>
// ═══════════════════════════════════════════════════════════════

const NODES = [
  { name: "Node-CIM-Zone-A", industrie: "Cimenterie Sfax",    zone: "Zone-A" },
  { name: "Node-CIM-Zone-B", industrie: "Cimenterie Sfax",    zone: "Zone-B" },
  { name: "Node-PET-Zone-A", industrie: "Raffinerie Bizerte", zone: "Zone-A" },
  { name: "Node-PET-Zone-B", industrie: "Raffinerie Bizerte", zone: "Zone-B" },
  { name: "Node-CHI-Zone-A", industrie: "Chimie Gabès",       zone: "Zone-A" },
  { name: "Node-CHI-Zone-B", industrie: "Chimie Gabès",       zone: "Zone-B" },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function rand(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pickScenario() {
  if (SCENARIO !== "random") return SCENARIO;
  // Random distribution: 60% normal, 25% warning, 15% critical
  const r = Math.random();
  if (r < 0.60) return "normal";
  if (r < 0.85) return "warning";
  return "critical";
}

function generateValue(sensor) {
  const level = pickScenario();
  const range = sensor.ranges[level] || sensor.ranges.normal;
  return { value: rand(range.min, range.max), level };
}

const LEVEL_ICONS = { normal: "🟢", warning: "🟡", critical: "🔴" };

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log(`
╔══════════════════════════════════════════════════╗
║     MULTI-NODE IoT SIMULATOR — EmissionsIQ       ║
║     Nodes   : ${String(NODES.length).padEnd(34)}║
║     Sensors : ${String(NODES.length * SENSOR_TYPES.length + " per node × " + NODES.length + " nodes").padEnd(34)}║
║     Scenario: ${SCENARIO.toUpperCase().padEnd(34)}║
║     Broker  : ${(MQTT_BROKER).padEnd(34)}║
╚══════════════════════════════════════════════════╝
`);

const client = mqtt.connect(MQTT_BROKER, {
  clientId: `emissionsiq-multi-sim-${Date.now()}`,
  keepalive: 60,
  reconnectPeriod: 2000,
  connectTimeout: 30000,
});

const intervals = [];

client.on("connect", () => {
  console.log(`✅ Connected to MQTT broker: ${MQTT_BROKER}`);
  console.log(`📡 Starting simulation for ${NODES.length} nodes × ${SENSOR_TYPES.length} sensors...\n`);

  // Print node table
  console.log("┌──────────────────────┬──────────────────────┬──────────┐");
  console.log("│ Node                 │ Industry             │ Zone     │");
  console.log("├──────────────────────┼──────────────────────┼──────────┤");
  NODES.forEach((n) => {
    console.log(`│ ${n.name.padEnd(20)} │ ${n.industrie.substring(0, 20).padEnd(20)} │ ${n.zone.padEnd(8)} │`);
  });
  console.log("└──────────────────────┴──────────────────────┴──────────┘\n");

  // Start publishing for each node × sensor combination
  NODES.forEach((node) => {
    SENSOR_TYPES.forEach((sensor) => {
      const topic = `emissions/${node.zone}/${sensor.type}`;

      // Publish immediately, then on interval
      const publish = () => {
        const { value, level } = generateValue(sensor);
        const message = {
          sensorType: sensor.type,
          model: sensor.model,
          value,
          unit: sensor.unit,
          level,
          nodeId: node.name,
          zone: node.zone,
          industrie: node.industrie,
          timestamp: new Date().toISOString(),
        };

        client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
          if (err) {
            console.error(`❌ Publish error [${topic}]: ${err.message}`);
            return;
          }
          const icon = LEVEL_ICONS[level] || "⚪";
          console.log(
            `${icon} [${new Date().toLocaleTimeString()}] ` +
            `${node.zone.padEnd(8)} ${sensor.type.padEnd(12)} ` +
            `${String(value).padStart(8)} ${sensor.unit.padEnd(8)} ` +
            `[${node.industrie.substring(0, 18)}]`
          );
        });
      };

      publish(); // immediate first reading
      const timer = setInterval(publish, sensor.intervalMs);
      intervals.push(timer);
    });
  });

  // Summary every 60 seconds
  const summaryTimer = setInterval(() => {
    console.log(`\n📊 [${new Date().toLocaleTimeString()}] Simulator running — ${NODES.length * SENSOR_TYPES.length} active streams | Scenario: ${SCENARIO.toUpperCase()}\n`);
  }, 60000);
  intervals.push(summaryTimer);
});

client.on("error", (err) => {
  console.error(`❌ MQTT error: ${err.message}`);
});

client.on("reconnect", () => {
  console.log("🔄 Reconnecting to MQTT broker...");
});

client.on("offline", () => {
  console.log("📴 MQTT client offline");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n🛑 Stopping simulator...");
  intervals.forEach(clearInterval);
  client.end(() => {
    console.log("✅ MQTT connection closed cleanly.");
    process.exit(0);
  });
});
