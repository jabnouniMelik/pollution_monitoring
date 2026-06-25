/**
 * SERVICE : AGGREGATION
 * Orchestre le calcul et le stockage des données agrégées + KPIs
 * Exécution périodique via scheduler (HOURLY, DAILY, WEEKLY, MONTHLY)
 */

const aggregateDataRepository = require("../repositories/AggregateDataRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const readingRepository = require("../repositories/ReadingRepository");
const sensorNodeRepository = require("../repositories/SensorNodeRepository");
const zoneRepository = require("../repositories/ZoneRepository");
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
   * @param {String} siteId - ID site (required for aggregation)
   * @param {String|null} zoneId - Zone scope (null = site-level aggregate)
   * @param {String|null} sensorNodeId - Optional node scope (null = zone/site aggregate)
   * @returns {Promise<Object>} Document AggregateData créé
   */
  async aggregatePolluantData(
    polluantId,
    period,
    periodStart,
    periodEnd,
    siteId,
    zoneId = null,
    sensorNodeId = null,
  ) {
    const startTime = Date.now();

    try {
      // Vérifier si agrégation existe déjà
      const existing = await aggregateDataRepository.findExisting(
        polluantId,
        period,
        periodStart,
        siteId,
        zoneId,
        sensorNodeId,
      );

      // Récupérer statistiques brutes (filtrées par nodeId si fourni)
      const nodeIdFilter = sensorNodeId ? [sensorNodeId] : null;
      const stats = await readingRepository.aggregateByPolluantPeriod(
        polluantId,
        periodStart,
        periodEnd,
        nodeIdFilter,
      );

      if (!stats || stats.count === 0) {
        console.log(
          `Aucune donnée pour polluant ${polluantId} sur période ${period}`,
        );
        return null;
      }

      // Calculer KPIs (filtrés par nodeId si fourni)
      const [td, emj, warnings] = await Promise.all([
        kpiService.calculateTD(
          polluantId,
          periodStart,
          periodEnd,
          nodeIdFilter,
        ),
        kpiService.calculateEMJ(
          polluantId,
          periodStart,
          periodEnd,
          null,
          nodeIdFilter,
        ),
        kpiService.calculateWarningCount(
          polluantId,
          periodStart,
          periodEnd,
          nodeIdFilter,
        ),
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
      const dataQuality = await kpiService.calculateDataQuality(
        stats.count,
        periodStart,
        periodEnd,
      );

      // Calculer RCO2 pour polluants CO2/CO2e
      let rco2Data = { reductionPct: null, reductionAbsolute: null };
      if (polluant.name === "CO2" || polluant.name === "CO2e") {
        try {
          const referencePeriodStart = new Date(periodStart);
          const referencePeriodEnd = new Date(periodEnd);

          switch (period) {
            case "HOURLY":
              referencePeriodStart.setHours(referencePeriodStart.getHours() - 1);
              referencePeriodEnd.setHours(referencePeriodEnd.getHours() - 1);
              break;
            case "DAILY":
              referencePeriodStart.setDate(referencePeriodStart.getDate() - 1);
              referencePeriodEnd.setDate(referencePeriodEnd.getDate() - 1);
              break;
            case "WEEKLY":
              referencePeriodStart.setDate(referencePeriodStart.getDate() - 7);
              referencePeriodEnd.setDate(referencePeriodEnd.getDate() - 7);
              break;
            case "MONTHLY":
              referencePeriodStart.setMonth(referencePeriodStart.getMonth() - 1);
              referencePeriodEnd.setMonth(referencePeriodEnd.getMonth() - 1);
              break;
            default:
              referencePeriodStart.setDate(referencePeriodStart.getDate() - 1);
              referencePeriodEnd.setDate(referencePeriodEnd.getDate() - 1);
              break;
          }

          rco2Data = await kpiService.calculateRCO2(
            polluantId,
            periodStart,
            periodEnd,
            referencePeriodStart,
            referencePeriodEnd,
            nodeIdFilter,
          );
        } catch (err) {
          console.warn(
            `RCO2 calculation failed for ${polluant.name}:`,
            err.message,
          );
        }
      }

      // Préparer données agrégées
      const aggregateData = {
        siteId,
        zoneId,          // null for site-level, ObjectId for zone-level
        polluantId,
        sensorNodeId,    // null for zone/site aggregate, ObjectId for per-node
        period,
        periodStart,
        periodEnd,
        minValue: stats.minValue,
        maxValue: stats.maxValue,
        avgValue: stats.avgValue,
        stdDeviation: stdDev,
        sampleCount: stats.count,
        breachCount: td.breachCount,
        warningCount: warnings.warningCount,
        tauxDepassement: td.tauxDepassement,
        emissionKgDay: emj.emissionKgDay,
        score,
        reductionPct: rco2Data.reductionPct,
        reductionAbsolute: rco2Data.reductionAbsolute,
        calculatedAt: new Date(),
        calculationDuration: Date.now() - startTime,
        dataQuality,
      };

      // Upsert (créer ou mettre à jour)
      const result = await aggregateDataRepository.upsert(
        { polluantId, period, periodStart, siteId, zoneId, sensorNodeId },
        aggregateData,
      );

      const scope = zoneId ? `zone ${zoneId}` : `site ${siteId}`;
      console.log(
        `✓ Agrégation ${period} [${scope}] pour ${polluant.name}: TD=${td.tauxDepassement}%, EMJ=${emj.emissionKgDay} kg/j`,
      );

      return result;
    } catch (error) {
      console.error(`Erreur agrégation polluant ${polluantId}:`, error.message);
      throw error;
    }
  }

  /**
   * Agrège tous les polluants pour une période donnée — niveau ZONE
   * Résout les nœuds de la zone, agrège par polluant, puis calcule l'IPE de zone.
   *
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @param {String} zoneId - ID zone
   * @param {String} siteId - ID site parent
   * @returns {Promise<Array>} Array de documents créés
   */
  async aggregateAllPolluantsForZone(period, periodStart, periodEnd, zoneId, siteId) {
    try {
      const nodeIds = await sensorNodeRepository.findNodeIdsByZone(zoneId);
      if (!nodeIds || nodeIds.length === 0) {
        console.log(`  Aucun nœud pour zone ${zoneId} — agrégation ignorée`);
        return [];
      }

      const polluants = await polluantRepository.findAll();
      const results = [];

      for (const polluant of polluants) {
        const stats = await readingRepository.aggregateByPolluantPeriod(
          polluant._id, periodStart, periodEnd, nodeIds,
        );
        if (!stats || stats.count === 0) continue;

        const result = await this.aggregatePolluantData(
          polluant._id, period, periodStart, periodEnd, siteId, zoneId, null,
        );
        if (result) results.push(result);
      }

      if (results.length > 0) {
        await this.calculateZoneIPE(period, periodStart, periodEnd, zoneId, siteId, nodeIds);
      }

      return results;
    } catch (error) {
      console.error(`Erreur agrégation zone ${zoneId}:`, error.message);
      throw error;
    }
  }

  /**
   * Agrège tous les polluants pour une période donnée — niveau SITE
   * Itère sur toutes les zones actives du site, agrège par zone,
   * puis calcule l'IPE global du site.
   *
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @param {String} siteId - ID site (required)
   * @param {String|null} sensorNodeId - Kept for backward compat (ignored)
   * @returns {Promise<Array>} Array of aggregation results
   */
  async aggregateAllPolluants(
    period,
    periodStart,
    periodEnd,
    siteId,
    sensorNodeId = null,
  ) {
    try {
      const zones = await zoneRepository.findBySite(siteId);
      const allResults = [];

      if (zones.length === 0) {
        // Fallback : pas de zones configurées, agréger au niveau site directement
        console.log(`  Aucune zone pour site ${siteId} — agrégation site directe`);
        const polluants = await polluantRepository.findAll();
        for (const polluant of polluants) {
          const result = await this.aggregatePolluantData(
            polluant._id, period, periodStart, periodEnd, siteId, null, null,
          );
          if (result) allResults.push(result);
        }
      } else {
        for (const zone of zones) {
          try {
            const zoneResults = await this.aggregateAllPolluantsForZone(
              period, periodStart, periodEnd, zone._id.toString(), siteId,
            );
            allResults.push(...zoneResults);
          } catch (err) {
            console.error(`  ⚠️ Erreur zone ${zone.nom}: ${err.message}`);
          }
        }
      }

      if (allResults.length > 0) {
        await this.calculateGlobalIPE(period, periodStart, periodEnd, siteId);
      }

      return allResults;
    } catch (error) {
      console.error("Erreur agrégation tous polluants:", error.message);
      throw error;
    }
  }

  /**
   * Calcule l'IPE d'une zone et le stocke
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @param {String} zoneId - ID zone
   * @param {String} siteId - ID site
   * @param {Array} nodeIds - IDs des nœuds de la zone
   * @returns {Promise<Object>} Document AggregateData avec IPE zone
   */
  async calculateZoneIPE(period, periodStart, periodEnd, zoneId, siteId, nodeIds) {
    try {
      const { ipe, polluantScores } = await kpiService.calculateIPE(
        periodStart, periodEnd, null, nodeIds,
      );

      const zoneData = {
        siteId,
        zoneId,
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
        { siteId, zoneId, polluantId: null, period, periodStart },
        zoneData,
      );

      console.log(`✓ IPE zone ${zoneId} ${period}: ${ipe}/100`);
      return result;
    } catch (error) {
      console.error(`Erreur calcul IPE zone ${zoneId}:`, error.message);
      throw error;
    }
  }

  /**
   * Calcule l'IPE global du site et le stocke
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @param {String} siteId - ID site
   * @returns {Promise<Object>} Document AggregateData avec IPE global
   */
  async calculateGlobalIPE(period, periodStart, periodEnd, siteId) {
    try {
      const { ipe, polluantScores } = await kpiService.calculateIPE(
        periodStart,
        periodEnd,
      );

      // Créer enregistrement global site (polluantId null, zoneId null)
      const globalData = {
        siteId,
        zoneId: null,    // site-level aggregate
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
        { siteId, zoneId: null, polluantId: null, period, periodStart },
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
      const referencePeriodEnd = new Date(
        currentPeriodEnd.getTime() - duration,
      );

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
   * @param {Object} filters - { siteId (required), zoneId (optional) }
   * @returns {Promise<Object>} Résumé KPIs
   */
  async getKPISummary(period, periodStart, periodEnd, filters = {}) {
    try {
      const aggregates = await aggregateDataRepository.findByPeriod(
        period,
        periodStart,
        periodEnd,
        filters,
      );

      // Résoudre le filtre de nœuds si zoneId fourni (pour calcul live)
      let nodeFilter = null;
      if (filters.zoneId) {
        nodeFilter = await sensorNodeRepository.findNodeIdsByZone(filters.zoneId);
      }

      if (aggregates.length === 0) {
        const polluants = await polluantRepository.findAll();
        const polluantSummaries = [];
        const emj = {};
        let tdTotal = 0;
        let tdCount = 0;
        let rco2 = 0;

        for (const polluant of polluants) {
          // Use zone-resolved nodeFilter (already computed above)
          const [stats, td, emjValue] = await Promise.all([
            readingRepository.aggregateByPolluantPeriod(
              polluant._id,
              periodStart,
              periodEnd,
              nodeFilter,
            ),
            kpiService.calculateTD(
              polluant._id,
              periodStart,
              periodEnd,
              nodeFilter,
            ),
            kpiService.calculateEMJ(
              polluant._id,
              periodStart,
              periodEnd,
              null,
              nodeFilter,
            ),
          ]);

          if (!stats || stats.count === 0) continue;

          const avgValue = stats.avgValue;
          polluantSummaries.push({
            name: polluant.name,
            tauxDepassement: td.tauxDepassement,
            emissionKgDay: emjValue.emissionKgDay,
            score:
              polluant.regulatoryLimit && avgValue <= polluant.regulatoryLimit
                ? 100
                : Math.max(
                    0,
                    Math.round(
                      (1 -
                        (avgValue - (polluant.regulatoryLimit ?? avgValue)) /
                          (polluant.regulatoryLimit ?? avgValue)) *
                        100,
                    ),
                  ),
            avgValue,
            dataQuality: "LIVE",
          });

          emj[polluant.name] = emjValue.emissionKgDay;
          tdTotal += td.tauxDepassement;
          tdCount += 1;

          if (polluant.name === "CO2" || polluant.name === "CO2e") {
            // valeur provisoire ; rco2Detail recalculé juste après
            rco2 = 0;
          }
        }

        const ipeResult = await kpiService.calculateIPE(periodStart, periodEnd, null, nodeFilter);

        const co2Doc = await polluantRepository.findByName("CO2");
        let rco2Detail = null;
        if (co2Doc) {
          rco2Detail = await kpiService.calculateRCO2MonthOverMonth(
            co2Doc._id,
            nodeFilter,
            periodEnd,
          );
          rco2 = rco2Detail.reductionPct;
        }

        return {
          period,
          periodStart,
          periodEnd,
          zoneId: filters.zoneId || null,
          polluants: polluantSummaries,
          globalIPE: ipeResult.ipe,
          td: tdCount > 0 ? Number((tdTotal / tdCount).toFixed(2)) : 0,
          emj,
          ipe: ipeResult.ipe,
          rco2,
          rco2Detail: rco2Detail
            ? {
                reductionPct: rco2Detail.reductionPct,
                goalAttainmentPct: rco2Detail.goalAttainmentPct,
                goalTargetPct: rco2Detail.goalTargetPct,
                currentAvg: rco2Detail.currentAvg,
                previousAvg: rco2Detail.previousAvg,
              }
            : null,
          timestamp: new Date().toISOString(),
        };
      }

      const summary = {
        period,
        periodStart,
        periodEnd,
        zoneId: filters.zoneId || null,
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
          // Extract RCO2 from CO2 aggregate if available
          if (
            (agg.polluantId.name === "CO2" || agg.polluantId.name === "CO2e") &&
            agg.reductionPct !== null
          ) {
            summary.rco2 = agg.reductionPct;
          }
        } else {
          summary.globalIPE = agg.overallScore;
        }
      }

      const tdValues = summary.polluants
        .map((polluant) => Number(polluant.tauxDepassement ?? 0))
        .filter((value) => Number.isFinite(value));
      const emj = summary.polluants.reduce((accumulator, polluant) => {
        accumulator[polluant.name] = Number(polluant.emissionKgDay ?? 0);
        return accumulator;
      }, {});

      summary.td =
        tdValues.length > 0
          ? Number(
              (tdValues.reduce((a, b) => a + b, 0) / tdValues.length).toFixed(
                2,
              ),
            )
          : 0;
      summary.emj = emj;
      summary.ipe = Number(summary.globalIPE ?? 0);
      // rco2 is now extracted from CO2 aggregate above (or remains null if not available)
      if (summary.rco2 === undefined) {
        summary.rco2 = null;
      }
      summary.timestamp = new Date().toISOString();

      // Recalcul live IPE (intègre le TD) et RCO₂ mensuel vs M-1
      try {
        const ipeResult = await kpiService.calculateIPE(
          periodStart,
          periodEnd,
          null,
          nodeFilter,
        );
        summary.globalIPE = ipeResult.ipe;
        summary.ipe = ipeResult.ipe;

        const co2Doc = await polluantRepository.findByName("CO2");
        if (co2Doc) {
          const rco2Detail = await kpiService.calculateRCO2MonthOverMonth(
            co2Doc._id,
            nodeFilter,
            periodEnd,
          );
          summary.rco2 = rco2Detail.reductionPct;
          summary.rco2Detail = {
            reductionPct: rco2Detail.reductionPct,
            goalAttainmentPct: rco2Detail.goalAttainmentPct,
            goalTargetPct: rco2Detail.goalTargetPct,
            currentAvg: rco2Detail.currentAvg,
            previousAvg: rco2Detail.previousAvg,
          };
        }
      } catch (recalcErr) {
        console.warn("Recalcul IPE/RCO2 summary:", recalcErr.message);
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
