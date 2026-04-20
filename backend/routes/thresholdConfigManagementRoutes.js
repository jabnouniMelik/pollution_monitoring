/**
 * ROUTES : THRESHOLD CONFIG MANAGEMENT
 * Endpoints pour gestion des seuils réglementaires (Décret 2010-2516)
 * Limites d'émission, warning/critical thresholds
 * SUPER_ADMIN only pour modifications
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const thresholdConfigManagementController = require("../controllers/thresholdConfigManagementController");

// Middleware: toutes les routes nécessitent authentication
router.use(verifyToken);

/**
 * GET /api/thresholds
 * Récupérer la configuration active des seuils
 * Accessible à tous les rôles authentifiés (lecture seule)
 */
router.get("/", thresholdConfigManagementController.getActiveConfig);

/**
 * GET /api/thresholds/all
 * Récupérer tous les seuils (historique) - SUPER_ADMIN only
 */
router.get(
  "/all",
  checkRole("SUPER_ADMIN"),
  thresholdConfigManagementController.getAllConfigs
);

/**
 * GET /api/thresholds/pollutant/:pollutantName
 * Récupérer les limites d'un polluant spécifique
 */
router.get(
  "/pollutant/:pollutantName",
  thresholdConfigManagementController.getPollutantLimits
);

/**
 * GET /api/thresholds/report
 * Récupérer un rapport de conformité
 */
router.get(
  "/report",
  thresholdConfigManagementController.getComplianceReport
);

/**
 * PUT /api/thresholds/:id/pollutant/:pollutantName
 * Mettre à jour les limites d'un polluant (SUPER_ADMIN only)
 * Body: { min, max, unit?, reference? }
 * Warning et Critical recalculés automatiquement
 */
router.put(
  "/:id/pollutant/:pollutantName",
  checkRole("SUPER_ADMIN"),
  thresholdConfigManagementController.updatePollutantLimits
);

/**
 * PUT /api/thresholds/:id/offsets
 * Mettre à jour les pourcentages de calcul (SUPER_ADMIN only)
 * Body: { warningOffset: number, criticalOffset: number }
 */
router.put(
  "/:id/offsets",
  checkRole("SUPER_ADMIN"),
  thresholdConfigManagementController.updateOffsets
);

/**
 * PUT /api/thresholds/:id/all-pollutants
 * Mettre à jour tous les polluants en masse (SUPER_ADMIN only)
 * Body: { pollutantsData: { NOx: {...}, SO2: {...}, ... } }
 */
router.put(
  "/:id/all-pollutants",
  checkRole("SUPER_ADMIN"),
  thresholdConfigManagementController.updateAllPollutants
);

/**
 * POST /api/thresholds/:id/clone
 * Cloner une configuration pour versioning (SUPER_ADMIN only)
 */
router.post(
  "/:id/clone",
  checkRole("SUPER_ADMIN"),
  thresholdConfigManagementController.cloneConfig
);

/**
 * PUT /api/thresholds/:id/reset
 * Réinitialiser aux valeurs par défaut (SUPER_ADMIN only)
 * Décret 2010-2516 (Tunisie)
 */
router.put(
  "/:id/reset",
  checkRole("SUPER_ADMIN"),
  thresholdConfigManagementController.resetToDefaults
);

module.exports = router;
