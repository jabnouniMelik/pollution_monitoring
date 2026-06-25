/**
 * @file main.cpp
 * @brief Point d'entrée firmware — station de surveillance de pollution (ESP32).
 *
 * Rôle du programme :
 *   1. Initialiser les capteurs (sensorsBegin).
 *   2. Se connecter au WiFi puis au broker MQTT (Mosquitto).
 *   3. Publier périodiquement des mesures JSON sur topics emissions/<zone>/<type>.
 *
 * Flux aligné sur le backend Node.js :
 *   ESP32 → MQTT → mqttService.js → ReadingService → MongoDB + alertes
 *
 * Capteurs actifs :
 *   - MH-Z19B  : CO₂ NDIR (UART Serial2)
 *   - MQ-136   : SO₂ MOS (ADC GPIO33 via pont diviseur)
 *   - MQ-131   : NOx MOS (ADC GPIO34 via pont diviseur)
 *   - SGP30    : COV / TVOC (I²C)
 *   - SDS011   : PM2.5 / PM10 laser (UART Serial1)
 *   - DHT22    : Température / Humidité (1-wire GPIO4)
 *
 * Alimentation :
 *   Bloc 5V/3A → fusible 1A → diode 1N4007 → MB102 + LM2596 → 3,3V / 5V bus
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#include "config.h"
#include "sensors.h"

// Client TCP sous-jacent + couche MQTT (non-TLS en développement).
static WiFiClient   wifiClient;
static PubSubClient mqtt(wifiClient);

// Horodatage de la dernière publication par famille de capteurs (non bloquant).
static unsigned long lastCo2Ms = 0;
static unsigned long lastPmMs  = 0;
static unsigned long lastGasMs = 0;
static unsigned long lastEnvMs = 0;

/**
 * Déduit le niveau d'alerte indicatif à partir des seuils locaux.
 * @return "normal" | "warning" | "high" | "critical"
 */
static const char *levelFromValue(float value, const ThresholdBand &t) {
  if (value >= t.criticalMin) return "critical";
  if (value >= t.highMin)     return "high";
  if (value >= t.warningMin)  return "warning";
  return "normal";
}

/**
 * Connexion WiFi en mode station (STA).
 * Bloque jusqu'à connexion — acceptable au démarrage.
 */
static void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[WiFi] Connexion à %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connecté — IP: %s\n", WiFi.localIP().toString().c_str());
}

/**
 * Connexion au broker MQTT avec reconnexion automatique.
 * Buffer 512 octets : taille suffisante pour un message JSON typique (~380 octets).
 */
static void connectMqtt() {
  if (mqtt.connected()) return;
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setBufferSize(512);
  while (!mqtt.connected()) {
    Serial.printf("[MQTT] Connexion %s:%d...\n", MQTT_BROKER, MQTT_PORT);
    if (mqtt.connect(MQTT_CLIENT_ID)) {
      Serial.println("[MQTT] Connecté");
      return;
    }
    Serial.printf("[MQTT] Échec rc=%d, nouvelle tentative dans 3 s\n", mqtt.state());
    delay(3000);
  }
}

/**
 * Horodatage ISO 8601 UTC pour le champ "timestamp" du backend.
 * Nécessite configTime() + synchronisation NTP dans setup().
 */
static String isoTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "";
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

/**
 * Publie une mesure sur le topic MQTT attendu par le projet.
 *
 * Topic   : emissions/<NODE_ZONE>/<sensorType>
 * Exemple : emissions/Zone-A/SO2
 *
 * @param sensorType Code polluant (SO2, NO2, CO2, PM25, …) — doit exister en BDD.
 * @param model      Référence hardware (MQ-136, MQ-131, MH-Z19B, …).
 * @param unit       Unité physique (ppm, µg/m³, mg/Nm³, °C, %RH).
 * @param value      Valeur traitée (ppm, µg/m³, …).
 * @param rawValue   Valeur brute (tension ADC en V pour MQ, ppb pour SGP30, identique sinon).
 * @param level      Niveau indicatif calculé localement.
 * @param isValid    false si capteur en défaut (le backend stocke mais n'alerte pas).
 */
static void publishReading(const char *sensorType, const char *model,
                           const char *unit, float value, float rawValue,
                           const char *level, bool isValid) {
  const String topic = String("emissions/") + NODE_ZONE + "/" + sensorType;

  JsonDocument doc;
  doc["sensorType"] = sensorType;
  doc["model"]      = model;
  doc["zone"]       = NODE_ZONE;
  doc["nodeName"]   = NODE_NAME;
  doc["value"]      = value;
  doc["rawValue"]   = rawValue;
  doc["unit"]       = unit;
  doc["level"]      = level;
  doc["timestamp"]  = isoTimestamp();
  doc["isValid"]    = isValid;
  doc["rssi"]       = WiFi.RSSI();  // Qualité du lien WiFi (dBm)
  doc["battery"]    = nullptr;      // Station sur secteur — pas de batterie

  char payload[384];
  serializeJson(doc, payload, sizeof(payload));

  if (mqtt.publish(topic.c_str(), payload, false)) {
    Serial.printf("[MQTT] %s → %.3f %s [%s]\n", sensorType, value, unit, level);
  } else {
    Serial.printf("[MQTT] Échec publication %s\n", sensorType);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions de publication par famille de capteurs
// ─────────────────────────────────────────────────────────────────────────────

/** MH-Z19B — dioxyde de carbone (NDIR, très sélectif CO₂). */
static void publishCo2() {
  int ppm = 0;
  if (!readCo2(ppm)) return;
  const ThresholdBand t = {640.0f, 800.0f, 960.0f};
  publishReading("CO2", "MH-Z19B", "ppm",
                 static_cast<float>(ppm), static_cast<float>(ppm),
                 levelFromValue(static_cast<float>(ppm), t), true);
}

/** SDS011 — une lecture UART fournit PM2.5 et PM10 (deux publications MQTT). */
static void publishParticulates() {
  const PmReading pm = readParticulates();
  if (!pm.valid) return;

  // VLE PM (Décret 2018-928, Annexe 1, §1) = 40 mg/m³ (flux > 1 kg/h).
  // Le SDS011 mesure en µg/m³ et plafonne à ~999 µg/m³ = ~1 mg/m³, soit bien
  // en dessous de la VLE cheminée (40 000 µg/m³). Ce capteur est adapté à la
  // surveillance de l'air ambiant en périmètre du site (limitation du prototype).
  // Les seuils ci-dessous sont des indicateurs de qualité d'air ambiant (µg/m³) :
  //   PM2.5 : WHO 2021 : 15 µg/m³ annuel / 25 µg/m³ 24h → seuils indicatifs
  //   PM10  : WHO 2021 : 45 µg/m³ annuel / 75 µg/m³ 24h → seuils indicatifs
  const ThresholdBand tPm25 = {12.0f, 25.0f, 50.0f};   // µg/m³ : WHO ambient indicatif
  publishReading("PM25", "SDS011", "µg/m³", pm.pm25, pm.pm25,
                 levelFromValue(pm.pm25, tPm25), true);

  const ThresholdBand tPm10 = {36.0f, 75.0f, 150.0f};  // µg/m³ : WHO ambient indicatif
  publishReading("PM10", "SDS011", "µg/m³", pm.pm10, pm.pm10,
                 levelFromValue(pm.pm10, tPm10), true);
}

/** DHT22 — contexte météo local (TEMPERATURE et HUMIDITY). */
static void publishEnvironment() {
  const EnvReading env = readEnvironment();
  if (!env.valid) return;

  const ThresholdBand tTemp = {28.0f, 35.0f, 42.0f};
  const ThresholdBand tHum  = {48.0f, 60.0f, 72.0f};
  publishReading("TEMPERATURE", "DHT22", "°C",
                 env.temperature, env.temperature,
                 levelFromValue(env.temperature, tTemp), true);
  publishReading("HUMIDITY", "DHT22", "%RH",
                 env.humidity, env.humidity,
                 levelFromValue(env.humidity, tHum), true);
}

/**
 * Gaz MOS (MQ-136 SO₂, MQ-131 NOx) + COV (SGP30).
 * Publiés toutes les INTERVAL_GAS_MS.
 *
 * Seuils locaux en mg/Nm³ (indicatifs, alignés sur le Décret 2018-928, Annexe 1) :
 *   SO₂  VLE = 300 mg/Nm³  → warning 240, high 300, critical 360
 *   NOₓ  VLE = 500 mg/Nm³  → warning 400, high 500, critical 600
 *   COV  VLE = 110 mg/Nm³  → warning 88,  high 110, critical 132
 *
 * Note : les valeurs MQ sont semi-quantitatives sans calibration R0 terrain.
 * Le backend recalcule les alertes officielles depuis MongoDB (regulatoryLimit).
 */
static void publishGases() {
  // MQ-136 — dioxyde de soufre (SO₂)
  // VLE = 300 mg/Nm³ — Décret 2018-928, Annexe 1, §3
  const GasReading so2 = readSo2();
  if (so2.valid) {
    const ThresholdBand tSo2 = {240.0f, 300.0f, 360.0f};
    publishReading("SO2", "MQ-136", "mg/Nm³",
                   so2.value, so2.rawValue,
                   levelFromValue(so2.value, tSo2), true);
  } else {
    Serial.println("[SO2] Lecture invalide (ADC hors plage)");
  }

  // MQ-131 — oxydes d'azote (NOx)
  // VLE = 500 mg/Nm³ — Décret 2018-928, Annexe 1, §4
  // Note : le MQ-131 est sensible à NOx + O₃ (mesure combinée, non sélective).
  const GasReading nox = readNox();
  if (nox.valid) {
    const ThresholdBand tNox = {400.0f, 500.0f, 600.0f};
    publishReading("NOX", "MQ-131", "mg/Nm³",
                   nox.value, nox.rawValue,
                   levelFromValue(nox.value, tNox), true);
  } else {
    Serial.println("[NOX] Lecture invalide (ADC hors plage)");
  }

  // SGP30 — composés organiques volatils (COV / TVOC)
  // VLE = 110 mg/Nm³ — Décret 2018-928, Annexe 1, §7
  const GasReading cov = readCov();
  if (cov.valid) {
    const ThresholdBand tCov = {88.0f, 110.0f, 132.0f};
    publishReading("COV", "SGP30", "mg/Nm³",
                   cov.value, cov.rawValue,
                   levelFromValue(cov.value, tCov), true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup & Loop
// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Station surveillance pollution — ESP32 ===");
  Serial.printf("Nœud: %s | Zone: %s\n", NODE_NAME, NODE_ZONE);

  // Synchronisation horloge NTP pour timestamps MQTT ISO 8601 UTC.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  sensorsBegin();
  connectWiFi();
  connectMqtt();
}

void loop() {
  // Maintien des connexions réseau (reconnexion automatique si coupure).
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected())             connectMqtt();
  mqtt.loop();  // Traite les keep-alive MQTT et callbacks entrants

  const unsigned long now = millis();

  // Planification non bloquante : chaque famille de capteurs à son propre rythme.
  if (now - lastCo2Ms >= INTERVAL_CO2_MS) {
    lastCo2Ms = now;
    publishCo2();
  }
  if (now - lastPmMs >= INTERVAL_PM_MS) {
    lastPmMs = now;
    publishParticulates();
  }
  if (now - lastGasMs >= INTERVAL_GAS_MS) {
    lastGasMs = now;
    publishGases();
  }
  if (now - lastEnvMs >= INTERVAL_ENV_MS) {
    lastEnvMs = now;
    publishEnvironment();
  }

  delay(50);  // Laisse du temps au watchdog et au stack WiFi
}
