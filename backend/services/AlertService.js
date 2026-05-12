/**
 * SERVICE : ALERT
 * Logique métier pour les alertes environnementales
 * Gère acquittement, escalade, statistiques
 */

const alertRepository = require("../repositories/AlertRepository");

class AlertService {
  /**
   * Récupère toutes les alertes avec filtres avancés et pagination
   * @param {Object} filters - Filtres (severity, isAcknowledged, polluantId, date range)
   * @param {Number} page - Numéro de page
   * @param {Number} pageSize - Éléments par page
   * @returns {Promise<Object>} { items, total, page, pageSize, totalPages }
   */
  async getAllAlertsPaginated(filters = {}, page = 1, pageSize = 20) {
    return await alertRepository.findAllPaginated(filters, page, pageSize);
  }

  /**
   * Récupère toutes les alertes avec filtres avancés (sans pagination - legacy)
   * @param {Object} filters - Filtres (severity, isAcknowledged, polluantId, date range)
   * @param {Number} limit - Max résultats
   * @returns {Promise<Array>} Alertes
   */
  async getAllAlerts(filters = {}, limit = 50) {
    return await alertRepository.findAll(filters, limit);
  }

  /**
   * Récupère une alerte par ID
   * @param {String} id - ID alerte
   * @returns {Promise<Object>} Alerte détaillée
   */
  async getAlertById(id) {
    const alert = await alertRepository.findById(id);
    if (!alert) {
      const err = new Error("Alerte non trouvée");
      err.statusCode = 404;
      throw err;
    }
    return alert;
  }

  /**
   * Acquitte une alerte
   * Marque comme traitée par un utilisateur
   * @param {String} id - ID alerte
   * @param {String} userId - ID utilisateur qui acquitte
   * @returns {Promise<Object>} Alerte acquittée
   */
  async acknowledgeAlert(id, userId) {
    const alert = await alertRepository.findById(id);
    if (!alert) {
      const err = new Error("Alerte non trouvée");
      err.statusCode = 404;
      throw err;
    }

    if (alert.isAcknowledged) {
      const err = new Error("Alerte déjà acquittée");
      err.statusCode = 409;
      throw err;
    }

    return await alertRepository.acknowledge(id, userId);
  }

  /**
   * Escalade une alerte vers un niveau supérieur
   * @param {String} id - ID alerte
   * @param {String} newSeverity - Nouvelle sévérité
   * @param {String} reason - Raison de l'escalade
   * @returns {Promise<Object>} Alerte escaladée
   */
  async escalateAlert(id, newSeverity, reason) {
    const alert = await alertRepository.findById(id);
    if (!alert) {
      const err = new Error("Alerte non trouvée");
      err.statusCode = 404;
      throw err;
    }

    // Normalize severity to DB enum casing: "Warning" | "High" | "Critical"
    const severityNormMap = {
      warning: "Warning",
      high: "High",
      critical: "Critical",
    };
    const normalized = severityNormMap[newSeverity.toLowerCase()];
    if (!normalized) {
      const err = new Error(
        `Sévérité invalide. Valeurs acceptées : warning, high, critical`,
      );
      err.statusCode = 400;
      throw err;
    }

    return await alertRepository.escalate(id, normalized, reason);
  }

  /**
   * Résout une alerte (clôture du traitement)
   * @param {String} id - ID alerte
   * @param {String} userId - ID utilisateur qui résout
   * @param {String} note - Note explicative facultative
   * @returns {Promise<Object>} Alerte résolue
   */
  async resolveAlert(id, userId, note) {
    const alert = await alertRepository.findById(id);
    if (!alert) {
      const err = new Error("Alerte non trouvée");
      err.statusCode = 404;
      throw err;
    }
    if (alert.resolvedAt) {
      const err = new Error("Alerte déjà résolue");
      err.statusCode = 409;
      throw err;
    }
    return await alertRepository.resolve(id, userId, note);
  }

  /**
   * Récupère toutes les statistiques des alertes
   * Utilisé par le Dashboard pour KPIs
   * @returns {Promise<Object>} Stats globales
   */
  async getAlertStats(filters = {}) {
    const statsBySeverity = await alertRepository.statsBySeverity(filters);
    const statsByPolluant = await alertRepository.statsByPolluant(filters);
    const totalUnacknowledged = await alertRepository.countUnacknowledged(filters);
    const criticalUnacknowledged =
      await alertRepository.countCriticalUnacknowledged(filters);
    const totalResolved = await alertRepository.countResolved(filters);

    return {
      totalUnacknowledged,
      criticalUnacknowledged,
      totalResolved,
      bySeverity: statsBySeverity,
      byPolluant: statsByPolluant,
    };
  }

  /**
   * Récupère le nombre d'alertes non acquittées
   * @returns {Promise<Number>} Nombre d'alertes
   */
  async getUnacknowledgedCount() {
    return await alertRepository.countUnacknowledged();
  }

  /**
   * Récupère le nombre d'alertes critiques non acquittées
   * @returns {Promise<Number>} Nombre d'alertes critiques
   */
  async getCriticalUnacknowledgedCount() {
    return await alertRepository.countCriticalUnacknowledged();
  }
}

module.exports = new AlertService();
