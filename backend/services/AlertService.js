/**
 * SERVICE : ALERT
 * Logique métier pour les alertes environnementales
 * Gère acquittement, escalade, statistiques
 */

const alertRepository = require("../repositories/AlertRepository");

class AlertService {
  /**
   * Récupère toutes les alertes avec filtres avancés
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
      throw new Error("Alerte non trouvée");
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
      throw new Error("Alerte non trouvée");
    }

    if (alert.isAcknowledged) {
      throw new Error("Alerte déjà acquittée");
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
      throw new Error("Alerte non trouvée");
    }

    // Vérifier que newSeverity est valide
    const validSeverities = ["WARNING", "HIGH", "CRITICAL"];
    if (!validSeverities.includes(newSeverity)) {
      throw new Error(
        `Sévérité invalide. Valeurs acceptées : ${validSeverities.join(", ")}`,
      );
    }

    return await alertRepository.escalate(id, newSeverity, reason);
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
      throw new Error("Alerte non trouvée");
    }
    if (alert.resolvedAt) {
      throw new Error("Alerte déjà résolue");
    }
    return await alertRepository.resolve(id, userId, note);
  }

  /**
   * Récupère toutes les statistiques des alertes
   * Utilisé par le Dashboard pour KPIs
   * @returns {Promise<Object>} Stats globales
   */
  async getAlertStats() {
    const statsBySeverity = await alertRepository.statsBySeverity();
    const statsByPolluant = await alertRepository.statsByPolluant();
    const totalUnacknowledged = await alertRepository.countUnacknowledged();
    const criticalUnacknowledged =
      await alertRepository.countCriticalUnacknowledged();

    return {
      totalUnacknowledged,
      criticalUnacknowledged,
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
