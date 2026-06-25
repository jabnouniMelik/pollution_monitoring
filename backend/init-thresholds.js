/**
 * INIT : THRESHOLD CONFIG
 *
 * Initialise la configuration des seuils réglementaires basée sur :
 *   Décret gouvernemental n° 2018-928 — Annexe 1 (valeurs générales).
 *   décret gouvernemental n°2018-928 du 7 novembre 2018.
 *   Annexe 1 — Valeurs limites générales des polluants de l'air
 *   Applicables à toutes sources fixes industrielles.
 *
 * Usage : npm run init:thresholds
 */

require("dotenv").config();
const mongoose = require("mongoose");
const ThresholdConfig = require("./models/ThresholdConfig");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function initThresholds() {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connecté à MongoDB");

  // Supprimer l'ancienne config si elle existe
  await ThresholdConfig.deleteMany({});
  console.log("✓ Ancienne configuration supprimée");

  /**
   * Valeurs limites générales — Décret 2018-928, Annexe 1
   * Applicables à toutes sources fixes industrielles tunisiennes.
   * Ces valeurs constituent le socle réglementaire minimal commun.
   * Pour un déploiement sectoriel spécifique, surcharger ces seuils
   * avec les valeurs de l'annexe appropriée (ex. Annexe 6 cimenteries).
   */
  const config = await ThresholdConfig.create({
    nom: "Sources fixes — Décret 2018-928 (Annexe 1)",
    description:
      "Valeurs limites générales à la source pour toutes sources fixes industrielles — " +
      "Décret gouvernemental n° 2018-928, Annexe 1, " +
      "tel que modifié par le décret gouvernemental n°2018-928 du 7 novembre 2018.",
    installationType: "GENERAL",

    polluants: {
      // ── Poussières totales ───────────────────────────────────
      // §1 : 40 mg/m³ si flux > 1 kg/h  |  100 mg/m³ si flux ≤ 1 kg/h
      // Valeur retenue : 40 mg/m³ (cas industriel courant, flux > 1 kg/h)
      PM: {
        min: 0,
        max: 40,
        warning: 32,   // 80% VLE
        critical: 48,  // 120% VLE
        unit: "mg/m³",
        reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)",
      },
      PM25: {
        min: 0,
        max: 40,
        warning: 32,
        critical: 48,
        unit: "µg/m³",
        reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)",
      },
      PM10: {
        min: 0,
        max: 48,
        warning: 38,
        critical: 58,
        unit: "µg/m³",
        reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)",
      },

      // ── Oxydes de soufre (SO₂) ──────────────────────────────
      // §3 : 300 mg/m³ si flux > 25 kg/h
      SO2: {
        min: 0,
        max: 300,
        warning: 240,  // 80% VLE
        critical: 360, // 120% VLE
        unit: "mg/Nm³",
        reference: "Décret 2018-928, Annexe 1, §3 — SO₂ (flux > 25 kg/h)",
      },

      // ── Oxydes d'azote (NOₓ) ────────────────────────────────
      // §4 : 500 mg/m³ si flux > 25 kg/h (hormis protoxyde d'azote)
      NOx: {
        min: 0,
        max: 500,
        warning: 400,  // 80% VLE
        critical: 600, // 120% VLE
        unit: "mg/Nm³",
        reference: "Décret 2018-928, Annexe 1, §4 — NOₓ (flux > 25 kg/h)",
      },

      // ── Composés organiques volatils (COV) ──────────────────
      // §7 : 110 mg/m³ si flux > 2 kg/h (exprimé en carbone total)
      COV: {
        min: 0,
        max: 110,
        warning: 88,
        critical: 132,
        unit: "mg/Nm³",
        reference: "Décret 2018-928, Annexe 1, §7 — COV (flux > 2 kg/h, carbone total)",
      },

      // ── CO₂ (suivi interne) ──────────────────────────────────
      // Pas de VLE réglementaire dans le décret.
      CO2: {
        min: 0,
        max: 800,
        warning: 640,
        critical: 960,
        unit: "ppm",
        reference: "Suivi interne — pas de VLE réglementaire (Décret 2018-928)",
      },
    },

    warningOffsetPercent: 20,
    criticalOffsetPercent: 20,
    actif: true,
  });

  console.log("\n✅ Configuration des seuils créée :");
  console.log(`   Nom         : ${config.nom}`);
  console.log(`   Type        : ${config.installationType}`);
  console.log("   Polluants   :");
  for (const [key, val] of Object.entries(config.polluants)) {
    if (val && val.max != null) {
      console.log(
        `     ${key.padEnd(6)} : max=${val.max} ${val.unit}  (warning=${val.warning}, critical=${val.critical})`,
      );
    }
  }

  console.log("\n📋 Rappel des VLEs réglementaires (Décret 2018-928, Annexe 1 — valeurs générales) :");
  console.log("   Poussières (PM25/PM10) : 40 / 48 µg/m³ — flux > 1 kg/h  (100 mg/m³ si flux ≤ 1 kg/h)");
  console.log("   SO₂                  : 300 mg/Nm³ — flux > 25 kg/h");
  console.log("   NOₓ                  : 500 mg/Nm³ — flux > 25 kg/h (hors protoxyde d'azote)");
  console.log("   COV                  : 110 mg/Nm³ — flux > 2 kg/h  (carbone total)");
  console.log("   CO₂                  : pas de VLE réglementaire — seuil interne 800 ppm");
  console.log("\n   Pour un déploiement sectoriel spécifique, surcharger via ThresholdConfig :");
  console.log("   → Cimenteries        : Annexe 6 (PM 20 mg/m³, SO₂ 400 mg/Nm³, NOₓ 800 mg/Nm³)");
  console.log("   → Raffineries        : Annexe 2");
  console.log("   → Aciéries           : Annexe 3");

  await mongoose.disconnect();
  console.log("\n✓ Déconnecté de MongoDB");
}

initThresholds().catch((err) => {
  console.error("❌ Erreur initialisation seuils:", err);
  process.exit(1);
});
