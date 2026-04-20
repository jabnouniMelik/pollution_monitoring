/**
 * SERVICE : AGGREGATION
 * Orchestre le calcul et le stockage des données agrégées + KPIs
 * Exécution périodique via scheduler (HOURLY, DAILY, WEEKLY, MONTHLY)
 */

const aggregateDataRepository = require("../repositories/AggregateDataRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const readingRepository = require("../repositories/ReadingRepository");
const kpiService = require("./KPIService");
const Reading = require("../models/Reading");

class AggregationService {
  /**
   * Agrège les données pour un polluant sur une période
   * Calcule statistiques + KPIs et stocke dans AggregateData
   * 
   * @param {String} polluantId - ID du polluant
   * @param {String} period - Type période (HOURLY, DAILY, WEEKLY, MONTHLY)
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} Document AggregateData créé
   */
  async aggregatePolluantData(polluantId, period, periodStart, periodEnd) {
    const startTime = Date.now();

    try {
      // Vérifier si agrégation existe déjà
      const existing = await aggregateDataRepository.findExisting(
        polluantId,
        period,
        periodStart,
      );

      // Récupérer statistiques brutes
      const stats = await readingRepository.aggregateByPolluantPeriod(
        polluantId,
        periodStart,
        periodEnd,
      );

      if (!stats || stats.count === 0) {
        console.log(
          `Aucune donnée pour polluant ${polluantId} sur période ${period}`,
        );
        return null;
      }

      // Calculer KPIs
      const [td, emj] = await Promise.all([
        kpiService.calculateTD(polluantId, periodStart, periodEnd),
        kpiService.calculateEMJ(polluantId, periodStart, periodEnd),
      ]);

      // Calculer écart-type
      const stdDev = await this.calculateStdDeviation(
        polluantId,
        periodStart,
        periodEnd,
        stats.avgValue,
      );

      // Calculer score conformité (pour IPE)
      const polluant = await polluantRepository.findById(polluantId);
      const score = this.calculateComplianceScore(
        stats.avgValue,
        polluant.regulatoryLimit,
      );

      // Évaluer qualité des données
      const dataQuality = kpiService.calculateDataQuality(
        stats.count,
        periodStart,
        periodEnd,
      );

      // Préparer données agrégées
      const aggregateData = {
        polluantId,
        sensorNodeId: null, // Agrégation globale site
        period,
        periodStart,
        periodEnd,
        minValue: stats.minValue,
        maxValue: stats.maxValue,
        avgValue: stats.avgValue,
        stdDeviation: stdDev,
        sampleCount: stats.count,
        breachCount: td.breachCount,
        warningCount: 0, // TODO: calculer si nécessaire
        tauxDepassement: td.tauxDepassement,
        emissionKgDay: emj.emissionKgDay,
        score,
        calculatedAt: new Date(),
        calculationDuration: Date.now() - startTime,
        dataQuality,
      };

      // Upsert (créer ou mettre à jour)
      const result = await aggregateDataRepository.upsert(
        { polluantId, period, periodStart },
        aggregateData,
      );

      console.log(
        `✓ Agrégation ${period} pour ${polluant.name}: TD=${td.tauxDepassement}%, EMJ=${emj.emissionKgDay} kg/j`,
      );

      return result;
    } catch (error) {
      console.error(
        `Erreur agrégation polluant ${polluantId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Agrège tous les polluants pour une période donnée
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Array>} Array de documents créés
   */
  async aggregateAllPolluants(period, periodStart, periodEnd) {
    try {
      const polluants = await polluantRepository.findAll();
      const results = [];

      for (const polluant of polluants) {
        const result = await this.aggregatePolluantData(
          polluant._id,
          period,
          periodStart,
          periodEnd,
        );
        if (result) results.push(result);
      }

      // Calculer IPE global après agrégation de tous les polluants
      if (results.length > 0) {
        await this.calculateGlobalIPE(period, periodStart, periodEnd);
      }

      return results;
    } catch (error) {
      console.error("Erreur agrégation tous polluants:", error.message);
      throw error;
    }
  }

  /**
   * Calcule l'IPE global du site et le stocke
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} Document AggregateData avec IPE global
   */
  async calculateGlobalIPE(period, periodStart, periodEnd) {
    try {
      const { ipe, polluantScores } = await kpiService.calculateIPE(
        periodStart,
        periodEnd,
      );

      // Créer enregistrement global (polluantId null)
      const globalData = {
        polluantId: null,
        sensorNodeId: null,
        period,
        periodStart,
        periodEnd,
        minValue: 0,
        maxValue: 100,
        avgValue: ipe,
        sampleCount: Object.keys(polluantScores).length,
        overallScore: ipe,
        calculatedAt: new Date(),
        dataQuality: "EXCELLENT",
      };

      const result = await aggregateDataRepository.upsert(
        { polluantId: null, period, periodStart },
        globalData,
      );

      console.log(`✓ IPE global ${period}: ${ipe}/100`);

      return result;
    } catch (error) {
      console.error("Erreur calcul IPE global:", error.message);
      throw error;
    }
  }

  /**
   * Calcule RCO2 pour un polluant en comparant avec période précédente
   * @param {String} polluantId - ID du polluant
   * @param {String} period - Type période
   * @param {Date} currentPeriodStart - Début période actuelle
   * @param {Date} currentPeriodEnd - Fin période actuelle
   * @returns {Promise<Object>} Document mis à jour avec RCO2
   */
  async calculateRCO2ForPeriod(
    polluantId,
    period,
    currentPeriodStart,
    currentPeriodEnd,
  ) {
    try {
      // Calculer période précédente
      const periodDurations = {
        HOURLY: 60 * 60 * 1000,
        DAILY: 24 * 60 * 60 * 1000,
        WEEKLY: 7 * 24 * 60 * 60 * 1000,
        MONTHLY: 30 * 24 * 60 * 60 * 1000,
      };

      const duration = periodDurations[period];
      const referencePeriodStart = new Date(
        currentPeriodStart.getTime() - duration,
      );
      const referencePeriodEnd = new Date(currentPeriodEnd.getTime() - duration);

      // Calculer RCO2
      const rco2 = await kpiService.calculateRCO2(
        polluantId,
        currentPeriodStart,
        currentPeriodEnd,
        referencePeriodStart,
        referencePeriodEnd,
      );

      // Mettre à jour l'agrégation existante
      const aggregate = await aggregateDataRepository.findExisting(
        polluantId,
        period,
        currentPeriodStart,
      );

      if (aggregate) {
        aggregate.reductionPct = rco2.reductionPct;
        aggregate.reductionAbsolute = rco2.reductionAbsolute;
        await aggregate.save();

        console.log(
          `✓ RCO2 calculé: ${rco2.reductionPct}% (${rco2.reductionAbsolute} kg/j)`,
        );
      }

      return rco2;
    } catch (error) {
      console.error("Erreur calcul RCO2:", error.message);
      throw error;
    }
  }

  /**
   * Calcule l'écart-type des mesures
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @param {Number} mean - Moyenne
   * @returns {Promise<Number>} Écart-type
   */
  async calculateStdDeviation(polluantId, periodStart, periodEnd, mean) {
    try {
      const result = await Reading.aggregate([
        {
          $match: {
            PolluantId: polluantId,
            timestamp: { $gte: periodStart, $lte: periodEnd },
            isValid: true,
          },
        },
        {
          $group: {
            _id: null,
            variance: {
              $avg: {
                $pow: [{ $subtract: ["$value", mean] }, 2],
              },
            },
          },
        },
      ]);

      if (result.length > 0 && result[0].variance) {
        return Math.sqrt(result[0].variance);
      }

      return 0;
    } catch (error) {
      console.error("Erreur calcul écart-type:", error.message);
      return 0;
    }
  }

  /**
   * Calcule le score de conformité pour un polluant
   * @param {Number} avgValue - Valeur moyenne
   * @param {Number} vle - Valeur limite d'émission
   * @returns {Number} Score [0-1]
   */
  calculateComplianceScore(avgValue, vle) {
    if (!vle || avgValue <= vle) return 1.0;
    return Math.max(0, 1 - (avgValue - vle) / vle);
  }

  /**
   * Récupère le résumé des KPIs pour une période
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} Résumé KPIs
   */
  async getKPISummary(period, periodStart, periodEnd) {
    try {
      const aggregates = await aggregateDataRepository.findByPeriod(
        period,
        periodStart,
      );

      const summary = {
        period,
        periodStart,
        periodEnd,
        polluants: [],
        globalIPE: null,
      };

      for (const agg of aggregates) {
        if (agg.polluantId) {
          summary.polluants.push({
            name: agg.polluantId.name,
            tauxDepassement: agg.tauxDepassement,
            emissionKgDay: agg.emissionKgDay,
            score: agg.score,
            avgValue: agg.avgValue,
            dataQuality: agg.dataQuality,
          });
        } else {
          summary.globalIPE = agg.overallScore;
        }
      }

      return summary;
    } catch (error) {
      console.error("Erreur récupération résumé KPIs:", error.message);
      throw error;
    }
  }

  /**
   * Nettoie les anciennes agrégations (> 1 an)
   * @returns {Promise<Object>} Résultat suppression
   */
  async cleanOldAggregates() {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const result = await aggregateDataRepository.deleteOldRecords(oneYearAgo);
      console.log(`✓ Nettoyage: ${result.deletedCount} agrégations supprimées`);

      return result;
    } catch (error) {
      console.error("Erreur nettoyage agrégations:", error.message);
      throw error;
    }
  }
}

module.exports = new AggregationService();
