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
    thermalPower: {
      type: Number,
      default: null, // kW - Puissance thermique installation (optionnel)
    },
    // ── Poids réglementaires pour IPE ──────────────────────────
    polluantWeights: {
      NOx: { type: Number, default: 0.30 },
      SO2: { type: Number, default: 0.25 },
      PM25: { type: Number, default: 0.25 }, // PM2.5 → PM25 (pas de "." dans les clés)
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

module.exports = mongoose.model("SiteConfig", SiteConfigSchema);
