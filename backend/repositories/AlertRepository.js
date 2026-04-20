/**
 * REPOSITORY : ALERT
 * Gère toutes les opérations DB pour les alertes
 */

const Alert = require("../models/Alert");

class AlertRepository {
  /**
   * Récupère toutes les alertes avec filtres
   * @param {Object} filter - Filtre MongoDB
   * @param {Number} limit - Nombre de résultats max
   * @returns {Promise<Array>} Array d'alertes
   */
  async findAll(filter = {}, limit = 50) {
    return await Alert.find(filter)
      .populate("PolluantId", "name unit regulatoryLimit")
      .populate("SensorId", "model type")
      .populate("ReadingId", "value unit timestamp")
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Récupère une alerte par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document alerte ou null
   */
  async findById(id) {
    return await Alert.findById(id)
      .populate("PolluantId", "name unit regulatoryLimit warningThreshold")
      .populate("SensorId", "model type")
      .populate("ReadingId", "value unit timestamp rawValue")
      .populate("acknowledgedBy", "username email");
  }

  /**
   * Crée une nouvelle alerte
   * @param {Object} data - Données alerte
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await Alert.create(data);
  }

  /**
   * Acquitte une alerte
   * @param {String} id - ID de l'alerte
   * @param {String} userId - ID de l'utilisateur qui acquitte
   * @returns {Promise<Object>} Document mis à jour
   */
  async acknowledge(id, userId) {
    return await Alert.findByIdAndUpdate(
      id,
      {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      { new: true },
    );
  }

  /**
   * Escalade une alerte (change sa sévérité)
   * @param {String} id - ID de l'alerte
   * @param {String} newSeverity - Nouvelle sévérité
   * @param {String} reason - Raison de l'escalade
   * @returns {Promise<Object>} Document mis à jour
   */
  async escalate(id, newSeverity, reason) {
    return await Alert.findByIdAndUpdate(
      id,
      {
        severity: newSeverity,
        escalationReason: reason,
      },
      { new: true },
    );
  }

  /**
   * Résout une alerte — implique acquittement et marque la fin du traitement
   * @param {String} id - ID de l'alerte
   * @param {String} userId - ID de l'utilisateur qui résout
   * @param {String} note - Note de résolution
   * @returns {Promise<Object>} Document mis à jour
   */
  async resolve(id, userId, note) {
    return await Alert.findByIdAndUpdate(
      id,
      {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNote: note,
      },
      { new: true },
    );
  }

  /**
   * Compte les alertes non acquittées
   * @returns {Promise<Number>} Nombre d'alertes non acquittées
   */
  async countUnacknowledged() {
    return await Alert.countDocuments({ isAcknowledged: false });
  }

  /**
   * Compte les alertes critiques non acquittées
   * @returns {Promise<Number>} Nombre d'alertes critiques non acquittées
   */
  async countCriticalUnacknowledged() {
    return await Alert.countDocuments({
      isAcknowledged: false,
      severity: "CRITICAL",
    });
  }

  /**
   * Agrégation pour statistiques par sévérité
   * @returns {Promise<Array>} Statistiques par sévérité
   */
  async statsBySeverity() {
    return await Alert.aggregate([
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
          unacknowledged: {
            $sum: { $cond: [{ $eq: ["$isAcknowledged", false] }, 1, 0] },
          },
        },
      },
    ]);
  }

  /**
   * Agrégation pour statistiques par polluant
   * @returns {Promise<Array>} Statistiques par polluant
   */
  async statsByPolluant() {
    return await Alert.aggregate([
      {
        $group: {
          _id: "$PolluantId",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "polluants",
          localField: "_id",
          foreignField: "_id",
          as: "polluant",
        },
      },
      { $unwind: "$polluant" },
      {
        $project: {
          polluantName: "$polluant.name",
          count: 1,
        },
      },
    ]);
  }
}

module.exports = new AlertRepository();
