/**
 * ROUTES : SITE MANAGEMENT
 * Endpoints pour gestion des sites industriels avec RBAC
 * Hierarchie: Industrie → Site → Zone
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const {
  createSite, getSites, getSiteById, updateSite, deleteSite,
  approveSite, rejectSite, getPendingSites, prepareSite, getMyRequests,
  assignSupervisor, getSitesByIndustrie, countZones,
} = require("../controllers/siteManagementController");

// Middleware: toutes les routes nécessitent authentication
router.use(verifyToken);

// ── Special routes BEFORE /:id ────────────────────────────────
router.get("/pending", checkRole("SUPER_ADMIN"), getPendingSites);
router.get("/my-requests", getMyRequests);
router.get("/industrie/:industrieId", getSitesByIndustrie);

router.post("/", checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"), createSite);
router.get("/", getSites);
router.get("/:id", getSiteById);
router.put("/:id", checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"), updateSite);
router.delete("/:id", checkRole("SUPER_ADMIN"), deleteSite);

// Approval actions
router.post("/:id/approve", checkRole("SUPER_ADMIN"), approveSite);
router.post("/:id/reject", checkRole("SUPER_ADMIN"), rejectSite);
router.patch("/:id/prepare", checkRole("SUPER_ADMIN"), prepareSite);

router.put("/:id/supervisor", checkRole("SUPER_ADMIN"), assignSupervisor);
router.get("/:id/zones-count", countZones);

module.exports = router;
