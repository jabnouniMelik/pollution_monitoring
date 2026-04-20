/**
 * CONTROLLER : ALERT
 * Gère toutes les opérations HTTP pour les alertes
 * Logique métier déléguée à AlertService
 */

const alertService = require("../services/AlertService");
const { error_messages, success_messages } = require("../utils/constants");

// ── GET /api/alerts ─────────────────────────────────────
// Retourne les alertes avec filtres avancés
const getAllAlerts = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.polluantId) filter.PolluantId = req.query.polluantId;
    if (req.query.sensorId) filter.SensorId = req.query.sensorId;
    if (req.query.type) filter.type = req.query.type;

    if (req.query.isAcknowledged !== undefined) {
      filter.isAcknowledged = req.query.isAcknowledged === "true";
    }

    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
    }

    const limit = parseInt(req.query.limit) || 50;

    const alerts = await alertService.getAllAlerts(filter, limit);

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/alerts/stats ────────────────────────────────
// Retourne les statistiques globales des alertes
const getAlertStats = async (req, res, next) => {
  try {
    const stats = await alertService.getAlertStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/alerts/:id ──────────────────────────────────
// Retourne le détail complet d'une alerte
const getAlertById = async (req, res, next) => {
  try {
    const alert = await alertService.getAlertById(req.params.id);

    res.status(200).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/alerts/:id/acknowledge ──────────────────────
// Acquitte une alerte — marque comme traitée
const acknowledgeAlert = async (req, res, next) => {
  try {
    const userId = req.body.userId || null;

    const updated = await alertService.acknowledgeAlert(req.params.id, userId);

    res.status(200).json({
      success: true,
      message: "Alerte acquittée avec succès",
      data: {
        _id: updated._id,
        severity: updated.severity,
        message: updated.message,
        isAcknowledged: updated.isAcknowledged,
        acknowledgedAt: updated.acknowledgedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/alerts/:id/resolve ─────────────────────────
// Résout (clôture) une alerte. Acquitte implicitement si nécessaire.
const resolveAlert = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user._id || req.user.id)) || null;
    const note = req.body?.note ?? null;

    const updated = await alertService.resolveAlert(req.params.id, userId, note);

    res.status(200).json({
      success: true,
      message: "Alerte résolue avec succès",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/alerts/:id/escalate ────────────────────────
// Escalade une alerte vers le niveau de gravité supérieur
const escalateAlert = async (req, res, next) => {
  try {
    const { newSeverity, reason } = req.body;

    const updated = await alertService.escalateAlert(
      req.params.id,
      newSeverity,
      reason,
    );

    res.status(200).json({
      success: true,
      message: `Alerte escaladée avec succès`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAlerts,
  getAlertStats,
  getAlertById,
  acknowledgeAlert,
  escalateAlert,
  resolveAlert,
};
