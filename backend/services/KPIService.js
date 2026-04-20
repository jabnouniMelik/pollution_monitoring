/**
 * SERVICE : KPI
 * Calculs des 4 KPIs environnementaux selon norme NT 106.04
 * 
 * KPI 1 : TD (Taux de Dépassement) - % mesures > VLE
 * KPI 2 : EMJ (Émission Moyenne par Jour) - kg/jour
 * KPI 3 : IPE (Indice Performance Environnementale) - Score /100
 * KPI 4 : RCO2 (Réduction CO2) - % réduction vs période précédente
 */

const readingRepository = require("../repositories/ReadingRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const siteConfigRepository = require("../repositories/SiteConfigRepository");
const Reading = require("../models/Reading");

class KPIService {
  /**
   * KPI 1 : TAUX DE DÉPASSEMENT (TD)
   * Formule : TD = (N_breach / N_total) × 100
   * Objectif : ≤ 2% / mois
   * 
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début période
   * @param {Date} periodEnd - Date fin période
   * @returns {Promise<Object>} { tauxDepassement, breachCount, totalCount }
   */
  async calculateTD(polluantId, periodStart, periodEnd) {
    try {
      const polluant = await polluantRepository.findById(polluantId);
      if (!polluant || !polluant.regulatoryLimit) {
        return { tauxDepassement: 0, breachCount: 0, totalCount: 0 };
      }

      const vle = polluant.regulatoryLimit;

      // Compter toutes les mesures valides
      const totalCount = await Reading.countDocuments({
        PolluantId: polluantId,
        timestamp: { $gte: periodStart, $lte: periodEnd },
        isValid: true,
      });

      // Compter les dépassements (value > VLE)
      const breachCount = await Reading.countDocuments({
        PolluantId: polluantId,
        timestamp: { $gte: periodStart, $lte: periodEnd },
        isValid: true,
        value: { $gt: vle },
      });

      const tauxDepassement =
        totalCount > 0 ? (breachCount / totalCount) * 100 : 0;

      return {
        tauxDepassement: parseFloat(tauxDepassement.toFixed(2)),
        breachCount,
        totalCount,
      };
    } catch (error) {
      console.error("Erreur calcul TD:", error.message);
      throw error;
    }
  }

  /**
   * KPI 2 : ÉMISSION MOYENNE PAR JOUR (EMJ)
   * Formule : EMJ = C_moy × Q_air × 86400 × 10⁻⁶ (kg/jour)
   * Où :
   *   - C_moy = concentration moyenne (mg/Nm³)
   *   - Q_air = débit volumique (Nm³/s)
   *   - 86400 = secondes par jour
   *   - 10⁻⁶ = conversion mg → kg
   * Objectif : -10% / trimestre
   * 
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début période
   * @param {Date} periodEnd - Date fin période
   * @param {Number} qAir - Débit d'air (Nm³/s), optionnel (lu depuis config)
   * @returns {Promise<Object>} { emissionKgDay, avgConcentration, qAir }
   */
  async calculateEMJ(polluantId, periodStart, periodEnd, qAir = null) {
    try {
      // Récupérer Q_air depuis config si non fourni
      if (!qAir) {
        const config = await siteConfigRepository.getActiveConfig();
        qAir = config ? config.airflow : 2.0; // Défaut 2.0 Nm³/s
      }

      // Calculer concentration moyenne sur la période
      const stats = await readingRepository.aggregateByPolluantPeriod(
        polluantId,
        periodStart,
        periodEnd,
      );

      if (!stats || stats.count === 0) {
        return { emissionKgDay: 0, avgConcentration: 0, qAir };
      }

      const cMoy = stats.avgValue; // mg/Nm³

      // EMJ = C_moy × Q_air × 86400 × 10⁻⁶
      const emissionKgDay = cMoy * qAir * 86400 * 1e-6;

      return {
        emissionKgDay: parseFloat(emissionKgDay.toFixed(4)),
        avgConcentration: parseFloat(cMoy.toFixed(2)),
        qAir,
      };
    } catch (error) {
      console.error("Erreur calcul EMJ:", error.message);
      throw error;
    }
  }

  /**
   * KPI 3 : INDICE DE PERFORMANCE ENVIRONNEMENTALE (IPE)
   * Formule : IPE = 100 × Σ(w_p × Score(p)) / P
   * Où :
   *   - w_p = poids réglementaire du polluant p
   *   - Score(p) = 1 si C_moy ≤ VLE, sinon max(0, 1 - (C_moy - VLE) / VLE)
   *   - P = nombre de polluants
   * Objectif : ≥ 95 / mois
   * 
   * @param {Date} periodStart - Date début période
   * @param {Date} periodEnd - Date fin période
   * @param {Object} customWeights - Poids personnalisés (optionnel)
   * @returns {Promise<Object>} { ipe, polluantScores, weights }
   */
  async calculateIPE(periodStart, periodEnd, customWeights = null) {
    try {
      const polluants = await polluantRepository.findAll();
      
      // Récupérer poids depuis config ou utiliser poids personnalisés
      let weights = customWeights;
      if (!weights) {
        const config = await siteConfigRepository.getActiveConfig();
        if (config) {
          // Convertir PM25 → PM2.5 pour correspondre aux noms de polluants
          weights = {
            NOx: config.polluantWeights.NOx || 0.3,
            SO2: config.polluantWeights.SO2 || 0.25,
            "PM2.5": config.polluantWeights.PM25 || 0.25,
            COV: config.polluantWeights.COV || 0.15,
            CO2: config.polluantWeights.CO2 || 0.05,
          };
        } else {
          weights = {
            NOx: 0.3,
            SO2: 0.25,
            "PM2.5": 0.25,
            COV: 0.15,
            CO2: 0.05,
          };
        }
      }

      let weightedScore = 0;
      let totalWeight = 0;
      const polluantScores = {};

      for (const polluant of polluants) {
        const stats = await readingRepository.aggregateByPolluantPeriod(
          polluant._id,
          periodStart,
          periodEnd,
        );

        if (!stats || !polluant.regulatoryLimit) continue;

        const cMoy = stats.avgValue;
        const vle = polluant.regulatoryLimit;

        // Score : 1 si conforme, pénalité linéaire si dépassement
        const score =
          cMoy <= vle ? 1 : Math.max(0, 1 - (cMoy - vle) / vle);

        const weight = weights[polluant.name] || polluant.weight || 0.1;
        weightedScore += weight * score;
        totalWeight += weight;

        polluantScores[polluant.name] = {
          score: parseFloat((score * 100).toFixed(2)),
          avgConcentration: parseFloat(cMoy.toFixed(2)),
          vle,
          weight,
        };
      }

      const ipe =
        totalWeight > 0
          ? parseFloat(((weightedScore / totalWeight) * 100).toFixed(2))
          : 100;

      return { ipe, polluantScores, weights };
    } catch (error) {
      console.error("Erreur calcul IPE:", error.message);
      throw error;
    }
  }

  /**
   * KPI 4 : RÉDUCTION ESTIMÉE CO2 (RCO2)
   * Formule : RCO2 = [(EMJ(T) - EMJ(T0)) / EMJ(T0)] × 100
   * Où :
   *   - EMJ(T) = émission période actuelle
   *   - EMJ(T0) = émission période référence
   * Objectif : ≤ -5% / trimestre (réduction)
   * 
   * @param {String} polluantId - ID du polluant (généralement CO2)
   * @param {Date} currentPeriodStart - Début période actuelle
   * @param {Date} currentPeriodEnd - Fin période actuelle
   * @param {Date} referencePeriodStart - Début période référence
   * @param {Date} referencePeriodEnd - Fin période référence
   * @returns {Promise<Object>} { reductionPct, currentEmission, referenceEmission, reductionAbsolute }
   */
  async calculateRCO2(
    polluantId,
    currentPeriodStart,
    currentPeriodEnd,
    referencePeriodStart,
    referencePeriodEnd,
  ) {
    try {
      // Calculer EMJ période actuelle
      const currentEMJ = await this.calculateEMJ(
        polluantId,
        currentPeriodStart,
        currentPeriodEnd,
      );

      // Calculer EMJ période référence
      const referenceEMJ = await this.calculateEMJ(
        polluantId,
        referencePeriodStart,
        referencePeriodEnd,
      );

      if (referenceEMJ.emissionKgDay === 0) {
        return {
          reductionPct: 0,
          currentEmission: currentEMJ.emissionKgDay,
          referenceEmission: 0,
          reductionAbsolute: 0,
        };
      }

      // RCO2 = [(EMJ(T) - EMJ(T0)) / EMJ(T0)] × 100
      const reductionPct =
        ((currentEMJ.emissionKgDay - referenceEMJ.emissionKgDay) /
          referenceEMJ.emissionKgDay) *
        100;

      const reductionAbsolute =
        referenceEMJ.emissionKgDay - currentEMJ.emissionKgDay;

      return {
        reductionPct: parseFloat(reductionPct.toFixed(2)),
        currentEmission: currentEMJ.emissionKgDay,
        referenceEmission: referenceEMJ.emissionKgDay,
        reductionAbsolute: parseFloat(reductionAbsolute.toFixed(4)),
      };
    } catch (error) {
      console.error("Erreur calcul RCO2:", error.message);
      throw error;
    }
  }

  /**
   * Calcule tous les KPIs pour un polluant sur une période
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} Tous les KPIs
   */
  async calculateAllKPIs(polluantId, periodStart, periodEnd) {
    try {
      const [td, emj] = await Promise.all([
        this.calculateTD(polluantId, periodStart, periodEnd),
        this.calculateEMJ(polluantId, periodStart, periodEnd),
      ]);

      return {
        polluantId,
        periodStart,
        periodEnd,
        td,
        emj,
      };
    } catch (error) {
      console.error("Erreur calcul KPIs:", error.message);
      throw error;
    }
  }

  /**
   * Calcule la qualité des données sur une période
   * @param {Number} sampleCount - Nombre de mesures reçues
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {String} Qualité : EXCELLENT, GOOD, FAIR, POOR
   */
  calculateDataQuality(sampleCount, periodStart, periodEnd) {
    const duration = periodEnd - periodStart; // ms
    const hours = duration / (1000 * 60 * 60);
    
    // Fréquence attendue : 1 mesure / 30s = 120 mesures/heure
    const expectedCount = Math.floor(hours * 120);
    const completeness = sampleCount / expectedCount;

    if (completeness >= 0.95) return "EXCELLENT";
    if (completeness >= 0.85) return "GOOD";
    if (completeness >= 0.7) return "FAIR";
    return "POOR";
  }
}

module.exports = new KPIService();
