/**
 * CONTROLLER : REPORT
 * Gère toutes les opérations HTTP pour les rapports réglementaires ANPE
 */

const reportService = require("../services/ReportService");
const { success_messages } = require("../utils/constants");

const getAllReports = async (req, res, next) => {
  try {
    const reports = await reportService.getReportsForUser(req.user, req.query);

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

const getReportById = async (req, res, next) => {
  try {
    const report = await reportService.getReportById(req.params.id);
    reportService.assertReportAccess(req.user, report);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

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

    const report = await reportService.generateReport({
      periodStart,
      periodEnd,
      generatedBy: req.user.userId,
      generatorRole: req.user.role,
      industryId: req.user.industryId || null,
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

const submitReport = async (req, res, next) => {
  try {
    const updated = await reportService.submitReportForReview(
      req.params.id,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: "Rapport soumis pour validation par l'auditeur",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

const approveReport = async (req, res, next) => {
  try {
    const { notes } = req.body || {};
    const updated = await reportService.approveReport(
      req.params.id,
      req.user,
      notes,
    );

    res.status(200).json({
      success: true,
      message: "Rapport approuvé",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

const rejectReport = async (req, res, next) => {
  try {
    const { reason, rejectionReason } = req.body || {};
    const updated = await reportService.rejectReport(
      req.params.id,
      req.user,
      rejectionReason || reason,
    );

    res.status(200).json({
      success: true,
      message: "Rapport refusé",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

const deleteReport = async (req, res, next) => {
  try {
    await reportService.deleteReport(req.params.id, req.user);

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
  approveReport,
  rejectReport,
  deleteReport,
};
