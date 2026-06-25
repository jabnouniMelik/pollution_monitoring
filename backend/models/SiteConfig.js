/**
 * MODEL : SITE_CONFIG
 * Configuration globale du site industriel
 * Paramètres techniques pour calculs KPI
 */

const mongoose = require("mongoose");

const SiteConfigSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      required: true,
      default: "Station-Sfax-01",
    },
    // ── Paramètres techniques ──────────────────────────────────
    airflow: {
      type: Number,
      required: true,
      default: 2.0, // Nm³/s - Débit volumique d'air à la source
      min: 0.1,
      max: 100,
    },
    /** Référence CO₂ (ppm) pour affichage baseline et calcul RCO₂ côté UI */
    baselineCo2: {
      type: Number,
      default: 650,
      min: 0,
    },
    thermalPower: {
      type: Number,
      default: null, // kW - Puissance thermique installation (optionnel)
    },
    expectedSampleIntervalSeconds: {
      type: Number,
      default: 30,
      min: 1,
      max: 3600,
    },
    // ── Poids réglementaires pour IPE ──────────────────────────
    polluantWeights: {
      NOx: { type: Number, default: 0.30 },
      SO2: { type: Number, default: 0.25 },
      PM25: { type: Number, default: 0.15 },
      PM10: { type: Number, default: 0.10 },
      COV: { type: Number, default: 0.15 },
      CO2: { type: Number, default: 0.05 },
    },
    // ── Objectifs KPI ──────────────────────────────────────────
    targets: {
      tauxDepassement: {
        type: Number,
        default: 2.0, // % - Objectif TD ≤ 2% / mois
      },
      ipe: {
        type: Number,
        default: 95, // /100 - Objectif IPE ≥ 95
      },
      reductionCO2: {
        type: Number,
        default: -5.0, // % - Objectif RCO2 ≤ -5% / trimestre
      },
      EMJ: {
        type: Number,
        default: null, // kg/j - objectif facultatif pour l'émission massique journalière
      },
    },
    // ── Métadonnées ────────────────────────────────────────────
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [10.7602, 35.8256], // Sfax, Tunisie
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// Index géospatial
SiteConfigSchema.index({ location: "2dsphere" });

// Méthode : Calculer Q_air depuis puissance thermique si non fourni
SiteConfigSchema.methods.estimateAirflow = function () {
  if (this.thermalPower && !this.airflow) {
    // Approximation : Q_air ≈ P_thermique × 0.002 Nm³/s/kW
    return this.thermalPower * 0.002;
  }
  return this.airflow;
};

// Méthode : Obtenir le poids d'un polluant
SiteConfigSchema.methods.getPolluantWeight = function (polluantName) {
  // Normaliser le nom (PM2.5 → PM25)
  const normalizedName = polluantName.replace(".", "");
  return this.polluantWeights[normalizedName] || 0.1; // Défaut 10%
};

SiteConfigSchema.methods.getExpectedSampleIntervalSeconds = function () {
  return this.expectedSampleIntervalSeconds || 30;
};

module.exports = mongoose.model("SiteConfig", SiteConfigSchema);
