/**
 * MODEL : AGGREGATE_DATA
 * Stockage des données agrégées et KPIs calculés
 * Historique complet pour analyse et rapports
 */

const mongoose = require("mongoose");

const AggregateDataSchema = new mongoose.Schema(
  {
    // ── Références ─────────────────────────────────────────────
    polluantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Polluant",
      required: false, // null pour agrégation globale IPE
      default: null,
    },
    sensorNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SensorNode",
      default: null, // null = agrégation globale site
    },
    // ── Période ────────────────────────────────────────────────
    period: {
      type: String,
      enum: ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"],
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    // ── Statistiques brutes ────────────────────────────────────
    minValue: {
      type: Number,
      required: true,
    },
    maxValue: {
      type: Number,
      required: true,
    },
    avgValue: {
      type: Number,
      required: true,
    },
    stdDeviation: {
      type: Number,
      default: 0,
    },
    sampleCount: {
      type: Number,
      required: true,
      min: 0,
    },
    // ── KPIs calculés ──────────────────────────────────────────
    breachCount: {
      type: Number,
      default: 0, // Nombre mesures > regulatoryLimit (→ TD)
    },
    warningCount: {
      type: Number,
      default: 0, // Nombre mesures > warningThreshold
    },
    tauxDepassement: {
      type: Number,
      default: 0, // % - KPI 1: TD = breachCount / sampleCount × 100
    },
    emissionKgDay: {
      type: Number,
      default: null, // kg/jour - KPI 2: EMJ
    },
    score: {
      type: Number,
      default: 1.0, // Score conformité polluant [0-1] (→ IPE)
      min: 0,
      max: 1,
    },
    overallScore: {
      type: Number,
      default: 100, // /100 - KPI 3: IPE (si agrégation globale)
    },
    reductionPct: {
      type: Number,
      default: null, // % - KPI 4: RCO2 vs période précédente
    },
    reductionAbsolute: {
      type: Number,
      default: null, // kg/jour - Réduction absolue
    },
    trend: {
      type: Number,
      default: null, // %/période - Tendance glissante
    },
    // ── Métadonnées ────────────────────────────────────────────
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
    calculationDuration: {
      type: Number,
      default: 0, // ms - Durée du calcul (monitoring performance)
    },
    dataQuality: {
      type: String,
      enum: ["EXCELLENT", "GOOD", "FAIR", "POOR"],
      default: "GOOD",
    },
  },
  { timestamps: true },
);

// ── Index pour performance ─────────────────────────────────────
// Index composé : requêtes par polluant + période
AggregateDataSchema.index({ polluantId: 1, period: 1, periodStart: -1 });

// Index : agrégation globale site (sensorNodeId null)
AggregateDataSchema.index({ sensorNodeId: 1, period: 1, periodStart: -1 });

// Index : recherche par période
AggregateDataSchema.index({ periodStart: -1, periodEnd: -1 });

// Index : KPIs dashboard (tri par score)
AggregateDataSchema.index({ period: 1, overallScore: -1 });

// ── Méthodes d'instance ────────────────────────────────────────
// Évaluer la qualité des données
AggregateDataSchema.methods.evaluateDataQuality = function () {
  const completeness = this.sampleCount / this.getExpectedSampleCount();

  if (completeness >= 0.95) return "EXCELLENT";
  if (completeness >= 0.85) return "GOOD";
  if (completeness >= 0.7) return "FAIR";
  return "POOR";
};

// Calculer le nombre attendu de mesures
AggregateDataSchema.methods.getExpectedSampleCount = function () {
  const duration = this.periodEnd - this.periodStart; // ms
  const hours = duration / (1000 * 60 * 60);

  // Fréquence moyenne : 1 mesure / 30s = 120 mesures/heure
  return Math.floor(hours * 120);
};

// ── Méthodes statiques ─────────────────────────────────────────
// Trouver la période précédente pour comparaison
AggregateDataSchema.statics.findPreviousPeriod = async function (
  polluantId,
  period,
  currentPeriodStart,
) {
  const periodDurations = {
    HOURLY: 60 * 60 * 1000,
    DAILY: 24 * 60 * 60 * 1000,
    WEEKLY: 7 * 24 * 60 * 60 * 1000,
    MONTHLY: 30 * 24 * 60 * 60 * 1000,
  };

  const duration = periodDurations[period];
  const previousStart = new Date(currentPeriodStart.getTime() - duration);

  return await this.findOne({
    polluantId,
    period,
    periodStart: previousStart,
  });
};

module.exports = mongoose.model("AggregateData", AggregateDataSchema);
