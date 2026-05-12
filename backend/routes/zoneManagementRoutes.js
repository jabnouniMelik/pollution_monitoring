/**
 * ROUTES : ZONE MANAGEMENT
 * Endpoints pour gestion des zones de monitoring avec RBAC
 * Hierarchie: Site → Zone → SensorNode
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const {
  createZone, getZones, getZoneById, updateZone, deleteZone,
  approveZone, rejectZone, getPendingZones, prepareZone,
  assignOperator, removeOperator, getZonesBySite, countSensors,
} = require("../controllers/zoneManagementController");

// Middleware: toutes les routes nécessitent authentication
router.use(verifyToken);

// ── Special routes BEFORE /:id ────────────────────────────────
router.get("/pending", checkRole("SUPER_ADMIN"), getPendingZones);
router.get("/site/:siteId", getZonesBySite);

router.post("/", checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"), createZone);
router.get("/", getZones);
router.get("/:id", getZoneById);
router.put("/:id", checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"), updateZone);
router.delete("/:id", checkRole("SUPER_ADMIN"), deleteZone);

// Approval actions
router.post("/:id/approve", checkRole("SUPER_ADMIN"), approveZone);
router.post("/:id/reject", checkRole("SUPER_ADMIN"), rejectZone);
router.patch("/:id/prepare", checkRole("SUPER_ADMIN"), prepareZone);

router.post("/:id/operators", checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"), assignOperator);
router.delete("/:id/operators/:operatorId", checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"), removeOperator);
router.get("/:id/sensors-count", countSensors);

module.exports = router;
