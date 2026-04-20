/**
 * CONTROLLER : KPI
 * Gère les requêtes HTTP pour les KPIs environnementaux
 */

const kpiService = require("../services/KPIService");
const aggregationService = require("../services/AggregationService");
const aggregateDataRepository = require("../repositories/AggregateDataRepository");
const siteConfigRepository = require("../repositories/SiteConfigRepository");

class KPIController {
  /**
   * GET /api/kpi/td/:polluantId
   * Calcule le Taux de Dépassement pour un polluant
   */
  async getTauxDepassement(req, res, next) {
    try {
      const { polluantId } = req.params;
      const { periodStart, periodEnd } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          error: "periodStart et periodEnd sont requis (format ISO 8601)",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      const result = await kpiService.calculateTD(polluantId, start, end);

      res.json({
        success: true,
        kpi: "TD",
        polluantId,
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
   */
  async getEmissionMoyenne(req, res, next) {
    try {
      const { polluantId } = req.params;
      const { periodStart, periodEnd, qAir } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          error: "periodStart et periodEnd sont requis",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      const airflow = qAir ? parseFloat(qAir) : null;

      const result = await kpiService.calculateEMJ(
        polluantId,
        start,
        end,
        airflow,
      );

      res.json({
        success: true,
        kpi: "EMJ",
        polluantId,
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
   * Calcule l'Indice de Performance Environnementale global
   */
  async getIPE(req, res, next) {
    try {
      const { periodStart, periodEnd } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          error: "periodStart et periodEnd sont requis",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      const result = await kpiService.calculateIPE(start, end);

      res.json({
        success: true,
        kpi: "IPE",
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
   */
  async triggerAggregation(req, res, next) {
    try {
      const { period, periodStart, periodEnd } = req.body;

      if (!period || !periodStart || !periodEnd) {
        return res.status(400).json({
          error: "period, periodStart et periodEnd sont requis",
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
      );

      res.json({
        success: true,
        message: "Agrégation terminée",
        period,
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
   */
  async getSummary(req, res, next) {
    try {
      const { period, periodStart, periodEnd } = req.query;

      if (!period || !periodStart || !periodEnd) {
        return res.status(400).json({
          error: "period, periodStart et periodEnd sont requis",
        });
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      const summary = await aggregationService.getKPISummary(
        period,
        start,
        end,
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
   */
  async getHistory(req, res, next) {
    try {
      const { polluantId } = req.params;
      const { period, limit } = req.query;

      if (!period) {
        return res.status(400).json({
          error: "period est requis (HOURLY, DAILY, WEEKLY, MONTHLY)",
        });
      }

      const maxLimit = limit ? parseInt(limit) : 30;

      const history = await aggregateDataRepository.findByPolluantAndPeriod(
        polluantId,
        period,
        maxLimit,
      );

      res.json({
        success: true,
        polluantId,
        period,
        count: history.length,
        data: history,
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

      // If no config has been seeded yet, return a 200 with safe defaults
      // instead of a 404. This keeps clients usable before `npm run init:kpi`
      // has been executed and avoids a cascade of 404-driven UI errors.
      if (!config) {
        return res.json({
          success: true,
          data: {
            siteName: null,
            airflow: null,
            polluantWeights: {},
            targets: {},
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
          polluantWeights: config.polluantWeights,
          targets: config.targets,
          location: config.location,
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
      const userId = req.user?._id;

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

  /**
   * PUT /api/kpi/config/weights
   * Met à jour les poids des polluants pour IPE
   */
  async updateWeights(req, res, next) {
    try {
      const { weights } = req.body;
      const userId = req.user?._id;

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
      const userId = req.user?._id;

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
          targets: config.targets,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new KPIController();
