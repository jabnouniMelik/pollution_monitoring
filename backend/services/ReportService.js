/**
 * SERVICE : REPORT
 * Rapports réglementaires ANPE — KPIs alignés sur KPIService (Décret 2018-928).
 */

const reportRepository = require("../repositories/ReportRepository");
const readingRepository = require("../repositories/ReadingRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const sensorNodeRepository = require("../repositories/SensorNodeRepository");
const siteConfigRepository = require("../repositories/SiteConfigRepository");
const kpiService = require("./KPIService");
const pdfGenerator = require("./PdfGeneratorService");
const csvGenerator = require("./CsvGeneratorService");
const { broadcastReportUpdate } = require("./websocketService");
const { DECRET_REF_SHORT } = require("../utils/regulationConstants");

class ReportService {
  async getConcentrationHistory(periodStart, periodEnd, nodeIdFilter = null) {
    const rows = await readingRepository.findDetailedForExport(
      periodStart,
      periodEnd,
      nodeIdFilter,
      10000,
    );

    return rows.map((r) => {
      const polluant = r.PolluantId || {};
      const limit = Number(polluant.regulatoryLimit);
      const value = Number(r.value);
      const hasLimit = Number.isFinite(limit) && limit > 0;

      return {
        timestamp: r.timestamp,
        pollutant: polluant.name || "N/A",
        value,
        unit: r.unit || polluant.unit || "",
        regulatoryLimit: hasLimit ? limit : null,
        status: hasLimit
          ? value <= limit
            ? "Conforme"
            : "Dépassement"
          : "Sans limite",
        node: r.nodeId?.name || r.nodeId?.code || "",
        sensor: r.sensorId?.name || "",
      };
    });
  }

  /**
   * Calcule les 4 KPIs pour la période du rapport (même logique que le dashboard).
   */
  async buildKpiMetrics(periodStart, periodEnd, nodeIdFilter = null) {
    const config = await siteConfigRepository.getActiveConfig();
    const targets = {
      td: config?.targets?.tauxDepassement ?? 2,
      ipe: config?.targets?.ipe ?? 95,
      rco2: config?.targets?.reductionCO2 ?? -5,
    };

    const ipeResult = await kpiService.calculateIPE(
      periodStart,
      periodEnd,
      null,
      nodeIdFilter,
    );

    const polluantScores = {};
    for (const [name, data] of Object.entries(ipeResult.polluantScores || {})) {
      polluantScores[name] = Math.round(Number(data.score ?? 0));
    }

    const polluants = await polluantRepository.findAll();
    const tdValues = [];
    const tdByPollutant = {};
    const emjByPollutant = {};
    let breachCount = 0;

    for (const polluant of polluants) {
      const [td, emj] = await Promise.all([
        kpiService.calculateTD(
          polluant._id,
          periodStart,
          periodEnd,
          nodeIdFilter,
        ),
        kpiService.calculateEMJ(
          polluant._id,
          periodStart,
          periodEnd,
          null,
          nodeIdFilter,
        ),
      ]);

      if (td.totalCount > 0) {
        tdValues.push(td.tauxDepassement);
        tdByPollutant[polluant.name] = td.tauxDepassement;
        breachCount += td.breachCount ?? 0;
      }
      if (emj.emissionKgDay != null) {
        emjByPollutant[polluant.name] = emj.emissionKgDay;
      }
    }

    const td =
      tdValues.length > 0
        ? Number(
            (tdValues.reduce((a, b) => a + b, 0) / tdValues.length).toFixed(2),
          )
        : 0;

    const co2Polluant = polluants.find((p) => p.name === "CO2" || p.name === "CO2e");
    let rco2 = null;
    if (co2Polluant) {
      const mom = await kpiService.calculateRCO2MonthOverMonth(
        co2Polluant._id,
        nodeIdFilter,
        periodEnd,
      );
      rco2 = {
        reductionPct: mom.reductionPct,
        goalAttainmentPct: mom.goalAttainmentPct,
        goalTargetPct: mom.goalTargetPct,
        currentAvg: mom.currentAvg,
        previousAvg: mom.previousAvg,
      };
    }

    return {
      ipe: ipeResult.ipe,
      polluantScores,
      td,
      tdByPollutant,
      emjByPollutant,
      breachCount,
      rco2,
      targets,
    };
  }

  async getAllReports(filters = {}) {
    return await reportRepository.findAll(filters);
  }

  async resolveIndustryId(siteId, zoneId) {
    if (zoneId) {
      const Zone = require("../models/Zone");
      const zone = await Zone.findById(zoneId).select("industrieId siteId").lean();
      if (zone?.industrieId) return zone.industrieId;
      if (zone?.siteId) siteId = zone.siteId;
    }

    if (siteId) {
      const Site = require("../models/Site");
      const site = await Site.findById(siteId).select("industrieId").lean();
      if (site?.industrieId) return site.industrieId;
    }

    return null;
  }

  buildListFilter(user, query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;

    if (!user) return filter;

    const { role, industryId, sitesManaging = [] } = user;

    if (role === "SUPER_ADMIN") return filter;

    if (industryId) {
      filter.industryId = industryId;
    }

    if (role === "SITE_SUPERVISOR" && sitesManaging.length > 0) {
      filter.siteId = { $in: sitesManaging };
    }

    return filter;
  }

  assertReportAccess(user, report) {
    if (!user || !report) {
      const err = new Error("Accès refusé");
      err.statusCode = 403;
      throw err;
    }

    if (user.role === "SUPER_ADMIN") return;

    const reportIndustry = report.industryId?.toString?.() ?? null;
    const userIndustry = user.industryId?.toString?.() ?? null;

    if (userIndustry && reportIndustry && userIndustry !== reportIndustry) {
      const err = new Error("Ce rapport appartient à une autre industrie");
      err.statusCode = 403;
      throw err;
    }

    if (user.role === "SITE_SUPERVISOR" && report.siteId) {
      const siteIds = (user.sitesManaging || []).map((s) => s.toString());
      if (siteIds.length > 0 && !siteIds.includes(report.siteId.toString())) {
        const err = new Error("Ce rapport n'appartient pas à vos sites");
        err.statusCode = 403;
        throw err;
      }
    }
  }

  isReportAuthor(user, report) {
    const authorId = report.generatedBy?._id?.toString?.() ?? report.generatedBy?.toString?.();
    return Boolean(authorId && user?.userId && authorId === user.userId);
  }

  async getReportsForUser(user, query = {}) {
    const filter = this.buildListFilter(user, query);
    return await reportRepository.findAll(filter);
  }

  notifyReportUpdate(report) {
    try {
      broadcastReportUpdate(report);
    } catch (err) {
      console.warn("[ReportService] WebSocket broadcast failed:", err.message);
    }
  }

  async getReportById(id) {
    const report = await reportRepository.findById(id);
    if (!report) {
      const err = new Error("Rapport non trouvé");
      err.statusCode = 404;
      throw err;
    }
    return report;
  }

  async getComplianceData(periodStart, periodEnd, nodeIdFilter = null) {
    try {
      const polluants = await polluantRepository.findAll();
      const complianceData = [];

      for (const polluant of polluants) {
        const stats = await readingRepository.aggregateByPolluantPeriod(
          polluant._id,
          periodStart,
          periodEnd,
          nodeIdFilter,
        );

        if (!stats) continue;

        const avgValue = stats.avgValue;
        const maxValue = stats.maxValue || avgValue;
        const limit = polluant.regulatoryLimit;

        if (!limit || limit <= 0) continue;

        const status = avgValue <= limit ? "Conforme" : "Dépassement";

        complianceData.push({
          parameter: `${polluant.name} (moyenne)`,
          value: `${avgValue.toFixed(2)} ${polluant.unit}`,
          limit: `${limit} ${polluant.unit}`,
          status,
        });

        if (maxValue > avgValue) {
          complianceData.push({
            parameter: `${polluant.name} (max)`,
            value: `${maxValue.toFixed(2)} ${polluant.unit}`,
            limit: `${limit} ${polluant.unit}`,
            status: maxValue <= limit ? "Conforme" : "Dépassement",
          });
        }
      }

      return complianceData;
    } catch (error) {
      console.error("Erreur récupération compliance:", error.message);
      return [];
    }
  }

  async generateReport(data) {
    const {
      periodStart,
      periodEnd,
      generatedBy,
      generatorRole = null,
      title,
      format = "pdf",
      includeCompliance = true,
      siteId = null,
      zoneId = null,
    } = data;

    if (!periodStart || !periodEnd) {
      const err = new Error("periodStart et periodEnd sont requis");
      err.statusCode = 400;
      throw err;
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
      end.setHours(23, 59, 59, 999);
    }

    if (start >= end) {
      const err = new Error("periodStart doit être avant periodEnd");
      err.statusCode = 400;
      throw err;
    }

    let nodeIdFilter = null;
    if (zoneId) {
      nodeIdFilter = await sensorNodeRepository.findNodeIdsByZone(zoneId);
      if (!nodeIdFilter?.length) nodeIdFilter = null;
    }

    const kpiMetrics = await this.buildKpiMetrics(start, end, nodeIdFilter);

    const complianceData = includeCompliance
      ? await this.getComplianceData(start, end, nodeIdFilter)
      : [];
    const concentrationHistory = await this.getConcentrationHistory(
      start,
      end,
      nodeIdFilter,
    );

    let zoneName = "";
    if (zoneId) {
      const Zone = require("../models/Zone");
      const zone = await Zone.findById(zoneId).select("nom code").lean();
      zoneName = zone ? ` — ${zone.nom}` : "";
    }

    const industryId =
      (await this.resolveIndustryId(siteId, zoneId)) || data.industryId || null;

    const isAuditor = generatorRole === "AUDITOR";
    const now = new Date();

    const reportData = {
      periodStart: start,
      periodEnd: end,
      generatedBy,
      status: isAuditor ? "APPROVED" : "DRAFT",
      generatedAt: now,
      breachCount: kpiMetrics.breachCount,
      overallScore: kpiMetrics.ipe,
      polluantScores: kpiMetrics.polluantScores,
      td: kpiMetrics.td,
      tdByPollutant: kpiMetrics.tdByPollutant,
      emjByPollutant: kpiMetrics.emjByPollutant,
      rco2: kpiMetrics.rco2,
      kpiTargets: kpiMetrics.targets,
      title: title || `Rapport${zoneName} du ${start.toLocaleDateString("fr-FR")}`,
      format,
      zoneId: zoneId || null,
      siteId: siteId || null,
      industryId,
      regulationRef: DECRET_REF_SHORT,
      ...(isAuditor
        ? { approvedAt: now, approvedBy: generatedBy }
        : {}),
    };

    const report = await reportRepository.create(reportData);

    try {
      let fileUrl = null;
      const plainPolluantScores =
        report.polluantScores instanceof Map
          ? Object.fromEntries(report.polluantScores)
          : report.polluantScores || {};

      const fullReportData = {
        ...reportData,
        id: report._id,
        polluantScores: plainPolluantScores,
        complianceData,
        concentrationHistory,
      };

      if (format === "pdf") {
        const pdfResult = await pdfGenerator.generatePdf(fullReportData);
        fileUrl = pdfResult.url;
      } else if (format === "csv") {
        const csvResult = await csvGenerator.generateCsv(fullReportData);
        fileUrl = csvResult.url;
      } else if (format === "xlsx") {
        const xlsxResult = await csvGenerator.generateXlsx(fullReportData);
        fileUrl = xlsxResult.url;
      }

      if (fileUrl) {
        report.fileUrl = fileUrl;
        await report.save();
      }
    } catch (fileError) {
      console.error("Erreur génération fichier:", fileError.message);
    }

    return reportRepository.findById(report._id);
  }

  async submitReportForReview(id, user) {
    const report = await this.getReportById(id);
    this.assertReportAccess(user, report);

    if (report.status !== "DRAFT") {
      const err = new Error("Seuls les rapports en brouillon peuvent être soumis");
      err.statusCode = 409;
      throw err;
    }

    if (user.role === "AUDITOR") {
      const err = new Error("L'auditeur ne soumet pas de rapports à validation");
      err.statusCode = 403;
      throw err;
    }

    const canSubmit =
      ["HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(user.role) ||
      this.isReportAuthor(user, report);

    if (!canSubmit) {
      const err = new Error("Vous ne pouvez pas soumettre ce rapport");
      err.statusCode = 403;
      throw err;
    }

    const updated = await reportRepository.updateWorkflowStatus(id, {
      status: "SUBMITTED",
      actorId: user.userId,
    });

    this.notifyReportUpdate(updated);
    return updated;
  }

  async approveReport(id, user, notes = "") {
    if (user.role !== "AUDITOR") {
      const err = new Error("Seul un auditeur peut approuver un rapport");
      err.statusCode = 403;
      throw err;
    }

    const report = await this.getReportById(id);
    this.assertReportAccess(user, report);

    if (report.status !== "SUBMITTED") {
      const err = new Error("Seuls les rapports en attente peuvent être approuvés");
      err.statusCode = 409;
      throw err;
    }

    const updated = await reportRepository.updateWorkflowStatus(id, {
      status: "APPROVED",
      actorId: user.userId,
      notes,
    });

    this.notifyReportUpdate(updated);
    return updated;
  }

  async rejectReport(id, user, rejectionReason = "") {
    if (user.role !== "AUDITOR") {
      const err = new Error("Seul un auditeur peut refuser un rapport");
      err.statusCode = 403;
      throw err;
    }

    const report = await this.getReportById(id);
    this.assertReportAccess(user, report);

    if (report.status !== "SUBMITTED") {
      const err = new Error("Seuls les rapports en attente peuvent être refusés");
      err.statusCode = 409;
      throw err;
    }

    if (!rejectionReason?.trim()) {
      const err = new Error("Un motif de refus est requis");
      err.statusCode = 400;
      throw err;
    }

    const updated = await reportRepository.updateWorkflowStatus(id, {
      status: "REJECTED",
      actorId: user.userId,
      rejectionReason: rejectionReason.trim(),
    });

    this.notifyReportUpdate(updated);
    return updated;
  }

  async updateReportStatus(id, status, notes = "") {
    const report = await reportRepository.findById(id);
    if (!report) {
      const err = new Error("Rapport non trouvé");
      err.statusCode = 404;
      throw err;
    }

    const validStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      const err = new Error(
        `Statut invalide. Valeurs acceptées : ${validStatuses.join(", ")}`,
      );
      err.statusCode = 400;
      throw err;
    }

    return await reportRepository.updateStatus(id, status, notes);
  }

  async deleteReport(id, user = null) {
    const report = await reportRepository.findById(id);
    if (!report) {
      const err = new Error("Rapport non trouvé");
      err.statusCode = 404;
      throw err;
    }

    if (user) {
      this.assertReportAccess(user, report);
      const canDelete =
        this.isReportAuthor(user, report) ||
        ["HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(user.role);
      if (!canDelete) {
        const err = new Error("Vous ne pouvez pas supprimer ce rapport");
        err.statusCode = 403;
        throw err;
      }
    }

    if (report.status !== "DRAFT") {
      const err = new Error("Seuls les rapports DRAFT peuvent être supprimés");
      err.statusCode = 409;
      throw err;
    }

    return await reportRepository.delete(id);
  }

  async getLatestReport() {
    return await reportRepository.findLatest();
  }
}

module.exports = new ReportService();
