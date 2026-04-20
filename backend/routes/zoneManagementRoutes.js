/**
 * ROUTES : ZONE MANAGEMENT
 * Endpoints pour gestion des zones de monitoring avec RBAC
 * Hierarchie: Site → Zone → SensorNode
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const zoneManagementController = require("../controllers/zoneManagementController");

// Middleware: toutes les routes nécessitent authentication
router.use(verifyToken);

/**
 * POST /api/zones
 * Créer une zone (SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR)
 */
router.post(
  "/",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  zoneManagementController.createZone
);

/**
 * GET /api/zones
 * Récupérer zones (filtrage par rôle)
 * SUPER_ADMIN → toutes les zones
 * HEAD_SUPERVISOR → zones de son industrie
 * SITE_SUPERVISOR → zones de ses sites
 * OPERATOR → ses zones assignées
 */
router.get("/", zoneManagementController.getZones);

/**
 * GET /api/zones/:id
 * Récupérer une zone par ID (avec contrôle d'accès)
 */
router.get("/:id", zoneManagementController.getZoneById);

/**
 * PUT /api/zones/:id
 * Mettre à jour une zone
 * SUPER_ADMIN, HEAD_SUPERVISOR, ou SITE_SUPERVISOR
 */
router.put(
  "/:id",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  zoneManagementController.updateZone
);

/**
 * DELETE /api/zones/:id
 * Supprimer une zone (SUPER_ADMIN only)
 * ⚠️ Impossible si capteurs existent
 */
router.delete(
  "/:id",
  checkRole("SUPER_ADMIN"),
  zoneManagementController.deleteZone
);

/**
 * POST /api/zones/:id/operators
 * Assigner un opérateur à une zone
 * SUPER_ADMIN, HEAD_SUPERVISOR, ou SITE_SUPERVISOR
 */
router.post(
  "/:id/operators",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  zoneManagementController.assignOperator
);

/**
 * DELETE /api/zones/:id/operators/:operatorId
 * Retirer un opérateur d'une zone
 * SUPER_ADMIN, HEAD_SUPERVISOR, ou SITE_SUPERVISOR
 */
router.delete(
  "/:id/operators/:operatorId",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  zoneManagementController.removeOperator
);

/**
 * GET /api/zones/site/:siteId
 * Récupérer zones d'un site
 */
router.get(
  "/site/:siteId",
  zoneManagementController.getZonesBySite
);

/**
 * GET /api/zones/:id/sensors-count
 * Compter les capteurs d'une zone
 */
router.get(
  "/:id/sensors-count",
  zoneManagementController.countSensors
);

module.exports = router;
