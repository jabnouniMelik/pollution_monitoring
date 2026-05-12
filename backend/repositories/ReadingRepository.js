/**
 * REPOSITORY : READING
 * Gère toutes les opérations DB pour les mesures de capteurs
 */

const Reading = require("../models/Reading");

class ReadingRepository {
  /**
   * Récupère toutes les mesures avec filtres et pagination
   * @param {Object} filter - Filtre MongoDB
   * @param {Number} limit - Nombre de résultats max
   * @returns {Promise<Array>} Array de mesures
   */
  async findAll(filter = {}, limit = 100) {
    return await Reading.find(filter)
      .populate("sensorId", "name model type")
      .populate("PolluantId", "name unit regulatoryLimit")
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Récupère une mesure par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document mesure ou null
   */
  async findById(id) {
    return await Reading.findById(id)
      .populate("sensorId", "name model type")
      .populate("PolluantId", "name unit regulatoryLimit");
  }

  /**
   * Récupère la dernière mesure d'un capteur
   * @param {String} sensorId - ID du capteur
   * @returns {Promise<Object>} Document mesure ou null
   */
  async findLastBySensorId(sensorId) {
    return await Reading.findOne({ sensorId })
      .sort({ timestamp: -1 })
      .select("value timestamp");
  }

  /**
   * Crée une nouvelle mesure
   * @param {Object} data - Données mesure
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await Reading.create(data);
  }

  /**
   * Récupère les dernières mesures de tous les capteurs
   * @param {Object} filter - Filtre optionnel
   * @returns {Promise<Array>} Array de mesures (dernière par capteur)
   */
  async getLatestByAllSensors(filter = {}) {
    return await Reading.aggregate([
      { $match: filter },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$sensorId",
          latestReading: { $first: "$$ROOT" },
        },
      },
      // Join polluants to get code and other details
      {
        $lookup: {
          from: "polluants",
          localField: "latestReading.PolluantId",
          foreignField: "_id",
          as: "polluantData",
        },
      },
      // Add polluant details to latestReading
      {
        $addFields: {
          "latestReading.PolluantId": {
            $cond: {
              if: { $gt: [{ $size: "$polluantData" }, 0] },
              then: { $arrayElemAt: ["$polluantData", 0] },
              else: "$latestReading.PolluantId",
            },
          },
        },
      },
      // Remove temporary polluantData array
      { $project: { polluantData: 0 } },
    ]);
  }

  /**
   * Compte les mesures invalides sur une période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Number>} Nombre de mesures invalides
   */
  async countInvalid(periodStart, periodEnd) {
    return await Reading.countDocuments({
      isValid: false,
      timestamp: { $gte: periodStart, $lte: periodEnd },
    });
  }

  /**
   * Agrégation pour statistiques par polluant sur une période
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} Statistiques (avg, min, max, count)
   */
  async aggregateByPolluantPeriod(polluantId, periodStart, periodEnd, nodeIdFilter = null) {
    const match = {
      PolluantId: polluantId,
      timestamp: { $gte: periodStart, $lte: periodEnd },
      isValid: true,
    };

    // Filter by zone's nodes if provided
    if (nodeIdFilter && nodeIdFilter.length > 0) {
      match.nodeId = { $in: nodeIdFilter };
    }

    const result = await Reading.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgValue: { $avg: "$value" },
          minValue: { $min: "$value" },
          maxValue: { $max: "$value" },
          count: { $sum: 1 },
        },
      },
    ]);

    return result.length > 0 ? result[0] : null;
  }
}

module.exports = new ReadingRepository();
