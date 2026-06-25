/**
 * @file pins.h
 * @brief Assignation des broches GPIO — ESP32 DevKit V1 ↔ capteurs.
 *
 * Référence schéma : documentation/SCHEMA_ELECTRONIQUE.svg
 *
 * Configuration matérielle retenue :
 *   - MH-Z19B  : CO₂ NDIR           — UART (Serial2)
 *   - MQ-136   : SO₂ (MOS)          — ADC1 GPIO33 + GPIO26 chauffage
 *   - MQ-131   : NOx/O₃ (MOS)       — ADC1 GPIO34 + GPIO27 chauffage
 *   - SGP30    : COV / TVOC          — I²C (SDA/SCL)
 *   - SDS011   : PM2.5 / PM10 laser  — UART (Serial1)
 *   - DHT22    : T° / Humidité       — 1-wire GPIO4
 *
 * Règles de câblage importantes :
 *   - Masse commune (GND) entre LM2596, MB102, ESP32 et tous les modules.
 *   - ESP32 : alimentation sur VIN 5 V (régulateur interne → 3,3 V).
 *   - ADC ESP32 : 0–3,3 V max ; ne jamais appliquer 5 V directement.
 *   - UART des capteurs 5 V (MH-Z19B, SDS011) : convertisseur de niveau requis.
 *   - I²C : résistances de tirage 4,7 kΩ entre SDA/SCL et 3,3 V.
 *   - DHT22 : résistance pull-up 10 kΩ sur la ligne DATA.
 *   - MQ-136 / MQ-131 : capteurs à oxyde métallique (MOS).
 *     Principe : le chauffage interne (~150–200 mA) réduit la résistance du
 *     matériau sensible en présence du gaz cible. La sortie est une tension
 *     analogique via un pont diviseur (Rsensor + RL en série sur 5 V).
 *     La tension lue par l'ADC doit être ramenée à 3,3 V via un diviseur
 *     résistif (ex. 10 kΩ / 20 kΩ) ou un niveau-shifter passif.
 *     Chauffage contrôlé par GPIO numérique via transistor NPN (2N2222)
 *     ou MOSFET (IRLZ44N) + diode de roue libre 1N4007.
 *     IMPORTANT : laisser chauffer ≥ 24–48 h avant calibration R0.
 *     Lors de l'utilisation du WiFi, utiliser exclusivement ADC1 (GPIO32–39).
 */

#pragma once

// ─────────────────────────────────────────────────────────────────────────────
// Bus I²C — SGP30 (COV / TVOC) + afficheur OLED SSD1306 (optionnel)
// ─────────────────────────────────────────────────────────────────────────────
// SGP30 : alimentation 3,3 V uniquement ; adresse I²C 0x58.
// Pull-ups : 2 × 4,7 kΩ entre SDA/SCL et 3,3 V obligatoires.
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22

// ─────────────────────────────────────────────────────────────────────────────
// DHT22 — température et humidité relative
// ─────────────────────────────────────────────────────────────────────────────
// Protocole 1-wire propriétaire. GPIO4 évite les broches de boot sensibles.
// Alim 3,3 V ; pull-up 10 kΩ sur DATA.
#define PIN_DHT 4

// ─────────────────────────────────────────────────────────────────────────────
// UART — MH-Z19B (CO₂, technologie NDIR)
// ─────────────────────────────────────────────────────────────────────────────
// Utilise Serial2. Câblage :
//   MH-Z19B TX → Level Shifter → ESP32 RX (GPIO16)
//   MH-Z19B RX → Level Shifter → ESP32 TX (GPIO17)
// Alimentation : 5 V (courant pic ~150 mA). Level shifter bidirectionnel requis.
#define PIN_MHZ19_RX 16
#define PIN_MHZ19_TX 17

// ─────────────────────────────────────────────────────────────────────────────
// UART — SDS011 (PM2.5 / PM10, diffusion laser)
// ─────────────────────────────────────────────────────────────────────────────
// Utilise Serial1. Câblage :
//   SDS011 TX → Level Shifter → ESP32 RX (GPIO18)
//   SDS011 RX → Level Shifter → ESP32 TX (GPIO19)
// Alimentation 5 V ; ventilateur intégré ; mode "query" configuré dans sensors.cpp.
#define PIN_SDS_RX 18
#define PIN_SDS_TX 19

// ─────────────────────────────────────────────────────────────────────────────
// Entrées analogiques (ADC1) — capteurs MOS MQ-136 et MQ-131
// ─────────────────────────────────────────────────────────────────────────────
// Schéma par capteur MQ :
//   5 V ──── Rsensor(MQ) ──┬──── RL (10 kΩ) ──── GND
//                          │
//                        Vout → Diviseur résistif 3,3 V → ADC ESP32
//
// Diviseur pour ramener 5 V à 3,3 V : R1=10 kΩ (haut), R2=20 kΩ (bas)
//   Vout_ADC = Vout_MQ × R2 / (R1 + R2) ≤ 3,3 V ✓
//
// GPIO 32–39 : entrées ADC1 uniquement (ADC2 incompatible WiFi actif).
// GPIO 34 et 35 : input-only (pas de pull-up interne).
#define PIN_MQ136  33   // MQ-136 SO₂  : sortie pont diviseur → ADC1 CH5
#define PIN_MQ131  34   // MQ-131 NOx  : sortie pont diviseur → ADC1 CH6 (input-only)

// ─────────────────────────────────────────────────────────────────────────────
// Sorties numériques — contrôle chauffage MQ (via transistor / MOSFET)
// ─────────────────────────────────────────────────────────────────────────────
// Chaque capteur MQ intègre un filament résistif chauffant (~5 V / 150–200 mA).
// Le GPIO pilote la base d'un NPN 2N2222 (ou grille IRLZ44N) avec résistance
// de base 1 kΩ. Une diode 1N4007 protège le transistor contre les surtensions.
// HIGH = chauffage actif | LOW = chauffage coupé (économie énergie / calibration)
#define PIN_MQ136_HEATER 26   // Contrôle chauffage MQ-136
#define PIN_MQ131_HEATER 27   // Contrôle chauffage MQ-131
