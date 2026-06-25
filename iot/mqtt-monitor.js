// ============================================================
// 📡 MQTT MONITOR — CÔTÉ SIMULATEUR IoT
// Affiche en temps réel tous les messages publiés
// par le simulateur vers le broker MQTT
//
// Usage : node mqtt-monitor.js
// ============================================================

"use strict";
require("dotenv").config();
const mqtt = require("mqtt");

const BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";

// ── Couleurs ANSI ─────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  white:   "\x1b[37m",
  bgBlue:  "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgRed:   "\x1b[41m",
  bgYellow:"\x1b[43m",
};

// ── Niveau → couleur + badge ──────────────────────────────────
const LEVEL_STYLE = {
  normal:   { color: C.green,   icon: "🟢", badge: " NORMAL   " },
  warning:  { color: C.yellow,  icon: "🟡", badge: " WARNING  " },
  high:     { color: C.magenta, icon: "🟠", badge: " HIGH     " },
  critical: { color: C.red,     icon: "🔴", badge: " CRITICAL " },
};

// ── Polluant → couleur ────────────────────────────────────────
const POLLUANT_COLOR = {
  CO2:         C.cyan,
  NOX:         C.red,
  SO2:         C.yellow,
  PM25:        C.magenta,
  PM10:        C.magenta,
  COV:         C.blue,
  TEMPERATURE: C.green,
  HUMIDITY:    C.blue,
};

// ── Statistiques ──────────────────────────────────────────────
let stats = {
  total: 0,
  byTopic: {},
  byLevel: { normal: 0, warning: 0, high: 0, critical: 0 },
  startTime: Date.now(),
};

function timestamp() {
  return new Date().toLocaleTimeString("fr-FR", { hour12: false });
}

function separator(char = "─", len = 70) {
  return char.repeat(len);
}

function printHeader() {
  console.clear();
  console.log(C.bold + C.bgBlue + C.white);
  console.log("  ██████████████████████████████████████████████████████████  ");
  console.log("  ██   📡  MQTT MONITOR — CÔTÉ SIMULATEUR IoT             ██  ");
  console.log("  ██   Broker : " + BROKER.padEnd(43) + "██  ");
  console.log("  ██   Topic  : emissions/#                               ██  ");
  console.log("  ██████████████████████████████████████████████████████████  ");
  console.log(C.reset + "\n");
}

function printMessage(topic, data) {
  stats.total++;

  // Comptage par topic
  stats.byTopic[topic] = (stats.byTopic[topic] || 0) + 1;

  // Comptage par niveau
  const level = data.level || "normal";
  if (stats.byLevel[level] !== undefined) stats.byLevel[level]++;

  const style = LEVEL_STYLE[level] || LEVEL_STYLE.normal;
  const polColor = POLLUANT_COLOR[data.sensorType] || C.white;

  // ── Ligne d'en-tête du message ────────────────────────────
  console.log(C.dim + separator() + C.reset);

  // Horodatage + topic
  console.log(
    `${C.dim}[${timestamp()}]${C.reset} ` +
    `${C.bold}${C.cyan}PUBLISH${C.reset} ` +
    `${C.dim}→${C.reset} ` +
    `${C.bold}${polColor}${topic}${C.reset}`
  );

  // Badge niveau
  process.stdout.write(`  ${style.icon}  `);
  process.stdout.write(`${C.bold}${style.color}[${style.badge}]${C.reset}  `);

  // Valeur principale
  console.log(
    `${C.bold}${polColor}${String(data.value).padStart(8)} ${data.unit}${C.reset}  ` +
    `${C.dim}(${data.model || "?"})${C.reset}`
  );

  // Détails JSON compacts
  console.log(
    `  ${C.dim}Zone: ${C.reset}${C.white}${data.zone || "?"}${C.reset}  ` +
    `${C.dim}| Node: ${C.reset}${C.white}${(data.nodeName || data.nodeId || "?").toString().slice(0, 20)}${C.reset}  ` +
    `${C.dim}| rawValue: ${C.reset}${C.white}${data.rawValue ?? data.value}${C.reset}  ` +
    `${C.dim}| valid: ${C.reset}${data.isValid ? C.green + "✓" : C.red + "✗"}${C.reset}`
  );

  console.log(
    `  ${C.dim}Timestamp: ${C.reset}${C.white}${data.timestamp || new Date().toISOString()}${C.reset}  ` +
    `${C.dim}| Total publié: ${C.reset}${C.bold}${stats.total}${C.reset}`
  );
}

function printStats() {
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  const rps = elapsed > 0 ? (stats.total / elapsed).toFixed(2) : "0.00";

  console.log("\n" + C.bold + C.bgGreen + C.white);
  console.log("  📊 STATISTIQUES EN TEMPS RÉEL  ");
  console.log(C.reset);
  console.log(separator("─", 50));
  console.log(`  Total messages publiés : ${C.bold}${stats.total}${C.reset}`);
  console.log(`  Durée active          : ${C.bold}${elapsed}s${C.reset}`);
  console.log(`  Débit moyen           : ${C.bold}${rps} msg/s${C.reset}`);
  console.log(separator("─", 50));
  console.log(`  🟢 Normal   : ${C.green}${String(stats.byLevel.normal).padStart(5)}${C.reset}`);
  console.log(`  🟡 Warning  : ${C.yellow}${String(stats.byLevel.warning).padStart(5)}${C.reset}`);
  console.log(`  🟠 High     : ${C.magenta}${String(stats.byLevel.high).padStart(5)}${C.reset}`);
  console.log(`  🔴 Critical : ${C.red}${String(stats.byLevel.critical).padStart(5)}${C.reset}`);
  console.log(separator("─", 50));
  console.log("  Topics actifs :");
  Object.entries(stats.byTopic)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([topic, count]) => {
      const bar = "█".repeat(Math.min(Math.floor(count / 2), 20));
      console.log(`    ${C.cyan}${topic.padEnd(35)}${C.reset} ${C.green}${bar}${C.reset} ${count}`);
    });
  console.log(separator("─", 50) + "\n");
}

// ── Connexion MQTT ────────────────────────────────────────────
printHeader();
console.log(`${C.cyan}🔌 Connexion au broker : ${BROKER}...${C.reset}\n`);

const client = mqtt.connect(BROKER, {
  clientId: "mqtt-monitor-iot-" + Math.random().toString(16).slice(2, 6),
  keepalive: 60,
  reconnectPeriod: 2000,
});

client.on("connect", () => {
  console.log(`${C.bold}${C.green}✅ Connecté au broker MQTT !${C.reset}`);
  console.log(`${C.dim}   En écoute sur : emissions/#${C.reset}`);
  console.log(`${C.dim}   Appuyez sur Ctrl+C pour arrêter\n${C.reset}`);
  console.log(separator("═", 70) + "\n");

  client.subscribe("emissions/#", { qos: 1 }, (err) => {
    if (err) {
      console.error(`${C.red}❌ Erreur subscription : ${err.message}${C.reset}`);
    } else {
      console.log(`${C.green}📡 Abonné à : emissions/#${C.reset}\n`);
    }
  });
});

client.on("message", (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());
    printMessage(topic, data);
  } catch (e) {
    console.log(`${C.red}❌ Payload invalide sur ${topic} : ${payload.toString().slice(0, 100)}${C.reset}`);
  }
});

client.on("error", (err) => {
  console.error(`\n${C.bgRed}${C.white} ❌ ERREUR MQTT ${C.reset} ${err.message}`);
  console.log(`${C.yellow}💡 Vérifiez que Mosquitto est lancé : mosquitto -v${C.reset}\n`);
});

client.on("reconnect", () => {
  process.stdout.write(`\r${C.yellow}🔄 Reconnexion au broker...${C.reset}   `);
});

client.on("offline", () => {
  console.log(`\n${C.red}📵 Broker hors ligne${C.reset}`);
});

// ── Statistiques périodiques ──────────────────────────────────
setInterval(printStats, 30000); // toutes les 30 secondes

// ── Arrêt propre ──────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log(`\n\n${C.bold}${C.yellow}🛑 Arrêt du moniteur IoT...${C.reset}`);
  printStats();
  client.end(() => {
    console.log(`${C.green}✅ Connexion fermée proprement.${C.reset}\n`);
    process.exit(0);
  });
});
