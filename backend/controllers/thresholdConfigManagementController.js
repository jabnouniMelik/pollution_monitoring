/**
 * CONTROLLER : THRESHOLD CONFIG MANAGEMENT
 * Endpoints HTTP pour la gestion des seuils réglementaires
 * SUPER_ADMIN only pour modifications
 */

const thresholdConfigManagementService = require("../services/ThresholdConfigManagementService");

/**
 * GET /api/thresholds
 * Récupère la configuration active des seuils
 */
const getActiveConfig = async (req, res, next) => {
  try {
    const config = await thresholdConfigManagementService.getActiveConfig();

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/thresholds/all
 * Récupère tous les seuils (historique) - SUPER_ADMIN only
 */
const getAllConfigs = async (req, res, next) => {
  try {
    const configs = await thresholdConfigManagementService.getAllConfigs(req.user);

    res.status(200).json({
      success: true,
      data: configs,
      count: configs.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/thresholds/:id/pollutant/:pollutantName
 * Met à jour les limites d'un polluant (SUPER_ADMIN only)
 */
const updatePollutantLimits = async (req, res, next) => {
  try {
    const { pollutantName } = req.params;
    const { min, max, unit, reference } = req.body;

    if (min === undefined || max === undefined) {
      return res.status(400).json({
        success: false,
        message: "min et max requis",
      });
    }

    const updated = await thresholdConfigManagementService.updatePollutantLimits(
      req.params.id,
      pollutantName,
      { min, max, unit, reference },
      req.user
    );

    res.status(200).json({
      success: true,
      message: `Limites du polluant ${pollutantName} mises à jour`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/thresholds/:id/offsets
 * Met à jour les pourcentages de calcul des seuils (SUPER_ADMIN only)
 */
const updateOffsets = async (req, res, next) => {
  try {
    const { warningOffset, criticalOffset } = req.body;

    if (warningOffset === undefined || criticalOffset === undefined) {
      return res.status(400).json({
        success: false,
        message: "warningOffset et criticalOffset requis",
      });
    }

    const updated = await thresholdConfigManagementService.updateOffsets(
      req.params.id,
      warningOffset,
      criticalOffset,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Offsets mis à jour",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/thresholds/:id/all-pollutants
 * Met à jour tous les polluants (SUPER_ADMIN only)
 */
const updateAllPollutants = async (req, res, next) => {
  try {
    const { pollutantsData } = req.body;

    if (!pollutantsData || typeof pollutantsData !== "object") {
      return res.status(400).json({
        success: false,
        message: "pollutantsData requis (object)",
      });
    }

    const updated = await thresholdConfigManagementService.updateAllPollutants(
      req.params.id,
      pollutantsData,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Tous les polluants mises à jour",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/thresholds/pollutant/:pollutantName
 * Récupère les limites d'un polluant spécifique
 */
const getPollutantLimits = async (req, res, next) => {
  try {
    const limits = await thresholdConfigManagementService.getPollutantLimits(
      req.params.pollutantName
    );

    if (!limits) {
      return res.status(404).json({
        success: false,
        message: "Polluant non trouvé",
      });
    }

    res.status(200).json({
      success: true,
      data: limits,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/thresholds/:id/clone
 * Clone une configuration (SUPER_ADMIN only)
 */
const cloneConfig = async (req, res, next) => {
  try {
    const cloned = await thresholdConfigManagementService.cloneConfig(
      req.params.id,
      req.user
    );

    res.status(201).json({
      success: true,
      message: "Configuration clonée avec succès",
      data: cloned,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/thresholds/:id/reset
 * Réinitialise aux valeurs par défaut (SUPER_ADMIN only)
 */
const resetToDefaults = async (req, res, next) => {
  try {
    const reset = await thresholdConfigManagementService.resetToDefaults(
      req.params.id,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Configuration réinitialisée aux valeurs par défaut (Décret 2018-928)",
      data: reset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/thresholds/report
 * Récupère un rapport de conformité
 */
const getComplianceReport = async (req, res, next) => {
  try {
    const report = await thresholdConfigManagementService.getComplianceReport();

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveConfig,
  getAllConfigs,
  updatePollutantLimits,
  updateOffsets,
  updateAllPollutants,
  getPollutantLimits,
  cloneConfig,
  resetToDefaults,
  getComplianceReport,
};
