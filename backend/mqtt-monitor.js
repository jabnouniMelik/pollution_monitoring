// ============================================================
// 🖥️  MQTT MONITOR — CÔTÉ BACKEND
// Affiche en temps réel tous les messages reçus
// du broker MQTT par le backend, avec état de traitement
//
// Usage : node mqtt-monitor.js
// ============================================================

"use strict";
require("dotenv").config();
const mqtt = require("mqtt");

const BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";

// ── Couleurs ANSI ─────────────────────────────────────────────
const C = {
  reset:    "\x1b[0m",
  bold:     "\x1b[1m",
  dim:      "\x1b[2m",
  cyan:     "\x1b[36m",
  green:    "\x1b[32m",
  yellow:   "\x1b[33m",
  red:      "\x1b[31m",
  blue:     "\x1b[34m",
  magenta:  "\x1b[35m",
  white:    "\x1b[37m",
  bgBlue:   "\x1b[44m",
  bgGreen:  "\x1b[42m",
  bgRed:    "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgCyan:   "\x1b[46m",
};

// ── Niveau → style ────────────────────────────────────────────
const LEVEL_STYLE = {
  normal:   { color: C.green,   icon: "🟢", label: "NORMAL   " },
  warning:  { color: C.yellow,  icon: "🟡", label: "WARNING  " },
  high:     { color: C.magenta, icon: "🟠", label: "HIGH     " },
  critical: { color: C.red,     icon: "🔴", label: "CRITICAL " },
};

// ── Seuils indicatifs pour évaluer le niveau côté backend ─────
const LIMITS = {
  CO2:  { warning: 640,  high: 800,  critical: 960  },
  NOX:  { warning: 400,  high: 500,  critical: 600  },
  SO2:  { warning: 240,  high: 300,  critical: 360  },
  PM25: { warning: 12,   high: 25,   critical: 50   },
  PM10: { warning: 15,   high: 30,   critical: 60   },
  COV:  { warning: 88,   high: 110,  critical: 132  },
};

function detectLevel(sensorType, value) {
  const limit = LIMITS[sensorType?.toUpperCase()];
  if (!limit) return "normal";
  if (value >= limit.critical) return "critical";
  if (value >= limit.high)     return "high";
  if (value >= limit.warning)  return "warning";
  return "normal";
}

// ── Statistiques ──────────────────────────────────────────────
let stats = {
  received: 0,
  processed: 0,
  errors: 0,
  alerts: { warning: 0, high: 0, critical: 0 },
  byZone: {},
  byPollutant: {},
  startTime: Date.now(),
  lastMessages: [], // ring buffer de 5 derniers
};

function timestamp() {
  return new Date().toLocaleTimeString("fr-FR", { hour12: false });
}

function separator(char = "─", len = 72) {
  return char.repeat(len);
}

function printHeader() {
  console.clear();
  console.log(C.bold + C.bgCyan + C.white);
  console.log("  ████████████████████████████████████████████████████████████  ");
  console.log("  ██   🖥️   MQTT MONITOR — CÔTÉ BACKEND                      ██  ");
  console.log("  ██   Broker  : " + BROKER.padEnd(43) + "██  ");
  console.log("  ██   Topic   : emissions/#   (subscription wildcard)      ██  ");
  console.log("  ██   Action  : Réception → Validation → MongoDB → Alertes ██  ");
  console.log("  ████████████████████████████████████████████████████████████  ");
  console.log(C.reset + "\n");
}

function printMessage(topic, data) {
  stats.received++;

  // Extraire zone et polluant du topic : emissions/<zone>/<polluant>
  const parts = topic.split("/");
  const zone  = parts[1] || "?";
  const ptype = parts[2] || data.sensorType || "?";

  // Comptage
  stats.byZone[zone] = (stats.byZone[zone] || 0) + 1;
  stats.byPollutant[ptype] = (stats.byPollutant[ptype] || 0) + 1;

  // Niveau
  const level = data.level || detectLevel(ptype, data.value);
  const style = LEVEL_STYLE[level] || LEVEL_STYLE.normal;

  // Alertes
  if (level === "warning")  stats.alerts.warning++;
  if (level === "high")     stats.alerts.high++;
  if (level === "critical") stats.alerts.critical++;

  // Ring buffer
  stats.lastMessages.unshift({ topic, level, value: data.value, unit: data.unit, ts: timestamp() });
  if (stats.lastMessages.length > 5) stats.lastMessages.pop();

  // ── Affichage ────────────────────────────────────────────────
  console.log(C.dim + separator() + C.reset);

  // Horodatage + topic
  console.log(
    `${C.dim}[${timestamp()}]${C.reset} ` +
    `${C.bold}${C.blue}RECEIVE${C.reset} ` +
    `${C.dim}←${C.reset} ` +
    `${C.bold}${C.cyan}${topic}${C.reset}`
  );

  // Badge niveau + valeur
  process.stdout.write(`  ${style.icon}  `);
  process.stdout.write(`${C.bold}${style.color}[${style.label}]${C.reset}  `);
  console.log(
    `${C.bold}${style.color}${String(data.value).padStart(8)} ${data.unit || "?"}${C.reset}  ` +
    `${C.dim}modèle: ${data.model || "?"}${C.reset}`
  );

  // Informations de traitement (flux backend)
  console.log(`  ${C.dim}┌─ Pipeline traitement:${C.reset}`);

  // Résolution capteur
  if (data.sensorId) {
    console.log(`  ${C.dim}│  ${C.reset}${C.green}✓${C.reset} sensorId direct   : ${C.cyan}${data.sensorId}${C.reset}`);
    stats.processed++;
  } else if (data.nodeId) {
    console.log(`  ${C.dim}│  ${C.reset}${C.yellow}~${C.reset} nodeId fallback    : ${C.cyan}${data.nodeId}${C.reset}`);
    stats.processed++;
  } else {
    console.log(`  ${C.dim}│  ${C.reset}${C.red}✗${C.reset} ${C.red}Pas de sensorId — résolution par type+modèle${C.reset}`);
    stats.errors++;
  }

  // Polluant
  console.log(
    `  ${C.dim}│  ${C.reset}${C.green}✓${C.reset} sensorType        : ` +
    `${C.bold}${C.magenta}${ptype}${C.reset}`
  );

  // Zone
  console.log(
    `  ${C.dim}│  ${C.reset}${C.green}✓${C.reset} zone              : ` +
    `${C.bold}${C.white}${zone}${C.reset}`
  );

  // Alerte potentielle
  if (level !== "normal") {
    console.log(
      `  ${C.dim}│  ${C.reset}${style.icon} ${C.bold}${style.color}ALERTE potentielle : ` +
      `${ptype} = ${data.value} ${data.unit} [${level.toUpperCase()}]${C.reset}`
    );
  } else {
    console.log(`  ${C.dim}│  ${C.reset}${C.green}✓${C.reset} Valeur normale — pas d'alerte`);
  }

  // Validation
  if (data.isValid === false) {
    console.log(`  ${C.dim}│  ${C.reset}${C.red}✗ isValid=false — lecture rejetée par ReadingService${C.reset}`);
  } else {
    console.log(`  ${C.dim}│  ${C.reset}${C.green}✓${C.reset} isValid → stockage MongoDB`);
  }

  console.log(`  ${C.dim}└─ ingestReading() appelé — topic: ${topic}${C.reset}`);
}

function printStats() {
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  const rps     = elapsed > 0 ? (stats.received / elapsed).toFixed(2) : "0.00";

  console.log("\n" + C.bold + C.bgGreen + C.white);
  console.log("  📊 STATISTIQUES BACKEND — RÉCEPTION MQTT  ");
  console.log(C.reset);
  console.log(separator("─", 55));
  console.log(`  Messages reçus      : ${C.bold}${stats.received}${C.reset}`);
  console.log(`  Traitement OK       : ${C.green}${C.bold}${stats.processed}${C.reset}`);
  console.log(`  Erreurs             : ${C.red}${C.bold}${stats.errors}${C.reset}`);
  console.log(`  Durée active        : ${C.bold}${elapsed}s${C.reset}  |  Débit: ${C.bold}${rps} msg/s${C.reset}`);
  console.log(separator("─", 55));

  // Alertes déclenchées
  console.log(`  Alertes générées :`);
  console.log(`    🟡 Warning  : ${C.yellow}${String(stats.alerts.warning).padStart(5)}${C.reset}`);
  console.log(`    🟠 High     : ${C.magenta}${String(stats.alerts.high).padStart(5)}${C.reset}`);
  console.log(`    🔴 Critical : ${C.red}${String(stats.alerts.critical).padStart(5)}${C.reset}`);
  console.log(separator("─", 55));

  // Par zone
  if (Object.keys(stats.byZone).length > 0) {
    console.log(`  Messages par zone :`);
    Object.entries(stats.byZone).forEach(([z, n]) => {
      const bar = "█".repeat(Math.min(Math.floor(n / 3), 20));
      console.log(`    ${C.cyan}${z.padEnd(22)}${C.reset} ${C.blue}${bar}${C.reset} ${n}`);
    });
    console.log(separator("─", 55));
  }

  // Par polluant
  if (Object.keys(stats.byPollutant).length > 0) {
    console.log(`  Messages par polluant :`);
    Object.entries(stats.byPollutant)
      .sort((a, b) => b[1] - a[1])
      .forEach(([p, n]) => {
        const bar = "█".repeat(Math.min(Math.floor(n / 2), 20));
        console.log(`    ${C.magenta}${p.padEnd(14)}${C.reset} ${C.green}${bar}${C.reset} ${n}`);
      });
  }

  // Derniers messages
  if (stats.lastMessages.length > 0) {
    console.log(separator("─", 55));
    console.log(`  Derniers messages reçus :`);
    stats.lastMessages.forEach(m => {
      const s = LEVEL_STYLE[m.level] || LEVEL_STYLE.normal;
      console.log(`    ${s.icon} ${C.dim}[${m.ts}]${C.reset} ${C.cyan}${m.topic.padEnd(30)}${C.reset} ${C.bold}${s.color}${String(m.value).padStart(8)} ${m.unit}${C.reset}`);
    });
  }

  console.log(separator("─", 55) + "\n");
}

// ── Connexion MQTT ────────────────────────────────────────────
printHeader();
console.log(`${C.cyan}🔌 Connexion au broker : ${BROKER}...${C.reset}\n`);

const client = mqtt.connect(BROKER, {
  clientId: "mqtt-monitor-backend-" + Math.random().toString(16).slice(2, 6),
  keepalive: 60,
  reconnectPeriod: 2000,
});

client.on("connect", () => {
  console.log(`${C.bold}${C.green}✅ Connecté au broker MQTT !${C.reset}`);
  console.log(`${C.dim}   En écoute sur : emissions/#${C.reset}`);
  console.log(`${C.dim}   Ce moniteur simule la vue du mqttService.js${C.reset}`);
  console.log(`${C.dim}   Appuyez sur Ctrl+C pour arrêter\n${C.reset}`);
  console.log(separator("═", 72) + "\n");

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
    stats.errors++;
    console.log(
      `${C.red}❌ [${timestamp()}] Payload JSON invalide sur ${topic} :${C.reset}\n` +
      `   ${payload.toString().slice(0, 120)}\n`
    );
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
  console.log(`\n${C.red}📵 Broker hors ligne — en attente de reconnexion${C.reset}`);
});

// ── Statistiques périodiques ──────────────────────────────────
setInterval(printStats, 30000);

// ── Arrêt propre ──────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log(`\n\n${C.bold}${C.yellow}🛑 Arrêt du moniteur backend...${C.reset}`);
  printStats();
  client.end(() => {
    console.log(`${C.green}✅ Connexion fermée proprement.${C.reset}\n`);
    process.exit(0);
  });
});
