/**
 * MODEL : THRESHOLD_CONFIG
 * Configuration des seuils d'émission et d'alerte
 * Basé sur le Décret 2010-2516 (Tunisie)
 * 
 * Champs par polluant:
 * - min: Valeur minimale acceptable (mg/Nm³ ou mg/m³)
 * - max: Valeur limite d'émission à la source (Décret 2010-2516)
 * - warning: Seuil d'avertissement (max - 20%)
 * - critical: Seuil critique (max + 20%)
 * - unit: Unité de mesure
 * - reference: Source réglementaire
 */

const mongoose = require("mongoose");

// Schéma pour un polluant
const PollutantSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    warning: { type: Number, default: null },
    critical: { type: Number, default: null },
    unit: { type: String, required: true },
    reference: { type: String, default: "Décret 2010-2516" },
  },
  { _id: false }
);

const ThresholdConfigSchema = new mongoose.Schema(
  {
    // Nom de la configuration (ex: "Configuration Globale", "Cimenteries Sfax")
    nom: {
      type: String,
      default: "Configuration Globale",
      required: true,
    },

    // Description
    description: {
      type: String,
      default: "Seuils globaux basés sur Décret 2010-2516 (Tunisie)",
    },

    // Polluants et leurs seuils
    polluants: {
      NOx: { type: PollutantSchema, default: () => ({}) },
      SO2: { type: PollutantSchema, default: () => ({}) },
      PM: { type: PollutantSchema, default: () => ({}) },
      PM25: { type: PollutantSchema, default: () => ({}) },
      COV: { type: PollutantSchema, default: () => ({}) },
      CO2: { type: PollutantSchema, default: () => ({}) },
    },

    // Stratégie de calcul des seuils d'alerte
    warningOffsetPercent: {
      type: Number,
      default: 20,
    },

    criticalOffsetPercent: {
      type: Number,
      default: 20,
    },

    // Niveaux d'alerte et leurs couleurs (UI)
    alertLevels: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        normal: { color: "#10b981", icon: "✓", label: "Normal" },
        warning: { color: "#fbbf24", icon: "⚠", label: "Avertissement" },
        critical: { color: "#ef4444", icon: "⚠️", label: "Critique" },
      },
    },

    // Statut
    actif: {
      type: Boolean,
      default: true,
    },

    // Métadonnées
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    modificationReason: String,
  },
  { timestamps: true },
);

// Méthode pour calculer les seuils d'alerte automatiquement
ThresholdConfigSchema.methods.calculateThresholds = function () {
  const polluants = this.polluants;

  for (const [key, config] of Object.entries(polluants)) {
    const maxValue = config.max;
    const warningOffset = (maxValue * this.warningOffsetPercent) / 100;
    const criticalOffset = (maxValue * this.criticalOffsetPercent) / 100;

    config.warning = maxValue - warningOffset;
    config.critical = maxValue + criticalOffset;
  }

  return polluants;
};

module.exports = mongoose.model("ThresholdConfig", ThresholdConfigSchema);
