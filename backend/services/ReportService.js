/**
 * SERVICE : REPORT
 * Logique métier pour les rapports réglementaires ANPE
 * Calcule l'IPE (Indice de Performance Environnementale)
 */

const reportRepository = require("../repositories/ReportRepository");
const readingRepository = require("../repositories/ReadingRepository");
const alertRepository = require("../repositories/AlertRepository");
const polluantRepository = require("../repositories/PolluantRepository");
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
  async calculateIPE(periodStart, periodEnd) {
    try {
      const polluants = await polluantRepository.findAll();

      // Poids réglementaires par polluant
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
        // Moyenne des mesures valides sur la période
        const stats = await readingRepository.aggregateByPolluantPeriod(
          polluant._id,
          periodStart,
          periodEnd,
        );

        if (!stats) continue;

        const avgValue = stats.avgValue;
        const vle = polluant.regulatoryLimit;

        // Score du polluant : 1 si conforme, pénalité si dépassement
        const score =
          avgValue <= vle ? 1 : Math.max(0, 1 - (avgValue - vle) / vle);

        const weight = weights[polluant.name] || 0.1;
        weightedScore += weight * score;
        totalWeight += weight;

        polluantScores[polluant.name] = Math.round(score * 100);
      }

      const ipe =
        totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 100;

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
      throw new Error("Rapport non trouvé");
    }
    return report;
  }

  /**
   * Génère un nouveau rapport sur une période
   * Calcule breachCount et IPE automatiquement
   * @param {Object} data - { periodStart, periodEnd, generatedBy }
   * @returns {Promise<Object>} Rapport créé
   */
  async generateReport(data) {
    const { periodStart, periodEnd, generatedBy } = data;

    if (!periodStart || !periodEnd) {
      throw new Error("periodStart et periodEnd sont requis");
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (start >= end) {
      throw new Error("periodStart doit être avant periodEnd");
    }

    // Compter les dépassements (types Threshold)
    const filter = {
      type: alert_types.Threshold,
      timestamp: { $gte: start, $lte: end },
    };
    const breachCount =
      (await alertRepository.findAll(filter, 10000).length) ||
      (await (async () => {
        const alerts = await alertRepository.findAll(filter);
        return alerts.length;
      })());

    // Calculer l'IPE
    const { ipe, polluantScores } = await this.calculateIPE(start, end);

    // Préparer données rapport
    const reportData = {
      periodStart: start,
      periodEnd: end,
      generatedBy,
      status: "DRAFT",
      generatedAt: new Date(),
      breachCount: breachCount || 0,
      overallScore: ipe,
      polluantScores,
    };

    return await reportRepository.create(reportData);
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
      throw new Error("Rapport non trouvé");
    }

    // Vérifier statut valide
    const validStatuses = ["DRAFT", "SUBMITTED", "APPROVED"];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Statut invalide. Valeurs acceptées : ${validStatuses.join(", ")}`,
      );
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
      throw new Error("Rapport non trouvé");
    }

    if (report.status !== "DRAFT") {
      throw new Error("Seuls les rapports DRAFT peuvent être supprimés");
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
