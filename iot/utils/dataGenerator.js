// ============================================================
// GÉNÉRATEUR DE DONNÉES RÉALISTES — version mise à jour
// Compatible avec la nouvelle structure thresholds
//
// Nouvelle structure :
// thresholds.warning  → approche du seuil
// thresholds.high     → dépassement modéré
// thresholds.critical → dépassement grave
// ============================================================

const SIMULATOR_CONFIG = require("../config/simulatorConfig");

// ── État interne : valeur courante de chaque capteur ─────────
const currentValues = {};

// ── Initialisation des valeurs de départ ─────────────────────
const initializeValues = () => {
  const { sensors } = SIMULATOR_CONFIG;
  Object.keys(sensors).forEach((sensorKey) => {
    const sensor = sensors[sensorKey];
    // Valeur de départ = milieu de la plage normale
    currentValues[sensorKey] = (sensor.range.min + sensor.range.max) / 2;
  });
  console.log("✅ Valeurs initiales des capteurs initialisées");
};

// ── Fonction utilitaire : nombre aléatoire entre min et max ──
const randomBetween = (min, max) => {
  return Math.random() * (max - min) + min;
};

// ── Fonction utilitaire : arrondir à N décimales ─────────────
const roundTo = (value, decimals = 2) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

// ── Déterminer la plage cible selon le scénario ──────────────
// Utilise la nouvelle structure thresholds
const getTargetRange = (sensor, scenario) => {
  if (scenario === "normal") {
    return sensor.range;
  }

  if (scenario === "warning") {
    return sensor.thresholds.warning;
  }

  if (scenario === "high") {
    return sensor.thresholds.high;
  }

  if (scenario === "critical") {
    return sensor.thresholds.critical;
  }

  // Scénario RANDOM — probabilités pondérées
  // 65% normal, 15% warning, 12% high, 8% critical
  const rand = Math.random();
  if (rand < 0.65) return sensor.range;
  else if (rand < 0.8) return sensor.thresholds.warning;
  else if (rand < 0.92) return sensor.thresholds.high;
  else return sensor.thresholds.critical;
};

// ── Générer une valeur avec marche aléatoire ─────────────────
const generateValue = (sensorKey, scenario = "random") => {
  const sensor = SIMULATOR_CONFIG.sensors[sensorKey];
  if (!sensor) return null;

  // Plage cible selon le scénario
  const targetRange = getTargetRange(sensor, scenario);

  // ── Marche aléatoire ──────────────────────────────────────
  // Variation max = 5% de la plage totale par mesure
  const totalRange = sensor.thresholds.critical.max - sensor.range.min;
  const maxVariation = totalRange * 0.05;

  // Valeur actuelle + petite variation aléatoire
  let newValue =
    currentValues[sensorKey] + randomBetween(-maxVariation, maxVariation);

  // Attirer la valeur vers la plage cible (effet "gravité")
  const targetMid = (targetRange.min + targetRange.max) / 2;
  const attraction = 0.1;
  newValue = newValue + (targetMid - newValue) * attraction;

  // Contraindre dans les limites physiques du capteur
  newValue = Math.max(sensor.range.min * 0.5, newValue);
  newValue = Math.min(sensor.thresholds.critical.max * 1.1, newValue);

  // Sauvegarder pour la prochaine mesure
  currentValues[sensorKey] = newValue;

  return roundTo(newValue, 2);
};

// ── Déterminer le niveau d'une valeur ─────────────────────────
// Utilise la nouvelle structure thresholds
const getValueLevel = (value, sensor) => {
  if (value >= sensor.thresholds.critical.min) return "critical";
  if (value >= sensor.thresholds.high.min) return "high";
  if (value >= sensor.thresholds.warning.min) return "warning";
  return "normal";
};

// ── Générer un message MQTT complet ──────────────────────────
const generateMQTTMessage = (sensorKey, scenario = "random", node = SIMULATOR_CONFIG.node) => {
  const sensor = SIMULATOR_CONFIG.sensors[sensorKey];
  const value = generateValue(sensorKey, scenario);
  if (value === null) return null;

  const level = getValueLevel(value, sensor);

  return {
    // Identification
    sensorType: sensor.type,
    model: sensor.model,
    zone: node.zone || SIMULATOR_CONFIG.node.zone,
    nodeName: node.name || SIMULATOR_CONFIG.node.name,

    // Mesure
    value,
    rawValue: roundTo(value * (1 + randomBetween(-0.01, 0.01)), 2),
    unit: sensor.unit,

    // Niveau d'alerte calculé côté simulateur
    level, // 'normal' | 'warning' | 'high' | 'critical'

    // Métadonnées
    timestamp: new Date().toISOString(),
    isValid: true,
    rssi: Math.floor(randomBetween(-85, -45)),
    battery: null,
  };
};

// ── Obtenir toutes les valeurs courantes ──────────────────────
const getCurrentValues = () => {
  return Object.keys(currentValues).reduce((acc, key) => {
    const sensor = SIMULATOR_CONFIG.sensors[key];
    const value = roundTo(currentValues[key], 2);
    const level = getValueLevel(value, sensor);

    acc[key] = {
      value,
      unit: sensor.unit,
      model: sensor.model,
      level, // niveau d'alerte courant
    };
    return acc;
  }, {});
};

module.exports = {
  initializeValues,
  generateValue,
  generateMQTTMessage,
  getCurrentValues,
  getValueLevel,
};
