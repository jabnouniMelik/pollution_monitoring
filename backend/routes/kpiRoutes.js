/**
 * ROUTES : KPI
 * Endpoints pour les KPIs environnementaux
 */

const express = require("express");
const router = express.Router();
const kpiController = require("../controllers/kpiController");
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");

// ── Routes publiques (lecture KPIs) ────────────────────────────

// Calcul KPI 1 : Taux de Dépassement
router.get("/td/:polluantId", verifyToken, kpiController.getTauxDepassement);

// Calcul KPI 2 : Émission Moyenne par Jour
router.get("/emj/:polluantId", verifyToken, kpiController.getEmissionMoyenne);

// Calcul KPI 3 : Indice Performance Environnementale
router.get("/ipe", verifyToken, kpiController.getIPE);

// Calcul KPI 4 : Réduction CO2
router.get("/rco2/:polluantId", verifyToken, kpiController.getReductionCO2);

// Résumé KPIs pour une période
router.get("/summary", verifyToken, kpiController.getSummary);

// Historique agrégations pour un polluant
router.get("/history/:polluantId", verifyToken, kpiController.getHistory);

// Configuration du site
router.get("/config", verifyToken, kpiController.getConfig);

// ── Routes admin (modification config) ─────────────────────────

// Déclencher agrégation manuelle
router.post(
  "/aggregate",
  verifyToken,
  checkRole(["admin"]),
  kpiController.triggerAggregation,
);

// Mettre à jour débit d'air
router.put(
  "/config/airflow",
  verifyToken,
  checkRole(["admin"]),
  kpiController.updateAirflow,
);

// Mettre à jour poids polluants
router.put(
  "/config/weights",
  verifyToken,
  checkRole(["admin"]),
  kpiController.updateWeights,
);

// Mettre à jour objectifs KPI
router.put(
  "/config/targets",
  verifyToken,
  checkRole(["admin"]),
  kpiController.updateTargets,
);

module.exports = router;
