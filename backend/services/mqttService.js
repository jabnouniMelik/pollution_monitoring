// ============================================================
// SERVICE MQTT — BACKEND
// S'abonne au broker et traite les messages des capteurs
//
// Flux :
// Simulateur → MQTT Broker → mqttService → MongoDB
//                                        → Moteur alertes
//
// Topics écoutés : emissions/# (tous les polluants, toutes zones)
// ============================================================

require("dotenv").config();
const mqtt = require("mqtt");
const readingService = require("./ReadingService");
const Sensor = require("../models/Sensor");
const Polluant = require("../models/Polluant");

// ── Broker MQTT ───────────────────────────────────────────────
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";

// Verbose per-message MQTT logs are gated behind DEBUG_MQTT=true.
// At typical simulator rates (6+ sensors × sub-second cadence) the default
// per-message logging would flood stdout and add significant memory pressure.
const DEBUG_MQTT = process.env.DEBUG_MQTT === "true";
const mlog = DEBUG_MQTT ? console.log.bind(console) : () => {};

// ── Traitement d'un message MQTT reçu ────────────────────────
// Délègue toute la logique métier à ReadingService
// Cela inclut validation, création de Reading, et déclenchement des alertes
const processMessage = async (topic, payload) => {
  try {
    // Parser le message JSON
    const data = JSON.parse(payload.toString());

    mlog(
      `📥 [MQTT] Reçu — Topic: ${topic} | Type: ${data.sensorType} | Valeur: ${data.value} ${data.unit}`,
    );

    // ── MAPPER : MQTT Message → ReadingService Format ──────────────────
    // Le simulateur envoie: {sensorType, model, value, unit, ...}
    // ReadingService s'attend: {sensorId, polluantId, nodeId, value, unit, ...}

    // Récupérer l'ID du capteur depuis la DB via type + model
    const sensor = await Sensor.findOne({
      type: data.sensorType,
      model: data.model,
    }).lean();

    if (!sensor) {
      console.warn(
        `⚠️  [MQTT] Capteur non trouvé: ${data.sensorType} (${data.model})`,
      );
      return;
    }

    // Récupérer l'ID du polluant depuis la DB via name
    const polluant = await Polluant.findOne({ name: data.sensorType }).lean();
    if (!polluant) {
      console.warn(`⚠️  [MQTT] Polluant non trouvé: ${data.sensorType}`);
      return;
    }

    // Construire le payload pour ReadingService
    const readingPayload = {
      sensorId: sensor._id.toString(),
      polluantId: polluant._id.toString(),
      nodeId: sensor.sensorNodeId?.toString() || null,
      value: data.value,
      unit: data.unit,
      rawValue: data.rawValue || data.value,
      isValid: data.isValid !== false,
      timestamp: data.timestamp || new Date(),
    };

    // Injecter la Reading et déclencher le moteur d'alertes via ReadingService
    // ReadingService gère :
    // - Validation du capteur et du polluant
    // - Validation de la mesure
    // - Stockage en MongoDB
    // - Création d'alertes si seuils dépassés
    await readingService.ingestReading(readingPayload);

    mlog(
      `✅ [MQTT] Message traité — ${data.sensorType}: ${data.value} ${data.unit}`,
    );
  } catch (err) {
    console.error("❌ [MQTT] Erreur traitement message:", err.message);
    // Continue processing other messages even if one fails
  }
};

// ── Démarrer le service MQTT ──────────────────────────────────
const startMQTTService = () => {
  const client = mqtt.connect(MQTT_BROKER, {
    clientId: "pollution-backend-" + Math.random().toString(16).slice(2, 8),
    keepalive: 60,
    reconnectPeriod: 2000,
  });

  // Connexion réussie
  client.on("connect", () => {
    console.log(`✅ [MQTT Service] Connecté au broker: ${MQTT_BROKER}`);

    // S'abonner à TOUS les topics emissions
    // emissions/# = emissions/Zone-A/CO2, emissions/Zone-B/NOX, etc.
    client.subscribe("emissions/#", { qos: 1 }, (err) => {
      if (err) {
        console.error("❌ [MQTT] Erreur subscription:", err.message);
        return;
      }
      console.log("📡 [MQTT Service] Abonné au topic: emissions/#");
    });
  });

  // Message reçu
  client.on("message", async (topic, payload) => {
    await processMessage(topic, payload);
  });

  // Erreurs
  client.on("error", (err) => {
    console.error("❌ [MQTT Service] Erreur:", err.message);
  });

  client.on("reconnect", () => {
    console.log("🔄 [MQTT Service] Reconnexion...");
  });

  return client;
};

module.exports = { startMQTTService };
