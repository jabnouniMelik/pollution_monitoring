// ============================================================
// SIMULATEUR IoT PRINCIPAL — version mise à jour
// Compatible avec nouvelle structure thresholds
//
// 4 niveaux d'alerte :
// 🟢 normal   → valeurs dans la plage normale
// 🟡 warning  → approche du seuil
// 🟠 high     → dépassement modéré
// 🔴 critical → dépassement grave
// ============================================================

require("dotenv").config();
const mqtt = require("mqtt");
const SIMULATOR_CONFIG = require("./config/simulatorConfig");
const {
  initializeValues,
  generateMQTTMessage,
  getCurrentValues,
  getValueLevel,
} = require("./utils/dataGenerator");

// Scénario : node simulator.js [random|normal|warning|high|critical]
const SCENARIO = process.argv[2] || "random";

// Valider le scénario
const validScenarios = ["random", "normal", "warning", "high", "critical"];
if (!validScenarios.includes(SCENARIO)) {
  console.error(` Scénario invalide : ${SCENARIO}`);
  console.error(`   Valeurs acceptées : ${validScenarios.join(", ")}`);
  process.exit(1);
}

console.log(`
╔══════════════════════════════════════════════════╗
║     SIMULATEUR IoT — Émissions Industrielles     ║
║     Système : ${SIMULATOR_CONFIG.node.name}         ║
║     Zone    : ${SIMULATOR_CONFIG.node.zone}                    ║
║     Scénario: ${SCENARIO.toUpperCase().padEnd(34)}║
╚══════════════════════════════════════════════════╝
`);

// ── Icônes par niveau ─────────────────────────────────────────
const LEVEL_ICONS = {
  normal: "🟢",
  warning: "🟡",
  high: "🟠",
  critical: "🔴",
};

// ── Connexion au broker Mosquitto ─────────────────────────────
const client = mqtt.connect(SIMULATOR_CONFIG.mqtt.broker, {
  ...SIMULATOR_CONFIG.mqtt.options,
  clientId: SIMULATOR_CONFIG.mqtt.clientId,
});

const intervals = [];
const nodes = SIMULATOR_CONFIG.nodes || [SIMULATOR_CONFIG.node];

// ── Événement : Connexion réussie ─────────────────────────────
client.on("connect", () => {
  console.log(`✅ Connecté au broker MQTT : ${SIMULATOR_CONFIG.mqtt.broker}`);
  console.log(`📡 Démarrage de la simulation...\n`);

  initializeValues();

  const { sensors } = SIMULATOR_CONFIG;

  console.log("┌─────────────────────────────────────────────────┐");
  console.log("│              Capteurs configurés                 │");
  console.log("├──────────────┬──────────────────────┬───────────┤");
  console.log("│ Type         │ Modèle               │ Fréquence │");
  console.log("├──────────────┼──────────────────────┼───────────┤");

  Object.keys(sensors).forEach((sensorKey) => {
    const sensor = sensors[sensorKey];
    console.log(
      `│ ${sensor.type.padEnd(12)} │ ${sensor.model.padEnd(20)} │ ${String(sensor.interval / 1000 + "s").padEnd(9)} │`,
    );
  });

  console.log("└──────────────┴──────────────────────┴───────────┘\n");

  // Démarrer chaque capteur sur chaque zone simulée
  nodes.forEach((node) => {
    Object.keys(sensors).forEach((sensorKey) => {
      const sensor = sensors[sensorKey];

      // Première mesure immédiate
      publishReading(sensorKey, sensor, node);

      // Puis selon l'interval du capteur
      const timer = setInterval(() => {
        publishReading(sensorKey, sensor, node);
      }, sensor.interval);

      intervals.push(timer);
    });
  });

  console.log(
    `\n📊 Simulation active — ${Object.keys(sensors).length} capteurs × ${nodes.length} zones\n`,
  );

  // Résumé toutes les 60 secondes
  const summaryTimer = setInterval(() => {
    console.log("\n┌──────────────────────────────────────────────────┐");
    console.log("│              Valeurs courantes                    │");
    console.log("├──────────────┬───────────┬──────────┬────────────┤");
    console.log("│ Capteur      │ Valeur    │ Unité    │ Niveau     │");
    console.log("├──────────────┼───────────┼──────────┼────────────┤");

    const values = getCurrentValues();
    Object.entries(values).forEach(([key, data]) => {
      const icon = LEVEL_ICONS[data.level] || "⚪";
      console.log(
        `│ ${key.padEnd(12)} │ ${String(data.value).padEnd(9)} │ ${data.unit.padEnd(8)} │ ${icon} ${data.level.padEnd(8)} │`,
      );
    });
    console.log("└──────────────┴───────────┴──────────┴────────────┘\n");
  }, 60000);

  intervals.push(summaryTimer);
});

// ── Fonction : Publier une mesure ─────────────────────────────
const publishReading = (sensorKey, sensor, node = SIMULATOR_CONFIG.node) => {
  const message = generateMQTTMessage(sensorKey, SCENARIO, node);
  if (!message) return;

  const payload = JSON.stringify(message);
  const topic = `emissions/${node.zone}/${sensor.type}`;

  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(` Erreur publication ${sensor.type}:`, err.message);
      return;
    }

    const icon = LEVEL_ICONS[message.level] || "⚪";

    console.log(
      `${icon} [${new Date().toLocaleTimeString()}] ` +
        `[${node.zone}] ${sensor.type.padEnd(12)} : ` +
        `${String(message.value).padStart(8)} ${message.unit.padEnd(8)} ` +
        `[${message.level.toUpperCase()}]`,
    );
  });
};

// ── Événements MQTT ───────────────────────────────────────────
client.on("error", (err) => {
  console.error(" Erreur MQTT:", err.message);
});

client.on("reconnect", () => {
  console.log(" Reconnexion au broker MQTT...");
});

client.on("disconnect", () => {
  console.log(" Déconnecté du broker MQTT");
});

// ── Arrêt propre ──────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n\n🛑 Arrêt du simulateur...");
  intervals.forEach((timer) => clearInterval(timer));
  client.end(() => {
    console.log(" Connexion MQTT fermée proprement");
    process.exit(0);
  });
});
