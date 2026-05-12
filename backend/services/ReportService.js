/**
 * SERVICE : REPORT
 * Logique métier pour les rapports réglementaires ANPE
 * Calcule l'IPE (Indice de Performance Environnementale)
 */

const reportRepository = require("../repositories/ReportRepository");
const readingRepository = require("../repositories/ReadingRepository");
const alertRepository = require("../repositories/AlertRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const pdfGenerator = require("./PdfGeneratorService");
const csvGenerator = require("./CsvGeneratorService");
const { alert_types } = require("../utils/constants");

class ReportService {
  /**
   * Calcul du score IPE
   * IPE = Indice de Performance Environnementale (0-100)
   * Score pondéré par polluant selon norme NT 106.04
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} { ipe, polluantScores }
   */
  async calculateIPE(periodStart, periodEnd, nodeIdFilter = null) {
    try {
      const polluants = await polluantRepository.findAll();

      const weights = {
        NOx: 0.3,
        SO2: 0.25,
        "PM2.5": 0.25,
        COV: 0.15,
        CO2: 0.05,
      };

      let weightedScore = 0;
      let totalWeight = 0;
      const polluantScores = {};

      for (const polluant of polluants) {
        const stats = await readingRepository.aggregateByPolluantPeriod(
          polluant._id,
          periodStart,
          periodEnd,
          nodeIdFilter,
        );

        if (!stats) continue;

        const avgValue = stats.avgValue;
        const vle = polluant.regulatoryLimit;

        // Skip polluants without regulatory limits (TEMPERATURE, HUMIDITY, etc.)
        if (!vle || vle <= 0) continue;

        const score = avgValue <= vle ? 1 : Math.max(0, 1 - (avgValue - vle) / vle);
        const weight = weights[polluant.name] || 0.1;
        weightedScore += weight * score;
        totalWeight += weight;
        polluantScores[polluant.name] = Math.round(score * 100);
      }

      const ipe = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 100;
      return { ipe, polluantScores };
    } catch (error) {
      console.error("Erreur calcul IPE:", error.message);
      return { ipe: 0, polluantScores: {} };
    }
  }

  /**
   * Récupère tous les rapports avec filtres
   * @param {Object} filters - Filtres (status)
   * @returns {Promise<Array>} Rapports
   */
  async getAllReports(filters = {}) {
    return await reportRepository.findAll(filters);
  }

  /**
   * Récupère un rapport par ID
   * @param {String} id - ID rapport
   * @returns {Promise<Object>} Rapport
   */
  async getReportById(id) {
    const report = await reportRepository.findById(id);
    if (!report) {
      const err = new Error("Rapport non trouvé");
      err.statusCode = 404;
      throw err;
    }
    return report;
  }

  /**
   * Récupère les données de compliance pour le rapport
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Array>} Données de compliance
   */
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

        // Skip polluants without regulatory limits
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

  /**
   * Génère un nouveau rapport sur une période
   * Calcule breachCount et IPE automatiquement
   * Génère les fichiers PDF et/ou CSV
   * @param {Object} data - { periodStart, periodEnd, generatedBy, title, format, includeCompliance }
   * @returns {Promise<Object>} Rapport créé
   */
  async generateReport(data) {
    const {
      periodStart,
      periodEnd,
      generatedBy,
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

    // Set end to end of day if only a date was provided
    if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
      end.setHours(23, 59, 59, 999);
    }

    if (start >= end) {
      const err = new Error("periodStart doit être avant periodEnd");
      err.statusCode = 400;
      throw err;
    }

    // Resolve nodeIds for zone filtering
    let nodeIdFilter = null;
    if (zoneId) {
      const SensorNode = require("../models/SensorNode");
      const Zone = require("../models/Zone");
      const zone = await Zone.findById(zoneId).select("code").lean();
      if (zone) {
        const nodes = await SensorNode.find({ zone: zone.code }).select("_id").lean();
        nodeIdFilter = nodes.map((n) => n._id);
      }
    }

    // Count threshold breaches — filtered by zone if provided
    const alertFilter = {
      type: alert_types.Threshold,
      timestamp: { $gte: start, $lte: end },
    };
    const alerts = await alertRepository.findAll(alertFilter);
    const breachCount = alerts.length || 0;

    // Calculate IPE — filtered by zone if provided
    const { ipe, polluantScores } = await this.calculateIPE(start, end, nodeIdFilter);

    // Compliance data — filtered by zone if provided
    const complianceData = includeCompliance
      ? await this.getComplianceData(start, end, nodeIdFilter)
      : [];

    // Zone name for title
    let zoneName = "";
    if (zoneId) {
      const Zone = require("../models/Zone");
      const zone = await Zone.findById(zoneId).select("nom code").lean();
      zoneName = zone ? ` — ${zone.nom}` : "";
    }

    const reportData = {
      periodStart: start,
      periodEnd: end,
      generatedBy,
      status: "DRAFT",
      generatedAt: new Date(),
      breachCount,
      overallScore: ipe,
      polluantScores,
      title: title || `Rapport${zoneName} du ${start.toLocaleDateString("fr-FR")}`,
      format,
      zoneId: zoneId || null,
      siteId: siteId || null,
    };

    const report = await reportRepository.create(reportData);

    // Generate file — convert Mongoose Map to plain object for generators
    try {
      let fileUrl = null;
      const plainPolluantScores = report.polluantScores instanceof Map
        ? Object.fromEntries(report.polluantScores)
        : (report.polluantScores || {});

      const fullReportData = {
        ...reportData,
        id: report._id,
        polluantScores: plainPolluantScores,
        complianceData,
      };

      if (format === "pdf") {
        const pdfResult = await pdfGenerator.generatePdf(fullReportData);
        fileUrl = pdfResult.url;
      } else if (format === "csv" || format === "xlsx") {
        const csvResult = await csvGenerator.generateCsv(fullReportData);
        fileUrl = csvResult.url;
      }

      if (fileUrl) {
        report.fileUrl = fileUrl;
        await report.save();
      }
    } catch (fileError) {
      console.error("Erreur génération fichier:", fileError.message);
    }

    return report;
  }

  /**
   * Met à jour le statut d'un rapport
   * (DRAFT → SUBMITTED → APPROVED)
   * @param {String} id - ID rapport
   * @param {String} status - Nouveau statut
   * @param {String} notes - Notes optionnelles
   * @returns {Promise<Object>} Rapport mis à jour
   */
  async updateReportStatus(id, status, notes = "") {
    const report = await reportRepository.findById(id);
    if (!report) {
      const err = new Error("Rapport non trouvé");
      err.statusCode = 404;
      throw err;
    }

    // Vérifier statut valide
    const validStatuses = ["DRAFT", "SUBMITTED", "APPROVED"];
    if (!validStatuses.includes(status)) {
      const err = new Error(
        `Statut invalide. Valeurs acceptées : ${validStatuses.join(", ")}`,
      );
      err.statusCode = 400;
      throw err;
    }

    return await reportRepository.updateStatus(id, status, notes);
  }

  /**
   * Supprime un rapport
   * Seuls les rapports DRAFT peuvent être supprimés
   * @param {String} id - ID rapport
   * @returns {Promise<Object>} Rapport supprimé
   */
  async deleteReport(id) {
    const report = await reportRepository.findById(id);
    if (!report) {
      const err = new Error("Rapport non trouvé");
      err.statusCode = 404;
      throw err;
    }

    if (report.status !== "DRAFT") {
      const err = new Error("Seuls les rapports DRAFT peuvent être supprimés");
      err.statusCode = 409;
      throw err;
    }

    return await reportRepository.delete(id);
  }

  /**
   * Récupère le rapport le plus récent
   * @returns {Promise<Object|null>} Rapport récent ou null
   */
  async getLatestReport() {
    return await reportRepository.findLatest();
  }
}

module.exports = new ReportService();
