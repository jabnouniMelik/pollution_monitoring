/**
 * CONTROLLER : ALERT
 * Gère toutes les opérations HTTP pour les alertes
 * Logique métier déléguée à AlertService
 */

const alertService = require("../services/AlertService");
const { error_messages, success_messages } = require("../utils/constants");

function buildAlertScope(req) {
  const filter = {};

  if (req.query.severity) {
    const sev = req.query.severity.toLowerCase();
    if (sev === "warning") {
      filter.severity = { $in: ["Warning", "warning"] };
    } else if (sev === "critical") {
      filter.severity = {
        $in: ["Critical", "critical", "CRITICAL", "High", "high", "HIGH"],
      };
    } else if (sev === "info") {
      filter.severity = { $in: ["Info", "info", "INFO"] };
    }
  }

  if (req.query.status) {
    switch (req.query.status) {
      case "open":
        filter.isAcknowledged = false;
        filter.resolvedAt = null;
        break;
      case "acknowledged":
        filter.isAcknowledged = true;
        filter.resolvedAt = null;
        break;
      case "escalated":
        filter.isAcknowledged = false;
        filter.severity = {
          $in: ["High", "high", "HIGH", "Critical", "critical", "CRITICAL"],
        };
        break;
      case "resolved":
        filter.resolvedAt = { $ne: null };
        break;
    }
  }

  if (req.query.pollutant) filter._pollutantName = req.query.pollutant;
  if (req.query.polluantId) filter.PolluantId = req.query.polluantId;
  if (req.query.sensorId) filter.SensorId = req.query.sensorId;
  if (req.query.type) filter.type = req.query.type;

  if (req.query.zoneId) {
    filter._zoneId = req.query.zoneId;
  } else if (req.query.siteId) {
    filter._siteId = req.query.siteId;
  }

  if (req.query.isAcknowledged !== undefined) {
    filter.isAcknowledged = req.query.isAcknowledged === "true";
  }

  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
    if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
  }

  if (
    req.user.role === "SITE_SUPERVISOR" &&
    !filter._zoneId &&
    !filter._siteId
  ) {
    const sitesManaging = (req.user.sitesManaging || []).map((s) =>
      s._id ? s._id.toString() : s.toString(),
    );
    if (sitesManaging.length > 0) {
      filter._siteIds = sitesManaging;
    }
  } else if (
    req.user.role === "HEAD_SUPERVISOR" &&
    !filter._zoneId &&
    !filter._siteId
  ) {
    if (req.user.industryId) {
      filter._industryId = req.user.industryId.toString();
    }
  }

  return filter;
}

// ── GET /api/alerts ─────────────────────────────────────
// Retourne les alertes avec filtres avancés et pagination
const getAllAlerts = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;

    const filter = buildAlertScope(req);

    const result = await alertService.getAllAlertsPaginated(
      filter,
      page,
      pageSize,
    );

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/alerts/stats ────────────────────────────────
// Retourne les statistiques globales des alertes
const getAlertStats = async (req, res, next) => {
  try {
    const stats = await alertService.getAlertStats(buildAlertScope(req));

    // DB severities can be mixed case: "Warning", "High", "HIGH", "Critical", "CRITICAL"
    // Normalize everything to lowercase for counting
    const bySeverity = stats.bySeverity || [];

    let total = 0,
      critical = 0,
      warning = 0,
      info = 0;
    for (const s of bySeverity) {
      const key = (s._id || "").toLowerCase();
      const count = s.count || 0;
      total += count;
      if (key === "critical") critical += count;
      // 'high' maps to critical in the frontend (escalated state)
      else if (key === "high") critical += count;
      else if (key === "warning") warning += count;
      else if (key === "info") info += count;
    }

    const resolved = stats.totalResolved ?? 0;

    res.status(200).json({
      success: true,
      data: {
        total,
        critical,
        warning,
        info,
        open: stats.totalUnacknowledged ?? 0,
        acknowledged: total - (stats.totalUnacknowledged ?? 0) - resolved,
        resolved,
        bySeverity: stats.bySeverity,
        byPolluant: stats.byPolluant,
      },
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
    const userId =
      (req.user && (req.user._id || req.user.userId)) ||
      req.body.userId ||
      null;

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
    // If already acknowledged, return 409 — not a server error
    if (error.message && error.message.includes("déjà acquittée")) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// ── POST /api/alerts/:id/resolve ─────────────────────────
// Résout (clôture) une alerte. Acquitte implicitement si nécessaire.
const resolveAlert = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user._id || req.user.userId)) || null;
    const note = req.body?.note ?? null;

    const updated = await alertService.resolveAlert(
      req.params.id,
      userId,
      note,
    );

    res.status(200).json({
      success: true,
      message: "Alerte résolue avec succès",
      data: updated,
    });
  } catch (error) {
    if (error.message && error.message.includes("déjà résolue")) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
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
