/**
 * @file sensors.h
 * @brief Interface de lecture des capteurs — types de retour et prototypes.
 *
 * Séparation logicielle :
 *   - sensors.cpp : acquisition bas niveau (UART, I²C, ADC, protocoles capteurs).
 *   - main.cpp    : agrégation, JSON MQTT, WiFi, temporisation.
 *
 * Chaque structure inclut un flag `valid` : false si lecture impossible
 * (capteur déconnecté, ADC hors plage, timeout SDS011, etc.).
 *
 * Capteurs actifs :
 *   - MH-Z19B  : CO₂ NDIR (UART Serial2)
 *   - MQ-136   : SO₂ MOS (ADC GPIO33 via pont diviseur)
 *   - MQ-131   : NOx/O₃ MOS (ADC GPIO34 via pont diviseur)
 *   - SGP30    : COV / TVOC (I²C)
 *   - SDS011   : PM2.5 / PM10 laser (UART Serial1)
 *   - DHT22    : Température / Humidité (1-wire GPIO4)
 */

#pragma once

#include <Arduino.h>

/**
 * Lecture d'un capteur à sortie analogique (MQ) ou I²C (SGP30).
 * @param value    Concentration en ppm ou mg/Nm³ selon le polluant.
 * @param rawValue Valeur brute : tension ADC en volts (MQ) ou TVOC en ppb (SGP30).
 * @param valid    true si la lecture est dans une plage physiquement plausible.
 */
struct GasReading {
  float value;
  float rawValue;
  bool  valid;
};

/**
 * Lecture SDS011 — un seul module fournit PM2.5 et PM10.
 * Unité physique : µg/m³.
 */
struct PmReading {
  float pm25;
  float pm10;
  bool  valid;
};

/**
 * Lecture DHT22 — contexte environnemental pour le dashboard et les modèles IA.
 */
struct EnvReading {
  float temperature;
  float humidity;
  bool  valid;
};

/** Initialise bus I²C, UART, ADC, GPIO chauffage MQ et capteurs (appeler dans setup()). */
void sensorsBegin();

/** MH-Z19B — CO₂ en ppm (technologie NDIR). */
bool readCo2(int &ppm);

/** SDS011 — PM2.5 et PM10 en µg/m³. */
PmReading readParticulates();

/** DHT22 — température °C et humidité %RH. */
EnvReading readEnvironment();

/**
 * MQ-136 — dioxyde de soufre (SO₂) en mg/Nm³.
 * Capteur MOS : sortie analogique via pont diviseur → ADC GPIO33.
 * Conversion Rs/R0 → ppm → mg/Nm³ effectuée dans sensors.cpp.
 * Nécessite calibration R0 après ≥ 24 h de chauffe en air propre.
 */
GasReading readSo2();

/**
 * MQ-131 — oxydes d'azote (NOx) en mg/Nm³.
 * Capteur MOS : sortie analogique via pont diviseur → ADC GPIO34.
 * Conversion Rs/R0 → ppm → mg/Nm³ effectuée dans sensors.cpp.
 * Nécessite calibration R0 après ≥ 24 h de chauffe en air propre.
 */
GasReading readNox();

/**
 * SGP30 (I²C) — composés organiques volatils TVOC en mg/Nm³.
 * Valeur rawValue : TVOC en ppb (unité native SGP30).
 * Conversion ppb → mg/Nm³ approximative ; non certifiée sans calibration labo.
 */
GasReading readCov();
