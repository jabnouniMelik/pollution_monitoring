/**
 * ROUTES : SITE MANAGEMENT
 * Endpoints pour gestion des sites industriels avec RBAC
 * Hierarchie: Industrie → Site → Zone
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const siteManagementController = require("../controllers/siteManagementController");

// Middleware: toutes les routes nécessitent authentication
router.use(verifyToken);

/**
 * POST /api/sites
 * Créer un site (SUPER_ADMIN, HEAD_SUPERVISOR)
 */
router.post(
  "/",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"),
  siteManagementController.createSite
);

/**
 * GET /api/sites
 * Récupérer sites (filtrage par rôle)
 * SUPER_ADMIN → tous les sites
 * HEAD_SUPERVISOR → sites de son industrie
 * SITE_SUPERVISOR → ses sites
 * OPERATOR → accès via zones
 */
router.get("/", siteManagementController.getSites);

/**
 * GET /api/sites/:id
 * Récupérer un site par ID (avec contrôle d'accès)
 */
router.get("/:id", siteManagementController.getSiteById);

/**
 * PUT /api/sites/:id
 * Mettre à jour un site
 * HEAD_SUPERVISOR ou SUPER_ADMIN
 */
router.put(
  "/:id",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"),
  siteManagementController.updateSite
);

/**
 * DELETE /api/sites/:id
 * Supprimer un site (SUPER_ADMIN only)
 * ⚠️ Impossible si zones existent
 */
router.delete(
  "/:id",
  checkRole("SUPER_ADMIN"),
  siteManagementController.deleteSite
);

/**
 * PUT /api/sites/:id/supervisor
 * Assigner un superviseur HEAD_SUPERVISOR (SUPER_ADMIN only)
 */
router.put(
  "/:id/supervisor",
  checkRole("SUPER_ADMIN"),
  siteManagementController.assignSupervisor
);

/**
 * GET /api/sites/industrie/:industrieId
 * Récupérer sites d'une industrie
 */
router.get(
  "/industrie/:industrieId",
  siteManagementController.getSitesByIndustrie
);

/**
 * GET /api/sites/:id/zones-count
 * Compter les zones d'un site
 */
router.get(
  "/:id/zones-count",
  siteManagementController.countZones
);

module.exports = router;
