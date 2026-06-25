/**
 * ROUTES : SITE CONFIG MANAGEMENT
 * Endpoints pour gestion de la configuration du site
 * Paramètres techniques: Q_air, pollutant weights, KPI targets
 * SUPER_ADMIN only pour modifications
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const siteConfigManagementController = require("../controllers/siteConfigManagementController");

// Middleware: toutes les routes nécessitent authentication
router.use(verifyToken);

/**
 * GET /api/site-config
 * Récupérer la configuration active du site
 * Accessible à tous les rôles authentifiés (lecture seule)
 */
router.get("/", siteConfigManagementController.getActiveConfig);

/**
 * GET /api/site-config/targets
 * Récupérer les objectifs KPI
 */
router.get("/targets", siteConfigManagementController.getTargets);

/**
 * GET /api/site-config/weights
 * Récupérer les poids des polluants (pour IPE)
 */
router.get("/weights", siteConfigManagementController.getPolluantWeights);

/**
 * GET /api/site-config/airflow
 * Récupérer le débit d'air (Q_air)
 */
router.get("/airflow", siteConfigManagementController.getAirflow);

/**
 * PUT /api/site-config/:id/airflow
 * Mettre à jour le débit d'air (SUPER_ADMIN only)
 * Body: { airflow: number (0.1-100 Nm³/s) }
 */
router.put(
  "/:id/airflow",
  checkRole("SUPER_ADMIN"),
  siteConfigManagementController.updateAirflow
);

/**
 * PUT /api/site-config/:id/weights
 * Mettre à jour les poids des polluants (SUPER_ADMIN only)
 * Body: { weights: { NOx, SO2, PM25, PM10, COV, CO2 } }
 * Somme doit égaler 1.0
 */
router.put(
  "/:id/weights",
  checkRole("SUPER_ADMIN"),
  siteConfigManagementController.updatePollutantWeights
);

/**
 * PUT /api/site-config/:id/targets
 * Mettre à jour les objectifs KPI (SUPER_ADMIN only)
 * Body: { targets: { tauxDepassement, ipe, reductionCO2 } }
 */
router.put(
  "/:id/targets",
  checkRole("SUPER_ADMIN"),
  siteConfigManagementController.updateTargets
);

/**
 * PUT /api/site-config/:id
 * Mettre à jour la configuration complète (SUPER_ADMIN only)
 */
router.put(
  "/:id",
  checkRole("SUPER_ADMIN"),
  siteConfigManagementController.updateCompleteConfig
);

module.exports = router;
