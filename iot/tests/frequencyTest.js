// ============================================================
// TEST DE FRÉQUENCE ET RÉCEPTION — version mise à jour
// Compatible avec nouvelle structure thresholds
// ============================================================

require("dotenv").config();
const mqtt = require("mqtt");
const SIMULATOR_CONFIG = require("../config/simulatorConfig");
const { getValueLevel } = require("../utils/dataGenerator");

console.log("🧪 Démarrage des tests de fréquence...\n");
console.log("⏱️  Durée du test : 2 minutes\n");

// ── Statistiques par capteur ──────────────────────────────────
const stats = {};
Object.keys(SIMULATOR_CONFIG.sensors).forEach((key) => {
  stats[key] = {
    received: 0,
    lastReceived: null,
    intervals: [],
    expectedInterval: SIMULATOR_CONFIG.sensors[key].interval,
    values: [],
    // Compteur par niveau
    levels: { normal: 0, warning: 0, high: 0, critical: 0 },
  };
});

const LEVEL_ICONS = {
  normal: "🟢",
  warning: "🟡",
  high: "🟠",
  critical: "🔴",
};

// ── Connexion au broker ───────────────────────────────────────
const client = mqtt.connect(SIMULATOR_CONFIG.mqtt.broker);

client.on("connect", () => {
  console.log("✅ Connecté au broker MQTT — Mode écoute\n");
  client.subscribe("emissions/#", { qos: 1 });
  console.log("👂 Écoute sur emissions/# ...\n");
});

client.on("message", (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());

    // Trouver la clé correspondante
    const statKey = Object.keys(stats).find(
      (k) => SIMULATOR_CONFIG.sensors[k]?.type === data.sensorType,
    );
    if (!statKey) return;

    const now = Date.now();
    const stat = stats[statKey];
    const sensor = SIMULATOR_CONFIG.sensors[statKey];

    // Calculer l'interval
    if (stat.lastReceived) {
      stat.intervals.push(now - stat.lastReceived);
    }

    stat.received++;
    stat.lastReceived = now;
    stat.values.push(data.value);

    // Compter par niveau (utilise nouvelle structure)
    const level = getValueLevel(data.value, sensor);
    if (stat.levels[level] !== undefined) stat.levels[level]++;

    const icon = LEVEL_ICONS[level] || "⚪";
    console.log(
      `📨 [${new Date().toLocaleTimeString()}] ` +
        `${data.sensorType.padEnd(12)} : ` +
        `${String(data.value).padStart(8)} ${data.unit.padEnd(8)} ` +
        `${icon} ${level.toUpperCase()}`,
    );
  } catch (err) {
    console.error("Erreur parsing:", err.message);
  }
});

// ── Rapport final après 2 minutes ────────────────────────────
setTimeout(
  () => {
    console.log("\n\n══════════════════════════════════════════════════════");
    console.log("              RAPPORT DE TEST DE FRÉQUENCE");
    console.log("══════════════════════════════════════════════════════\n");

    let allPassed = true;

    Object.entries(stats).forEach(([key, stat]) => {
      const sensor = SIMULATOR_CONFIG.sensors[key];
      const expected = sensor.interval;

      // Fréquence moyenne
      const avgInterval =
        stat.intervals.length > 0
          ? stat.intervals.reduce((a, b) => a + b, 0) / stat.intervals.length
          : 0;

      // Tolérance ±20%
      const tolerance = expected * 0.2;
      const passed =
        stat.intervals.length === 0 ||
        Math.abs(avgInterval - expected) <= tolerance;

      if (!passed) allPassed = false;

      const avgValue =
        stat.values.length > 0
          ? (
              stat.values.reduce((a, b) => a + b, 0) / stat.values.length
            ).toFixed(2)
          : 0;

      console.log(`${passed ? "✅" : "❌"} ${sensor.type} — ${sensor.model}`);
      console.log(`   Messages reçus    : ${stat.received}`);
      console.log(`   Interval attendu  : ${expected / 1000}s`);
      console.log(`   Interval moyen    : ${(avgInterval / 1000).toFixed(1)}s`);
      console.log(`   Valeur moyenne    : ${avgValue} ${sensor.unit}`);

      // Seuils de la nouvelle structure
      console.log(`   Seuils configurés :`);
      console.log(
        `     🟡 Warning  : ${sensor.thresholds.warning.min} → ${sensor.thresholds.warning.max}`,
      );
      console.log(
        `     🟠 High     : ${sensor.thresholds.high.min} → ${sensor.thresholds.high.max}`,
      );
      console.log(
        `     🔴 Critical : ${sensor.thresholds.critical.min} → ${sensor.thresholds.critical.max}`,
      );

      // Distribution des niveaux
      console.log(`   Distribution :`);
      console.log(`     🟢 Normal  : ${stat.levels.normal} mesures`);
      console.log(`     🟡 Warning : ${stat.levels.warning} mesures`);
      console.log(`     🟠 High    : ${stat.levels.high} mesures`);
      console.log(`     🔴 Critical: ${stat.levels.critical} mesures`);
      console.log("");
    });

    console.log("══════════════════════════════════════════════════════");
    console.log(
      allPassed
        ? "🎉 TOUS LES TESTS PASSÉS — Fréquences correctes !"
        : "⚠️  CERTAINS TESTS ONT ÉCHOUÉ — Vérifier le simulateur",
    );
    console.log("══════════════════════════════════════════════════════\n");

    client.end();
    process.exit(allPassed ? 0 : 1);
  },
  2 * 60 * 1000,
);
