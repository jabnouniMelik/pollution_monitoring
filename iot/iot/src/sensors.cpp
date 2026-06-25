/**
 * @file sensors.cpp
 * @brief Implémentation des lectures capteurs — couche matérielle.
 *
 * Capteurs gérés :
 *   | Composant | Interface          | Alim. | Remarque hardware                              |
 *   |-----------|--------------------|-------|------------------------------------------------|
 *   | MH-Z19B   | UART 9600 bauds    | 5 V   | CO₂ NDIR, Serial2, level shifter requis        |
 *   | MQ-136    | ADC (pont divis.)  | 5 V   | SO₂ MOS, GPIO33, chauffage GPIO26              |
 *   | MQ-131    | ADC (pont divis.)  | 5 V   | NOx MOS, GPIO34 input-only, chauffage GPIO27   |
 *   | SGP30     | I²C                | 3,3 V | TVOC/eCO₂, adresse 0x58                        |
 *   | SDS011    | UART 9600 bauds    | 5 V   | PM2.5/PM10, Serial1, mode query, level shifter |
 *   | DHT22     | 1-wire             | 3,3 V | Température / humidité, GPIO4                  |
 *
 * Principe de lecture MQ (oxyde métallique) :
 *   Le capteur présente une résistance Rs qui varie avec la concentration du gaz.
 *   Rs est montée en pont diviseur avec RL : Vout = Vcc × RL / (Rs + RL).
 *   Un diviseur résistif ramène Vout de 5 V à ≤ 3,3 V pour l'ADC.
 *   Conversion : Rs = RL × (Vcc / Vout_reel - 1)
 *                ppm = A × (Rs/R0)^B  (courbe log-linéaire datasheet)
 *   Puis ppm → mg/Nm³ via facteur molaire.
 *
 * IMPORTANT — calibration R0 :
 *   Les valeurs MQ136_R0 et MQ131_R0 dans config.h sont des estimations initiales.
 *   Une calibration en air propre (≥ 24 h de chauffe) est requise pour des
 *   mesures quantitativement correctes. Sans calibration, les valeurs sont
 *   semi-quantitatives (tendances et dépassements détectables, pas de valeur absolue).
 */

#include "sensors.h"

#include <Wire.h>
#include <DHT.h>
#include <MHZ19.h>
#include <SdsDustSensor.h>
#include <Adafruit_SGP30.h>

#include "config.h"
#include "pins.h"

// ── Instances globales des bibliothèques capteurs ────────────────────────────
static DHT            dht(PIN_DHT, DHT22);
static MHZ19          mhz19;
static SdsDustSensor  sds(Serial1);
static Adafruit_SGP30 sgp30;

// Tension de référence ADC ESP32 (3,3 V), résolution 12 bits (4095 niveaux).
static const float ADC_VREF    = 3.3f;
static const float ADC_MAX_RAW = 4095.0f;

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions internes — lecture ADC et conversion MQ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit la tension moyenne sur une broche ADC1 (MQ_ADC_SAMPLES mesures).
 * Retourne la tension sur la broche ADC (côté diviseur résistif, ≤ 3,3 V).
 */
static float readAdcVoltage(int pin) {
  uint32_t sum = 0;
  for (int i = 0; i < MQ_ADC_SAMPLES; i++) {
    sum += analogRead(pin);
    delay(MQ_ADC_SAMPLE_DELAY);
  }
  const float avgRaw = static_cast<float>(sum) / MQ_ADC_SAMPLES;
  return (avgRaw / ADC_MAX_RAW) * ADC_VREF;
}

/**
 * Calcule la concentration en ppm à partir de la tension ADC lue sur un capteur MQ.
 *
 * Étapes :
 *   1. Vout_mq = Vout_adc / MQ_DIVIDER_RATIO  (annule le diviseur résistif)
 *   2. Rs = MQ_RL × (MQ_VCC / Vout_mq - 1.0)  (résistance capteur en kΩ)
 *   3. ratio = Rs / R0
 *   4. ppm = A × ratio^B  (courbe log-linéaire datasheet)
 *
 * @param voutAdc    Tension lue sur l'ADC (après diviseur résistif), en volts.
 * @param r0Kohm     Résistance en air propre (kΩ), depuis config.h.
 * @param coefA      Coefficient A de la courbe de sensibilité.
 * @param coefB      Exposant B de la courbe de sensibilité.
 * @return           Concentration en ppm (≥ 0), ou 0 si calcul impossible.
 */
static float mqPpmFromVoltage(float voutAdc, float r0Kohm, float coefA, float coefB) {
  if (voutAdc < 0.01f || r0Kohm <= 0.0f) return 0.0f;

  // Reconstituer la tension réelle au pont (avant diviseur ADC)
  const float voutMq = voutAdc / MQ_DIVIDER_RATIO;
  if (voutMq <= 0.01f || voutMq >= MQ_VCC) return 0.0f;

  // Résistance capteur en kΩ
  const float rs = MQ_RL_KOHM * (MQ_VCC / voutMq - 1.0f);
  if (rs <= 0.0f) return 0.0f;

  // Ratio Rs/R0 et courbe de sensibilité
  const float ratio = rs / r0Kohm;
  const float ppm   = coefA * powf(ratio, coefB);
  return (ppm > 0.0f) ? ppm : 0.0f;
}

/**
 * Lecture générique d'un capteur MQ sur un GPIO ADC.
 * @param pin        GPIO ADC1 (après diviseur résistif).
 * @param r0Kohm     R0 en air propre (kΩ).
 * @param coefA / B  Coefficients courbe datasheet.
 * @param ppmToMgNm3 Facteur de conversion ppm → mg/Nm³.
 * @return GasReading avec value en mg/Nm³, rawValue en volts ADC, valid.
 */
static GasReading readMqSensor(int pin, float r0Kohm,
                                float coefA, float coefB,
                                float ppmToMgNm3) {
  GasReading out = {0.0f, 0.0f, false};
  const float voutAdc = readAdcVoltage(pin);
  out.rawValue = voutAdc;

  // Plage valide : tension ADC entre 0,05 V et 3,20 V
  if (voutAdc < 0.05f || voutAdc > 3.20f) {
    return out;  // capteur non connecté ou saturé
  }

  const float ppm = mqPpmFromVoltage(voutAdc, r0Kohm, coefA, coefB);
  out.value = ppm * ppmToMgNm3;  // conversion → mg/Nm³
  out.valid = (ppm >= 0.0f);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────────────────────

void sensorsBegin() {
  // ADC 12 bits.
  analogReadResolution(12);

  // GPIO chauffage MQ — activer immédiatement (les MQ ont besoin de chaleur).
  pinMode(PIN_MQ136_HEATER, OUTPUT);
  pinMode(PIN_MQ131_HEATER, OUTPUT);
  digitalWrite(PIN_MQ136_HEATER, HIGH);  // Chauffage MQ-136 ON
  digitalWrite(PIN_MQ131_HEATER, HIGH);  // Chauffage MQ-131 ON

  // Bus I²C pour SGP30 (et éventuel afficheur OLED SSD1306).
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  dht.begin();

  // MH-Z19B : UART 9600 bauds, 8N1.
  Serial2.begin(9600, SERIAL_8N1, PIN_MHZ19_RX, PIN_MHZ19_TX);
  mhz19.begin(Serial2);
  mhz19.autoCalibration(true);

  // SDS011 : mode query.
  Serial1.begin(9600, SERIAL_8N1, PIN_SDS_RX, PIN_SDS_TX);
  sds.begin();
  sds.setQueryReportingMode();

  // SGP30 : initialisation I²C.
  if (!sgp30.begin()) {
    Serial.println("[SGP30] Init I2C échouée — vérifier câblage SDA/SCL et pull-ups 4,7 kΩ");
  }

  // Délai de stabilisation initial.
  // Note : les MQ nécessitent ≥ 24–48 h de chauffe pour une calibration R0 fiable.
  // Ce délai de 2 s est suffisant pour le démarrage logiciel mais pas pour la
  // stabilisation chimique complète du matériau sensible.
  delay(2000);
  Serial.println("[Sensors] Initialisation terminée");
  Serial.printf("[Sensors] MQ-136 sur GPIO%d (htr:%d), MQ-131 sur GPIO%d (htr:%d)\n",
                PIN_MQ136, PIN_MQ136_HEATER, PIN_MQ131, PIN_MQ131_HEATER);
  Serial.printf("[Sensors] R0: MQ-136=%.1f kΩ, MQ-131=%.1f kΩ (à recalibrer en air propre)\n",
                MQ136_R0, MQ131_R0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions de lecture publiques
// ─────────────────────────────────────────────────────────────────────────────

bool readCo2(int &ppm) {
  ppm = static_cast<int>(mhz19.getCO2());
  return ppm > 0;
}

PmReading readParticulates() {
  PmReading out = {0.0f, 0.0f, false};
  PmResult result = sds.queryPm();
  if (result.isOk()) {
    out.pm25  = result.pm25;
    out.pm10  = result.pm10;
    out.valid = true;
  }
  return out;
}

EnvReading readEnvironment() {
  EnvReading out = {0.0f, 0.0f, false};
  const float t = dht.readTemperature();
  const float h = dht.readHumidity();
  if (!isnan(t) && !isnan(h)) {
    out.temperature = t;
    out.humidity    = h;
    out.valid       = true;
  }
  return out;
}

GasReading readSo2() {
  // MQ-136 : SO₂, ADC GPIO33, pont diviseur résistif.
  // Conversion : Rs/R0 → ppm via courbe datasheet → mg/Nm³ (×2.86).
  // Décret 2018-928, Annexe 1, §3 : VLE SO₂ = 300 mg/Nm³ (flux > 25 kg/h).
  return readMqSensor(PIN_MQ136, MQ136_R0, MQ136_A, MQ136_B, MQ136_SO2_PPM_TO_MG_NM3);
}

GasReading readNox() {
  // MQ-131 : NOx/O₃, ADC GPIO34 (input-only), pont diviseur résistif.
  // Conversion : Rs/R0 → ppm via courbe datasheet → mg/Nm³ (×2.05).
  // Décret 2018-928, Annexe 1, §4 : VLE NOₓ = 500 mg/Nm³ (flux > 25 kg/h).
  // Note : le MQ-131 répond également à l'ozone — mesure NOx + O₃ combinés.
  return readMqSensor(PIN_MQ131, MQ131_R0, MQ131_A, MQ131_B, MQ131_NOX_PPM_TO_MG_NM3);
}

GasReading readCov() {
  GasReading out = {0.0f, 0.0f, false};
  if (!sgp30.IAQmeasure()) {
    return out;
  }
  // SGP30 fournit TVOC en ppb ; conversion mg/Nm³ approximative.
  const float tvocPpb = static_cast<float>(sgp30.TVOC);
  out.rawValue = tvocPpb;
  out.value    = tvocPpb * 0.0045f;  // ≈ ppb → mg/Nm³ (approximation)
  out.valid    = (tvocPpb >= 0.0f);
  return out;
}
