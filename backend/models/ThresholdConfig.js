/**
 * MODEL : THRESHOLD_CONFIG
 * Configuration des seuils d'émission et d'alerte
 *
 * Valeurs limites par défaut basées sur :
 *   Décret gouvernemental n° 2018-928 — Annexe 1 (valeurs générales).
 *   décret gouvernemental n° 2018-928 du 7 novembre 2018.
 *   Annexe 1 — Valeurs limites générales à la source des polluants de l'air
 *   Applicables à toutes sources fixes industrielles en l'absence de valeur
 *   spécifique plus contraignante.
 *
 * Polluants couverts (Annexe 1) :
 *   PM/PM25 : Poussières — 40 mg/m³  (flux > 1 kg/h)  | 100 mg/m³ (flux ≤ 1 kg/h)
 *   SO2     : Oxydes de soufre — 300 mg/Nm³ (flux > 25 kg/h)
 *   NOx     : Oxydes d'azote  — 500 mg/Nm³ (flux > 25 kg/h, hors N₂O)
 *   COV     : Composés organiques volatils — 110 mg/Nm³ (flux > 2 kg/h, carbone total)
 *
 * Note : CO₂ n'a pas de VLE réglementaire dans ce décret ; la valeur
 * configurée ici est indicative pour le suivi interne (bilan carbone KPI).
 *
 * Pour les déploiements sectoriels, surcharger ces valeurs via une instance
 * ThresholdConfig avec installationType approprié :
 *   CEMENT   → Annexe 6 (PM 20, SO₂ 400, NOₓ 800 mg/Nm³)
 *   REFINERY → Annexe 2
 *   STEEL    → Annexe 3
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
    reference: { type: String, default: "Décret 2018-928, Annexe 1" },
  },
  { _id: false }
);

const ThresholdConfigSchema = new mongoose.Schema(
  {
    // Nom de la configuration
    nom: {
      type: String,
      default: "Sources fixes — Décret 2018-928 (Annexe 1)",
      required: true,
    },

    // Description
    description: {
      type: String,
      default:
        "Valeurs limites générales à la source pour toutes sources fixes industrielles — " +
        "Décret gouvernemental n° 2018-928, Annexe 1, " +
        "tel que modifié par le décret gouvernemental n° 2018-928 du 7 novembre 2018.",
    },

    // Type d'installation (détermine les VLE applicables)
    installationType: {
      type: String,
      enum: ["GENERAL", "CEMENT", "REFINERY", "STEEL", "CO_INCINERATION_EXISTING", "CO_INCINERATION_NEW"],
      default: "GENERAL",
    },

    // Polluants et leurs seuils
    polluants: {
      // ── Poussières (PM) ──────────────────────────────────────
      // Décret 2018-928, Annexe 1, §1 : 40 mg/m³ (flux > 1 kg/h)
      PM: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 40,          // mg/m³ — flux > 1 kg/h
          warning: 32,      // 80% de la VLE
          critical: 48,     // 120% de la VLE
          unit: "mg/m³",
          reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)",
        }),
      },
      // ── PM2.5 (assimilé aux poussières totales) ───────────────
      PM25: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 40,          // Aligné sur VLE poussières totales (Annexe 1, §1)
          warning: 32,
          critical: 48,
          unit: "µg/m³",
          reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)",
        }),
      },
      PM10: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 48,
          warning: 38,
          critical: 58,
          unit: "µg/m³",
          reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)",
        }),
      },
      // ── Oxydes de soufre (SO2) ───────────────────────────────
      // Décret 2018-928, Annexe 1, §3 : 300 mg/Nm³ (flux > 25 kg/h)
      SO2: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 300,         // mg/Nm³ — flux > 25 kg/h
          warning: 240,     // 80% de la VLE
          critical: 360,    // 120% de la VLE
          unit: "mg/Nm³",
          reference: "Décret 2018-928, Annexe 1, §3 — SO₂ (flux > 25 kg/h)",
        }),
      },
      // ── Oxydes d'azote (NOx) ────────────────────────────────
      // Décret 2018-928, Annexe 1, §4 : 500 mg/Nm³ (flux > 25 kg/h, hors N₂O)
      NOx: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 500,         // mg/Nm³ — flux > 25 kg/h
          warning: 400,     // 80% de la VLE
          critical: 600,    // 120% de la VLE
          unit: "mg/Nm³",
          reference: "Décret 2018-928, Annexe 1, §4 — NOₓ (flux > 25 kg/h)",
        }),
      },
      // ── Composés organiques volatils (COV) ──────────────────
      // Décret 2018-928, Annexe 1, §7 : 110 mg/Nm³ (flux > 2 kg/h, carbone total)
      COV: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 110,         // mg/Nm³ — flux > 2 kg/h
          warning: 88,      // 80% de la VLE
          critical: 132,    // 120% de la VLE
          unit: "mg/Nm³",
          reference: "Décret 2018-928, Annexe 1, §7 — COV (flux > 2 kg/h, carbone total)",
        }),
      },
      // ── CO2 (suivi interne / bilan carbone) ─────────────────
      // Pas de VLE réglementaire dans le décret.
      CO2: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 800,         // ppm — seuil interne de suivi KPI
          warning: 640,     // 80% seuil interne
          critical: 960,    // 120% seuil interne
          unit: "ppm",
          reference: "Suivi interne — pas de VLE réglementaire (Décret 2018-928)",
        }),
      },
      // ── Chlorure d'hydrogène (HCl) ───────────────────────────
      // Décret 2018-928, Annexe 1, §5 : 30 mg/Nm³ (flux > 1 kg/h)
      HCl: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 30,          // mg/Nm³
          warning: 24,
          critical: 36,
          unit: "mg/Nm³",
          reference: "Décret 2018-928, Annexe 1, §5 — HCl (flux > 1 kg/h)",
        }),
      },
      // ── Fluorure d'hydrogène (HF) ────────────────────────────
      // Décret 2018-928, Annexe 1, §6 : 5 mg/Nm³ (flux > 0,5 kg/h)
      HF: {
        type: PollutantSchema,
        default: () => ({
          min: 0,
          max: 5,           // mg/Nm³
          warning: 4,
          critical: 6,
          unit: "mg/Nm³",
          reference: "Décret 2018-928, Annexe 1, §6 — HF (flux > 0,5 kg/h)",
        }),
      },
    },

    // Stratégie de calcul des seuils d'alerte (% de la VLE)
    warningOffsetPercent: {
      type: Number,
      default: 20, // warning = VLE - 20%
    },

    criticalOffsetPercent: {
      type: Number,
      default: 20, // critical = VLE + 20%
    },

    // Niveaux d'alerte et leurs couleurs (UI)
    alertLevels: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        normal:   { color: "#10b981", icon: "✓",  label: "Normal" },
        warning:  { color: "#fbbf24", icon: "⚠",  label: "Avertissement" },
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

/**
 * Recalcule automatiquement warning et critical pour tous les polluants
 * à partir de warningOffsetPercent et criticalOffsetPercent.
 */
ThresholdConfigSchema.methods.calculateThresholds = function () {
  const polluants = this.polluants;

  for (const [, config] of Object.entries(polluants)) {
    if (!config || !config.max) continue;
    const maxValue = config.max;
    config.warning  = maxValue - (maxValue * this.warningOffsetPercent  / 100);
    config.critical = maxValue + (maxValue * this.criticalOffsetPercent / 100);
  }

  return polluants;
};

module.exports = mongoose.model("ThresholdConfig", ThresholdConfigSchema);
