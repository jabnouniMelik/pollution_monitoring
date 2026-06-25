/**
 * CONTROLLER : SITE CONFIG MANAGEMENT
 * Endpoints HTTP pour la gestion de la configuration du site
 * SUPER_ADMIN only pour modifications
 */

const siteConfigManagementService = require("../services/SiteConfigManagementService");

/**
 * GET /api/site-config
 * Récupère la configuration active du site
 */
const getActiveConfig = async (req, res, next) => {
  try {
    const config = await siteConfigManagementService.getActiveConfig();

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/site-config/:id/airflow
 * Met à jour le débit d'air Q_air (SUPER_ADMIN only)
 */
const updateAirflow = async (req, res, next) => {
  try {
    const { airflow } = req.body;

    if (airflow === undefined) {
      return res.status(400).json({
        success: false,
        message: "airflow requis (valeur numérique)",
      });
    }

    const updated = await siteConfigManagementService.updateAirflow(
      req.params.id,
      airflow,
      req.user
    );

    res.status(200).json({
      success: true,
      message: `Débit d'air mis à jour: ${airflow} Nm³/s`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/site-config/:id/weights
 * Met à jour les poids des polluants (SUPER_ADMIN only)
 */
const updatePollutantWeights = async (req, res, next) => {
  try {
    const { weights } = req.body;

    if (!weights || typeof weights !== "object") {
      return res.status(400).json({
        success: false,
        message: "weights requis (object avec NOx, SO2, PM25, PM10, COV, CO2)",
      });
    }

    const updated = await siteConfigManagementService.updatePollutantWeights(
      req.params.id,
      weights,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Poids des polluants mis à jour",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/site-config/:id/targets
 * Met à jour les objectifs KPI (SUPER_ADMIN only)
 */
const updateTargets = async (req, res, next) => {
  try {
    const { targets } = req.body;

    if (!targets || typeof targets !== "object") {
      return res.status(400).json({
        success: false,
        message: "targets requis (object avec tauxDepassement, ipe, reductionCO2, EMJ)",
      });
    }

    const updated = await siteConfigManagementService.updateTargets(
      req.params.id,
      targets,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Objectifs KPI mis à jour",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/site-config/:id
 * Met à jour la configuration complète (SUPER_ADMIN only)
 */
const updateCompleteConfig = async (req, res, next) => {
  try {
    const updated = await siteConfigManagementService.updateCompleteConfig(
      req.params.id,
      req.body,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Configuration mise à jour",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/site-config/targets
 * Récupère les objectifs KPI
 */
const getTargets = async (req, res, next) => {
  try {
    const targets = await siteConfigManagementService.getTargets();

    res.status(200).json({
      success: true,
      data: targets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/site-config/weights
 * Récupère les poids des polluants
 */
const getPolluantWeights = async (req, res, next) => {
  try {
    const weights = await siteConfigManagementService.getPolluantWeights();

    res.status(200).json({
      success: true,
      data: weights,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/site-config/airflow
 * Récupère le débit d'air
 */
const getAirflow = async (req, res, next) => {
  try {
    const airflow = await siteConfigManagementService.getAirflow();

    res.status(200).json({
      success: true,
      data: { airflow },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveConfig,
  updateAirflow,
  updatePollutantWeights,
  updateTargets,
  updateCompleteConfig,
  getTargets,
  getPolluantWeights,
  getAirflow,
};
