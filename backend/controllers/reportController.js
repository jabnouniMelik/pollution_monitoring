/**
 * CONTROLLER : REPORT
 * Gère toutes les opérations HTTP pour les rapports réglementaires ANPE
 * Logique métier déléguée à ReportService
 */

const reportService = require("../services/ReportService");
const { error_messages, success_messages } = require("../utils/constants");

// ── GET /api/reports ─────────────────────────────────────
// Liste tous les rapports
// ?status=DRAFT/SUBMITTED/APPROVED → filtrer par statut
const getAllReports = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const reports = await reportService.getAllReports(filter);

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/reports/:id ─────────────────────────────────
const getReportById = async (req, res, next) => {
  try {
    const report = await reportService.getReportById(req.params.id);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/reports/generate ─────────────────────────────
const generateReport = async (req, res, next) => {
  try {
    const {
      periodStart,
      periodEnd,
      title,
      format,
      siteId,
      zoneId,
      includeCompliance,
      includeAlerts,
    } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "periodStart et periodEnd sont requis",
      });
    }

    const generatedBy = req.user?.userId || null;

    const report = await reportService.generateReport({
      periodStart,
      periodEnd,
      generatedBy,
      title,
      format,
      siteId: siteId || null,
      zoneId: zoneId || null,
      includeCompliance: includeCompliance !== false,
      includeAlerts: includeAlerts !== false,
    });

    res.status(201).json({
      success: true,
      message: `Rapport généré — Score IPE : ${report.overallScore}/100 — ${report.breachCount} dépassement(s)`,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/reports/:id/submit ──────────────────────────
// Soumet le rapport à l'autorité réglementaire (ANPE)
// Change le statut DRAFT → SUBMITTED
const submitReport = async (req, res, next) => {
  try {
    const updated = await reportService.updateReportStatus(
      req.params.id,
      "SUBMITTED",
    );

    res.status(200).json({
      success: true,
      message: "Rapport soumis à l'ANPE avec succès",
      data: {
        _id: updated._id,
        status: updated.status,
        overallScore: updated.overallScore,
        breachCount: updated.breachCount,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/reports/:id ──────────────────────────────
// Supprime uniquement les rapports en statut DRAFT
// Les rapports soumis ou approuvés ne peuvent pas être supprimés
const deleteReport = async (req, res, next) => {
  try {
    await reportService.deleteReport(req.params.id);

    res.status(200).json({
      success: true,
      message: success_messages.deleted,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllReports,
  getReportById,
  generateReport,
  submitReport,
  deleteReport,
};
