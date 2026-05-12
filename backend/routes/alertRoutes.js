// ROUTES : ALERT
// Base URL : /api/alerts
//
// GET  /api/alerts              → liste alertes avec filtres
// GET  /api/alerts/stats        → statistiques alertes (KPIs)
// GET  /api/alerts/:id          → détail d'une alerte
// POST /api/alerts/:id/acknowledge → acquitter une alerte
// POST /api/alerts/:id/escalate    → escalader une alerte
//
// /stats AVANT /:id — sinon Express confond avec un ID

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

const {
  getAllAlerts,
  getAlertStats,
  getAlertById,
  acknowledgeAlert,
  escalateAlert,
  resolveAlert,
} = require("../controllers/alertController");

// All alert routes require authentication
router.use(verifyToken);

// Routes spéciales AVANT /:id
router.get("/stats", getAlertStats);

// Routes générales
router.route("/").get(getAllAlerts);

router.route("/:id").get(getAlertById);

// Actions sur une alerte
router.post("/:id/acknowledge", acknowledgeAlert);
router.post("/:id/escalate", escalateAlert);
router.post("/:id/resolve", resolveAlert);

module.exports = router;
