/**
 * ROUTES : USER MANAGEMENT
 * Endpoints pour gestion des utilisateurs avec RBAC
 * Toutes les routes protégées par verifyToken + checkRole
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const userManagementController = require("../controllers/userManagementController");

console.log("[ROUTE FILE] userManagementRoutes.js loaded");

// ⚠️ CRITICAL: Apply middleware FIRST, before registering any routes
// Otherwise middleware won't protect all routes
console.log("[ROUTE FILE] Applying verifyToken middleware FIRST (before routes)");
router.use(verifyToken);
console.log("[ROUTE FILE] verifyToken middleware applied");

/**
 * POST /api/users
 * Créer un utilisateur
 * SUPER_ADMIN → any role
 * SITE_SUPERVISOR → OPERATOR only (in their industry)
 */
router.post(
  "/",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  userManagementController.createUser
);

/**
 * GET /api/users
 * Récupérer utilisateurs (filtrage par rôle)
 * SUPER_ADMIN → tous
 * HEAD_SUPERVISOR → son industrie
 * SITE_SUPERVISOR → opérateurs de son industrie
 * OPERATOR/AUDITOR → accès refusé
 */
router.get("/", userManagementController.getUsers);

/**
 * GET /api/users/:id
 * Récupérer un utilisateur par ID
 */
router.get("/:id", userManagementController.getUserById);

/**
 * PUT /api/users/:id
 * Mettre à jour un utilisateur (SUPER_ADMIN only)
 */
router.put(
  "/:id",
  checkRole("SUPER_ADMIN"),
  userManagementController.updateUser
);

/**
 * DELETE /api/users/:id
 * Supprimer un utilisateur
 * SUPER_ADMIN → any user
 * SITE_SUPERVISOR → OPERATOR in their industry only
 */
router.delete(
  "/:id",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  userManagementController.deleteUser
);

router.post(
  "/:id/sites",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"),
  userManagementController.assignSites
);

router.post(
  "/:id/zones",
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  userManagementController.assignZones
);

/**
 * PUT /api/users/:id/role
 * Changer le rôle d'un utilisateur (SUPER_ADMIN only)
 */
router.put(
  "/:id/role",
  checkRole("SUPER_ADMIN"),
  userManagementController.changeRole
);

/**
 * GET /api/users/role/:role
 * Récupérer utilisateurs par rôle (SUPER_ADMIN only)
 */
router.get(
  "/role/:role",
  checkRole("SUPER_ADMIN"),
  userManagementController.getUsersByRole
);

module.exports = router;
