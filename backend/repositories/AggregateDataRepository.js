/**
 * REPOSITORY : AGGREGATE_DATA
 * Gère les opérations DB pour les données agrégées et KPIs
 */

const AggregateData = require("../models/AggregateData");

class AggregateDataRepository {
  /**
   * Crée un nouvel enregistrement d'agrégation
   * @param {Object} data - Données agrégées
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await AggregateData.create(data);
  }

  /**
   * Récupère les agrégations avec filtres
   * @param {Object} filter - Filtre MongoDB
   * @param {Number} limit - Limite résultats
   * @returns {Promise<Array>} Array d'agrégations
   */
  async findAll(filter = {}, limit = 100) {
    return await AggregateData.find(filter)
      .populate("polluantId", "name unit regulatoryLimit weight")
      .populate("sensorNodeId", "name location")
      .sort({ periodStart: -1 })
      .limit(limit);
  }

  /**
   * Récupère une agrégation par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document ou null
   */
  async findById(id) {
    return await AggregateData.findById(id)
      .populate("polluantId", "name unit regulatoryLimit weight")
      .populate("sensorNodeId", "name location");
  }

  /**
   * Trouve une agrégation existante pour éviter les doublons
   * @param {String} polluantId - ID polluant
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @returns {Promise<Object>} Document ou null
   */
  async findExisting(polluantId, period, periodStart) {
    return await AggregateData.findOne({
      polluantId,
      period,
      periodStart,
    });
  }

  /**
   * Met à jour ou crée une agrégation (upsert)
   * @param {Object} filter - Critères recherche
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async upsert(filter, data) {
    return await AggregateData.findOneAndUpdate(filter, data, {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
    });
  }

  /**
   * Récupère les agrégations par polluant et période
   * @param {String} polluantId - ID polluant
   * @param {String} period - Type période
   * @param {Number} limit - Limite résultats
   * @returns {Promise<Array>} Array d'agrégations
   */
  async findByPolluantAndPeriod(polluantId, period, limit = 30) {
    return await AggregateData.find({ polluantId, period })
      .sort({ periodStart: -1 })
      .limit(limit);
  }

  /**
   * Récupère l'agrégation globale site (sensorNodeId null)
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @returns {Promise<Object>} Document ou null
   */
  async findGlobalAggregate(period, periodStart) {
    return await AggregateData.findOne({
      sensorNodeId: null,
      period,
      periodStart,
    }).populate("polluantId", "name unit");
  }

  /**
   * Récupère toutes les agrégations d'une période
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @returns {Promise<Array>} Array d'agrégations
   */
  async findByPeriod(period, periodStart, periodEnd = null) {
    const filter = { period };
    if (periodStart || periodEnd) {
      filter.periodStart = {};
      if (periodStart) filter.periodStart.$gte = periodStart;
      if (periodEnd) filter.periodStart.$lte = periodEnd;
    }

    return await AggregateData.find(filter).populate(
      "polluantId",
      "name unit weight",
    );
  }

  /**
   * Supprime les agrégations anciennes (nettoyage)
   * @param {Date} beforeDate - Supprimer avant cette date
   * @returns {Promise<Object>} Résultat suppression
   */
  async deleteOldRecords(beforeDate) {
    return await AggregateData.deleteMany({
      periodStart: { $lt: beforeDate },
    });
  }

  /**
   * Récupère les statistiques de qualité des données
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} Statistiques qualité
   */
  async getDataQualityStats(period, periodStart, periodEnd) {
    return await AggregateData.aggregate([
      {
        $match: {
          period,
          periodStart: { $gte: periodStart, $lte: periodEnd },
        },
      },
      {
        $group: {
          _id: "$dataQuality",
          count: { $sum: 1 },
        },
      },
    ]);
  }
}

module.exports = new AggregateDataRepository();
