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

// Calcul KPI 1 : Taux de Dépassement (optionnel: ?zoneId=)
router.get("/td/:polluantId", verifyToken, kpiController.getTauxDepassement);

// Calcul KPI 2 : Émission Moyenne par Jour (optionnel: ?zoneId=)
router.get("/emj/:polluantId", verifyToken, kpiController.getEmissionMoyenne);

// Calcul KPI 3 : Indice Performance Environnementale (optionnel: ?zoneId=)
router.get("/ipe", verifyToken, kpiController.getIPE);

// Calcul KPI 4 : Réduction CO2
router.get("/rco2/:polluantId", verifyToken, kpiController.getReductionCO2);

// Résumé KPIs pour une période (requis: siteId, optionnel: zoneId)
router.get("/summary", verifyToken, kpiController.getSummary);

// Résumé KPIs par zone pour un site entier
router.get("/zones/:siteId", verifyToken, kpiController.getZonesSummary);

// Historique agrégations pour un polluant (requis: siteId, optionnel: zoneId)
router.get("/history/:polluantId", verifyToken, kpiController.getHistory);

// Configuration du site
router.get("/config", verifyToken, kpiController.getConfig);

// ── Routes admin (modification config) ─────────────────────────

// Déclencher agrégation manuelle (SUPER_ADMIN, HEAD_SUPERVISOR)
router.post(
  "/aggregate",
  verifyToken,
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"),
  kpiController.triggerAggregation,
);

// Mettre à jour débit d'air (SUPER_ADMIN)
router.put(
  "/config/airflow",
  verifyToken,
  checkRole("SUPER_ADMIN"),
  kpiController.updateAirflow,
);

router.put(
  "/config/baseline",
  verifyToken,
  checkRole("SUPER_ADMIN"),
  kpiController.updateBaseline,
);

router.put(
  "/config/sample-interval",
  verifyToken,
  checkRole("SUPER_ADMIN"),
  kpiController.updateSampleInterval,
);

// Mettre à jour poids polluants (SUPER_ADMIN)
router.put(
  "/config/weights",
  verifyToken,
  checkRole("SUPER_ADMIN"),
  kpiController.updateWeights,
);

// Mettre à jour objectifs KPI (SUPER_ADMIN)
router.put(
  "/config/targets",
  verifyToken,
  checkRole("SUPER_ADMIN"),
  kpiController.updateTargets,
);

module.exports = router;
