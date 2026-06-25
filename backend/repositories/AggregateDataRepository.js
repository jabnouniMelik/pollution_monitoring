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
   * @param {String} siteId - ID site (required for all aggregates)
   * @param {String|null} zoneId - Optional zone ID (null = site-level aggregate)
   * @param {String|null} sensorNodeId - Optional node ID (null = zone/site aggregate)
   * @returns {Promise<Object>} Document ou null
   */
  async findExisting(polluantId, period, periodStart, siteId, zoneId = null, sensorNodeId = null) {
    return await AggregateData.findOne({
      polluantId,
      period,
      periodStart,
      siteId,
      zoneId,
      sensorNodeId,
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
   * @param {Object} filters - Filtre additionnel (siteId, zoneId, sensorNodeId, sensorNodeIds)
   * @returns {Promise<Array>} Array d'agrégations
   */
  async findByPolluantAndPeriod(polluantId, period, limit = 30, filters = {}) {
    const query = { polluantId, period };

    // Site filtering (required)
    if (filters.siteId) query.siteId = filters.siteId;

    // Zone filtering (preferred over node filtering)
    if (filters.zoneId) {
      query.zoneId = filters.zoneId;
    } else if (filters.sensorNodeId) {
      query.sensorNodeId = filters.sensorNodeId;
    } else if (filters.sensorNodeIds && Array.isArray(filters.sensorNodeIds)) {
      query.sensorNodeId = { $in: filters.sensorNodeIds };
    }

    return await AggregateData.find(query)
      .sort({ periodStart: -1 })
      .limit(limit);
  }

  /**
   * Historique IPE global (agrégats sans polluantId).
   */
  async findIpeHistory(period, limit = 30, filters = {}) {
    const query = { polluantId: null, period };

    if (filters.siteId) query.siteId = filters.siteId;
    if (filters.zoneId) {
      query.zoneId = filters.zoneId;
    } else if (filters.sensorNodeId) {
      query.sensorNodeId = filters.sensorNodeId;
    } else if (filters.sensorNodeIds && Array.isArray(filters.sensorNodeIds)) {
      query.sensorNodeId = { $in: filters.sensorNodeIds };
    }

    return await AggregateData.find(query)
      .sort({ periodStart: -1 })
      .limit(limit);
  }

  /**
   * Récupère l'agrégation globale zone (sensorNodeId null) filtrée par zoneId
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {String} zoneId - ID zone
   * @returns {Promise<Object>} Document ou null
   */
  async findZoneAggregate(period, periodStart, zoneId) {
    return await AggregateData.findOne({
      sensorNodeId: null,
      period,
      periodStart,
      zoneId,
    }).populate("polluantId", "name unit");
  }

  /**
   * Récupère l'agrégation globale site (sensorNodeId null, zoneId null) filtrée par siteId
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {String} siteId - ID site
   * @returns {Promise<Object>} Document ou null
   */
  async findGlobalAggregate(period, periodStart, siteId) {
    return await AggregateData.findOne({
      sensorNodeId: null,
      zoneId: null,
      period,
      periodStart,
      siteId,
    }).populate("polluantId", "name unit");
  }

  /**
   * Récupère toutes les agrégations d'une période
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @param {Object} filters - Filtre additionnel (siteId required, zoneId optional)
   * @returns {Promise<Array>} Array d'agrégations
   */
  async findByPeriod(period, periodStart, periodEnd = null, filters = {}) {
    const filter = { period, sensorNodeId: null };

    // Site filtering (required for all queries)
    if (filters.siteId) filter.siteId = filters.siteId;

    // Zone filtering — if zoneId provided, return zone-level aggregates;
    // otherwise return site-level aggregates (zoneId: null)
    if (filters.zoneId) {
      filter.zoneId = filters.zoneId;
    } else {
      filter.zoneId = null; // site-level only
    }

    if (periodStart || periodEnd) {
      filter.periodStart = {};
      if (periodStart) filter.periodStart.$gte = periodStart;
      if (periodEnd) filter.periodStart.$lte = periodEnd;
    }

    return await AggregateData.find(filter)
      .populate("polluantId", "name unit weight")
      .populate("zoneId", "nom code")
      .sort({ periodStart: -1 });
  }

  /**
   * Récupère toutes les agrégations zone-level d'un site pour une période
   * (zoneId non null — une entrée par zone)
   * @param {String} siteId - ID site
   * @param {String} period - Type période
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Array>} Array d'agrégations avec populate zone
   */
  /**
   * Agrégations HOURLY zone-level pour construire une série site (moyenne par zone).
   * @param {String} siteId
   * @param {Date} periodStart
   * @param {Date} periodEnd
   * @returns {Promise<Array>}
   */
  async findHourlyZoneSeriesBySite(siteId, periodStart, periodEnd) {
    return this.findZoneAggregatesBySite(
      siteId,
      "HOURLY",
      periodStart,
      periodEnd,
    );
  }

  /**
   * Agrégats HOURLY pour une zone (entrée IA zone-level).
   */
  async findHourlyByZone(zoneId, periodStart, periodEnd) {
    const filter = {
      zoneId,
      period: "HOURLY",
      sensorNodeId: null,
    };

    if (periodStart || periodEnd) {
      filter.periodStart = {};
      if (periodStart) filter.periodStart.$gte = periodStart;
      if (periodEnd) filter.periodStart.$lte = periodEnd;
    }

    return await AggregateData.find(filter)
      .populate("polluantId", "name unit weight")
      .sort({ periodStart: 1, polluantId: 1 })
      .lean();
  }

  async findZoneAggregatesBySite(siteId, period, periodStart, periodEnd) {
    const filter = {
      siteId,
      period,
      sensorNodeId: null,
      zoneId: { $ne: null },
    };

    if (periodStart || periodEnd) {
      filter.periodStart = {};
      if (periodStart) filter.periodStart.$gte = periodStart;
      if (periodEnd) filter.periodStart.$lte = periodEnd;
    }

    return await AggregateData.find(filter)
      .populate("polluantId", "name unit weight")
      .populate("zoneId", "nom code description")
      .sort({ "zoneId": 1, periodStart: -1 });
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
