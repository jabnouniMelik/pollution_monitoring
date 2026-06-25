/**
 * CONTROLLER : KPI
 * Gère les requêtes HTTP pour les KPIs environnementaux
 */

const kpiService = require("../services/KPIService");
const aggregationService = require("../services/AggregationService");
const aggregateDataRepository = require("../repositories/AggregateDataRepository");
const siteConfigRepository = require("../repositories/SiteConfigRepository");
const polluantRepository = require("../repositories/PolluantRepository");

function normalizeRco2Target(value, fallback = -5) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return n > 0 ? -n : n;
}

class KPIController {
  /**
   * GET /api/kpi/td/:polluantId
   * Calcule le Taux de Dépassement pour un polluant
   * Query params optionnels : zoneId, siteId
   */
  async getTauxDepassement(req, res, next) {
    try {
      const { polluantId } = req.params;
      const { periodStart, periodEnd, zoneId } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          error: "periodStart et periodEnd sont requis (format ISO 8601)",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      // Résoudre le filtre de nœuds si zoneId fourni
      let nodeIdFilter = null;
      if (zoneId) {
        nodeIdFilter = await kpiService.getNodeIdsForZone(zoneId);
        if (!nodeIdFilter.length) {
          return res.status(404).json({ error: "Aucun nœud trouvé pour cette zone" });
        }
      }

      const result = await kpiService.calculateTD(polluantId, start, end, nodeIdFilter);

      res.json({
        success: true,
        kpi: "TD",
        polluantId,
        zoneId: zoneId || null,
        periodStart: start,
        periodEnd: end,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kpi/emj/:polluantId
   * Calcule l'Émission Moyenne par Jour pour un polluant
   * Query params optionnels : zoneId, qAir
   */
  async getEmissionMoyenne(req, res, next) {
    try {
      const { polluantId } = req.params;
      const { periodStart, periodEnd, qAir, zoneId } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          error: "periodStart et periodEnd sont requis",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      const airflow = qAir ? parseFloat(qAir) : null;

      let nodeIdFilter = null;
      if (zoneId) {
        nodeIdFilter = await kpiService.getNodeIdsForZone(zoneId);
        if (!nodeIdFilter.length) {
          return res.status(404).json({ error: "Aucun nœud trouvé pour cette zone" });
        }
      }

      const result = await kpiService.calculateEMJ(polluantId, start, end, airflow, nodeIdFilter);

      res.json({
        success: true,
        kpi: "EMJ",
        polluantId,
        zoneId: zoneId || null,
        periodStart: start,
        periodEnd: end,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kpi/ipe
   * Calcule l'Indice de Performance Environnementale
   * Query params optionnels : zoneId (pour IPE d'une zone spécifique)
   */
  async getIPE(req, res, next) {
    try {
      const { periodStart, periodEnd, zoneId } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          error: "periodStart et periodEnd sont requis",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      let nodeIdFilter = null;
      if (zoneId) {
        nodeIdFilter = await kpiService.getNodeIdsForZone(zoneId);
        if (!nodeIdFilter.length) {
          return res.status(404).json({ error: "Aucun nœud trouvé pour cette zone" });
        }
      }

      const result = await kpiService.calculateIPE(start, end, null, nodeIdFilter);

      res.json({
        success: true,
        kpi: "IPE",
        zoneId: zoneId || null,
        periodStart: start,
        periodEnd: end,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kpi/rco2/:polluantId
   * Calcule la Réduction CO2 vs période précédente
   */
  async getReductionCO2(req, res, next) {
    try {
      const { polluantId } = req.params;
      const {
        currentPeriodStart,
        currentPeriodEnd,
        referencePeriodStart,
        referencePeriodEnd,
      } = req.query;

      if (
        !currentPeriodStart ||
        !currentPeriodEnd ||
        !referencePeriodStart ||
        !referencePeriodEnd
      ) {
        return res.status(400).json({
          error: "Toutes les dates de période sont requises",
        });
      }

      const result = await kpiService.calculateRCO2(
        polluantId,
        new Date(currentPeriodStart),
        new Date(currentPeriodEnd),
        new Date(referencePeriodStart),
        new Date(referencePeriodEnd),
      );

      res.json({
        success: true,
        kpi: "RCO2",
        polluantId,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/kpi/aggregate
   * Lance l'agrégation manuelle pour une période
   * Body : { period, periodStart, periodEnd, siteId (required) }
   */
  async triggerAggregation(req, res, next) {
    try {
      const { period, periodStart, periodEnd, siteId } = req.body;

      if (!period || !periodStart || !periodEnd) {
        return res.status(400).json({
          error: "period, periodStart et periodEnd sont requis",
        });
      }

      if (!siteId) {
        return res.status(400).json({
          error: "siteId est requis pour l'agrégation manuelle",
        });
      }

      const validPeriods = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          error: `period doit être: ${validPeriods.join(", ")}`,
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      const results = await aggregationService.aggregateAllPolluants(
        period,
        start,
        end,
        siteId,
      );

      res.json({
        success: true,
        message: "Agrégation terminée",
        period,
        siteId,
        periodStart: start,
        periodEnd: end,
        aggregatesCreated: results.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kpi/summary
   * Récupère le résumé des KPIs pour une période
   * Query params : period, periodStart, periodEnd, siteId (required), zoneId (optional)
   */
  async getSummary(req, res, next) {
    try {
      const { period, periodStart, periodEnd, siteId, zoneId } = req.query;

      if (!period || !periodStart || !periodEnd) {
        return res.status(400).json({
          error: "period, periodStart et periodEnd sont requis",
        });
      }

      if (!siteId) {
        return res.status(400).json({
          error: "siteId est requis pour filtrer par site",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      const filters = { siteId };
      if (zoneId) filters.zoneId = zoneId;

      const summary = await aggregationService.getKPISummary(
        period,
        start,
        end,
        filters,
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kpi/history/:polluantId
   * Récupère l'historique des agrégations pour un polluant
   * Query params : period, siteId (required), zoneId (optional), limit
   */
  async getHistory(req, res, next) {
    try {
      const { polluantId } = req.params;
      const { period, limit, siteId, zoneId } = req.query;

      if (!period) {
        return res.status(400).json({
          error: "period est requis (HOURLY, DAILY, WEEKLY, MONTHLY)",
        });
      }

      if (!siteId) {
        return res.status(400).json({
          error: "siteId est requis pour filtrer par site",
        });
      }

      const maxLimit = limit ? parseInt(limit) : 30;

      const filters = { siteId };
      if (zoneId) filters.zoneId = zoneId;

      const isGlobalIpe = polluantId === "global" || polluantId === "ipe";

      let history;
      if (isGlobalIpe) {
        history = await aggregateDataRepository.findIpeHistory(period, maxLimit, filters);
        if (history.length === 0 && zoneId) {
          history = await aggregateDataRepository.findIpeHistory(period, maxLimit, { siteId });
        }
        if (period === "DAILY") {
          const live = await kpiService.buildLiveDailyIpeHistory(
            siteId,
            zoneId || null,
            maxLimit,
          );
          if (live.length > 0) {
            history = live;
          }
        }
      } else {
        history = await aggregateDataRepository.findByPolluantAndPeriod(
          polluantId,
          period,
          maxLimit,
          filters,
        );
        if (history.length === 0 && zoneId) {
          history = await aggregateDataRepository.findByPolluantAndPeriod(
            polluantId,
            period,
            maxLimit,
            { siteId },
          );
        }
        if (history.length === 0 && period === "DAILY") {
          history = await kpiService.buildLiveDailyHistory(
            polluantId,
            siteId,
            zoneId || null,
            maxLimit,
          );
        }
      }

      if (!isGlobalIpe && period === "MONTHLY") {
        const polluant = await polluantRepository.findById(polluantId);
        if (
          polluant &&
          (polluant.name === "CO2" || polluant.name === "CO2e")
        ) {
          const hasValidRco2 = history.some(
            (row) =>
              row?.reductionPct != null &&
              Number.isFinite(Number(row.reductionPct)),
          );
          if (history.length === 0 || !hasValidRco2) {
            const live = await kpiService.buildLiveMonthlyRco2History(
              polluantId,
              siteId,
              zoneId || null,
              maxLimit,
            );
            if (live.length > 0) {
              history = live;
            }
          }
        }
      }

      res.json({
        success: true,
        polluantId: isGlobalIpe ? "global" : polluantId,
        period,
        zoneId: zoneId || null,
        count: history.length,
        data: history,
        source: history.length > 0 && history[0]?.dataQuality === "LIVE" ? "live" : "aggregate",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kpi/zones/:siteId
   * Récupère le résumé KPI de toutes les zones d'un site pour une période
   */
  async getZonesSummary(req, res, next) {
    try {
      const { siteId } = req.params;
      const { period, periodStart, periodEnd } = req.query;

      if (!period || !periodStart || !periodEnd) {
        return res.status(400).json({
          error: "period, periodStart et periodEnd sont requis",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      // Récupérer les agrégations zone-level pour ce site
      const zoneAggregates = await aggregateDataRepository.findZoneAggregatesBySite(
        siteId,
        period,
        start,
        end,
      );

      // Grouper par zone
      const byZone = {};
      for (const agg of zoneAggregates) {
        const zId = agg.zoneId?._id?.toString() || agg.zoneId?.toString();
        if (!zId) continue;
        if (!byZone[zId]) {
          byZone[zId] = {
            zoneId: zId,
            zoneName: agg.zoneId?.nom || null,
            zoneCode: agg.zoneId?.code || null,
            polluants: [],
            ipe: null,
          };
        }
        if (!agg.polluantId) {
          byZone[zId].ipe = agg.overallScore;
        } else {
          byZone[zId].polluants.push({
            name: agg.polluantId?.name,
            tauxDepassement: agg.tauxDepassement,
            emissionKgDay: agg.emissionKgDay,
            score: agg.score,
            avgValue: agg.avgValue,
            dataQuality: agg.dataQuality,
          });
        }
      }

      res.json({
        success: true,
        siteId,
        period,
        periodStart: start,
        periodEnd: end,
        zones: Object.values(byZone),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kpi/config
   * Récupère la configuration du site (Q_air, poids, objectifs)
   */
  async getConfig(req, res, next) {
    try {
      const config = await siteConfigRepository.getActiveConfig();

      if (!config) {
        return res.json({
          success: true,
          data: {
            siteName: null,
            airflow: null,
            polluantWeights: {},
            weights: {},
            targets: {
              TD: 2,
              IPE: 95,
              RCO2: -5,
              EMJ: null,
            },
            baseline: { CO2: 650 },
            baselineCo2: 650,
            expectedSampleIntervalSeconds: 30,
            location: null,
            isDefault: true,
          },
        });
      }

      res.json({
        success: true,
        data: {
          siteName: config.siteName,
          airflow: config.airflow,
          weights: siteConfigRepository.mapWeightsForApi(config.polluantWeights),
          targets: siteConfigRepository.mapTargetsForApi(config.targets),
          baseline: { CO2: config.baselineCo2 ?? 650 },
          baselineCo2: config.baselineCo2 ?? 650,
          expectedSampleIntervalSeconds:
            config.expectedSampleIntervalSeconds ?? 30,
          location: config.location,
          isDefault: false,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/kpi/config/airflow
   * Met à jour le débit d'air (Q_air)
   */
  async updateAirflow(req, res, next) {
    try {
      const { airflow } = req.body;
      const userId = req.user?.userId;

      if (!airflow || airflow <= 0) {
        return res.status(400).json({
          error: "airflow doit être > 0 (Nm³/s)",
        });
      }

      const config = await siteConfigRepository.updateAirflow(airflow, userId);

      res.json({
        success: true,
        message: "Débit d'air mis à jour",
        data: {
          airflow: config.airflow,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateBaseline(req, res, next) {
    try {
      const { baselineCo2 } = req.body;
      const userId = req.user?.userId;

      const config = await siteConfigRepository.updateBaselineCo2(
        baselineCo2,
        userId,
      );

      res.json({
        success: true,
        message: "Baseline CO₂ mise à jour",
        data: {
          baselineCo2: config.baselineCo2,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSampleInterval(req, res, next) {
    try {
      const { expectedSampleIntervalSeconds } = req.body;
      const userId = req.user?.userId;

      const config = await siteConfigRepository.updateSampleInterval(
        expectedSampleIntervalSeconds,
        userId,
      );

      res.json({
        success: true,
        message: "Intervalle d'échantillonnage mis à jour",
        data: {
          expectedSampleIntervalSeconds: config.expectedSampleIntervalSeconds,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWeights(req, res, next) {
    try {
      const { weights } = req.body;
      const userId = req.user?.userId;

      if (!weights || typeof weights !== "object") {
        return res.status(400).json({
          error: "weights doit être un objet { polluantName: weight }",
        });
      }

      const config = await siteConfigRepository.updatePolluantWeights(
        weights,
        userId,
      );

      res.json({
        success: true,
        message: "Poids des polluants mis à jour",
        data: {
          weights: siteConfigRepository.mapWeightsForApi(config.polluantWeights),
          polluantWeights: config.polluantWeights,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/kpi/config/targets
   * Met à jour les objectifs KPI
   */
  async updateTargets(req, res, next) {
    try {
      const { targets } = req.body;
      const userId = req.user?.userId;

      if (!targets || typeof targets !== "object") {
        return res.status(400).json({
          error: "targets doit être un objet",
        });
      }

      const config = await siteConfigRepository.updateTargets(targets, userId);

      res.json({
        success: true,
        message: "Objectifs KPI mis à jour",
        data: {
          targets: siteConfigRepository.mapTargetsForApi(config.targets),
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new KPIController();
