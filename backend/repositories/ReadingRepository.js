/**
 * REPOSITORY : READING
 * Gère toutes les opérations DB pour les mesures de capteurs
 */

const Reading = require("../models/Reading");

class ReadingRepository {
  /**
   * Récupère toutes les mesures avec filtres et pagination.
   * Pour les requêtes historiques (avec filtre timestamp), trie par ordre
   * croissant (oldest → newest) pour que les graphiques s'affichent correctement.
   * Sans filtre timestamp, trie décroissant (newest first).
   */
  async findAll(filter = {}, limit = 100) {
    const hasTimeFilter = filter.timestamp !== undefined || filter.createdAt !== undefined
    const sortOrder = hasTimeFilter ? 1 : -1

    return await Reading.find(filter)
      .populate("sensorId", "name model type")
      .populate("PolluantId", "name unit regulatoryLimit")
      .sort({ createdAt: sortOrder })   // createdAt is set by Mongoose independently per doc
      .limit(limit)
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

  /**
   * Statistiques journalières par polluant (fallback historique KPI live).
   * @returns {Promise<Array<{ day: string, avgValue, minValue, maxValue, count }>>}
   */
  async aggregateDailyByPolluant(
    polluantId,
    periodStart,
    periodEnd,
    nodeIdFilter = null,
    regulatoryLimit = null,
  ) {
    const match = {
      PolluantId: polluantId,
      timestamp: { $gte: periodStart, $lte: periodEnd },
      isValid: true,
    };

    if (nodeIdFilter && nodeIdFilter.length > 0) {
      match.nodeId = { $in: nodeIdFilter };
    }

    const groupStage = {
      _id: {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "UTC" },
      },
      avgValue: { $avg: "$value" },
      minValue: { $min: "$value" },
      maxValue: { $max: "$value" },
      count: { $sum: 1 },
    };

    if (Number.isFinite(regulatoryLimit)) {
      groupStage.breachCount = {
        $sum: { $cond: [{ $gt: ["$value", regulatoryLimit] }, 1, 0] },
      };
    }

    return await Reading.aggregate([
      { $match: match },
      { $group: groupStage },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          day: "$_id",
          avgValue: 1,
          minValue: 1,
          maxValue: 1,
          count: 1,
          breachCount: 1,
        },
      },
    ]);
  }

  /**
   * Dataset historique détaillé pour export (CSV/XLSX).
   * Retourne les mesures triées par timestamp ascendant.
   */
  async findDetailedForExport(
    periodStart,
    periodEnd,
    nodeIdFilter = null,
    limit = 10000,
  ) {
    const filter = {
      timestamp: { $gte: periodStart, $lte: periodEnd },
      isValid: true,
    };

    if (nodeIdFilter && nodeIdFilter.length > 0) {
      filter.nodeId = { $in: nodeIdFilter };
    }

    return await Reading.find(filter)
      .populate("PolluantId", "name unit regulatoryLimit")
      .populate("nodeId", "name code")
      .populate("sensorId", "name model")
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new ReadingRepository();
