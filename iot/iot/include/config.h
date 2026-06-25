/**
 * @file config.h
 * @brief Paramètres logiciels de la station ESP32 (réseau, MQTT, temporisation).
 *
 * Ce fichier centralise la configuration qui n'est pas liée au câblage GPIO
 * (voir pins.h). Les valeurs par défaut sont alignées sur le simulateur Node.js
 * du projet : iot/config/simulatorConfig.js
 *
 * Matériel visé (voir documentation/SCHEMA_ELECTRONIQUE.svg) :
 *   - ESP32 DevKit V1
 *   - MH-Z19B (CO₂ NDIR), MQ-136 (SO₂), MQ-131 (NOx), SGP30 (COV), SDS011 (PM), DHT22 (T°/HR)
 *   - Alimentation : bloc 5V/3A, MB102 + LM2596, fusible 1A, diode 1N4007
 */

#pragma once

// ─────────────────────────────────────────────────────────────────────────────
// Identification du nœud capteur (base MongoDB / dashboard)
// ─────────────────────────────────────────────────────────────────────────────
// NODE_NAME : nom affiché dans le backend (ex. fiche SensorNode).
// NODE_ZONE : segment du topic MQTT → emissions/<NODE_ZONE>/<sensorType>
#ifndef NODE_NAME
#define NODE_NAME "Station-Sfax-01"
#endif
#ifndef NODE_ZONE
#define NODE_ZONE "Zone-A"
#endif

// ─────────────────────────────────────────────────────────────────────────────
// Réseau WiFi et broker MQTT
// ─────────────────────────────────────────────────────────────────────────────
#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif
#ifndef MQTT_BROKER
#define MQTT_BROKER "192.168.1.100"  // IP du PC/serveur où tourne Mosquitto
#endif
#ifndef MQTT_PORT
#define MQTT_PORT 1883
#endif
#ifndef MQTT_CLIENT_ID
#define MQTT_CLIENT_ID "pollution-esp32-01"
#endif

// ─────────────────────────────────────────────────────────────────────────────
// Calibration capteurs MQ — résistance de charge et R0
// ─────────────────────────────────────────────────────────────────────────────
// Les capteurs MQ-136 et MQ-131 sont des capteurs à oxyde métallique (MOS).
// Principe : la résistance du matériau sensible (Rs) varie en présence du gaz.
// Le ratio Rs/R0 (où R0 = résistance en air propre) permet de calculer la
// concentration via la courbe de sensibilité log-linéaire du datasheet.
//
// MQ_RL_KOHM : résistance de charge du pont diviseur (kΩ).
//   Valeur recommandée : 10 kΩ. Influe sur la sensibilité du pont.
//
// MQ136_R0 / MQ131_R0 : résistances en air propre (kΩ).
//   À mesurer sur site après ≥ 24 h de chauffe en air propre.
//   Valeurs ci-dessous = estimations datasheet pour initialisation.
//   Procédure : lire la tension Vout en air propre → calculer Rs = RL × (Vcc/Vout - 1)
//   puis stocker Rs comme R0.
//
// MQ136_PPM_COEFF_A / B, MQ131_PPM_COEFF_A / B :
//   Coefficients de la courbe log-linéaire : ppm = A × (Rs/R0)^B
//   Extraits du datasheet Hanwei/Winsen pour la courbe SO₂ (MQ-136)
//   et NOx/O₃ (MQ-131). À affiner après calibration terrain.
//
// Tension d'alimentation du pont (pour calcul Rs) :
//   Le circuit MQ est alimenté en 5 V ; le diviseur résistif ramène la sortie
//   à ≤ 3,3 V pour l'ADC. La tension réelle du pont Vcc = 5,0 V.
#define MQ_RL_KOHM          10.0f    // Résistance de charge (kΩ)
#define MQ_VCC              5.0f     // Tension alimentation pont MQ (V)
#define MQ136_R0            10.0f    // R0 MQ-136 en air propre (kΩ) — à recalibrer
#define MQ131_R0            15.0f    // R0 MQ-131 en air propre (kΩ) — à recalibrer

// Courbe sensibilité MQ-136 (SO₂) — datasheet Hanwei
//   ppm_SO2 = MQ136_A × (Rs/R0)^MQ136_B
#define MQ136_A             36.7f
#define MQ136_B            -3.536f

// Courbe sensibilité MQ-131 (NOx) — datasheet Hanwei
//   ppm_NOx = MQ131_A × (Rs/R0)^MQ131_B
#define MQ131_A             23.943f
#define MQ131_B            -1.11f

// Diviseur résistif ADC : rapport de réduction 5V → ≤3,3V
// R_up = 10kΩ, R_down = 20kΩ → Vout_ADC = Vout_MQ × 20/(10+20) = Vout_MQ × 0.667
#define MQ_DIVIDER_RATIO    0.6667f  // Vout_ADC / Vout_MQ

// ─────────────────────────────────────────────────────────────────────────────
// Facteurs de conversion ppm → mg/Nm³ (0°C, 101.325 kPa)
// ─────────────────────────────────────────────────────────────────────────────
// Alignent les unités capteurs (ppm) avec les unités backend (mg/Nm³).
//   SO₂ : M = 64 g/mol → 1 ppm = 64/22.4 ≈ 2.86 mg/Nm³
//   NO₂ : M = 46 g/mol → 1 ppm = 46/22.4 ≈ 2.05 mg/Nm³
#define MQ136_SO2_PPM_TO_MG_NM3  2.86f
#define MQ131_NOX_PPM_TO_MG_NM3  2.05f

// ─────────────────────────────────────────────────────────────────────────────
// Nombre d'échantillons ADC pour moyennage (réduction du bruit)
// ─────────────────────────────────────────────────────────────────────────────
#define MQ_ADC_SAMPLES        16
#define MQ_ADC_SAMPLE_DELAY   5     // ms entre échantillons

// ─────────────────────────────────────────────────────────────────────────────
// Fréquences de publication MQTT (millisecondes)
// ─────────────────────────────────────────────────────────────────────────────
#define INTERVAL_CO2_MS 10000   // MH-Z19B : UART rapide
#define INTERVAL_PM_MS  15000   // SDS011 : cycle laser + UART
#define INTERVAL_GAS_MS 30000   // MQ-136 + MQ-131 + SGP30 : stabilisation MOS / I²C
#define INTERVAL_ENV_MS 10000   // DHT22 : limite datasheet 0,5 Hz

// ─────────────────────────────────────────────────────────────────────────────
// Seuils pour le champ JSON "level" (indicatif côté capteur)
// ─────────────────────────────────────────────────────────────────────────────
// Le backend recalcule les alertes officielles (décret n° 2018-928, Annexe 1).
// Ces seuils servent au champ "level" du message MQTT (normal|warning|high|critical).
struct ThresholdBand {
  float warningMin;
  float highMin;
  float criticalMin;
};
