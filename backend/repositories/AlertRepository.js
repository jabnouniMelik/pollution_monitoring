/**
 * REPOSITORY : ALERT
 * Gere toutes les operations DB pour les alertes
 */

const Alert = require("../models/Alert");

class AlertRepository {
  _applyStandardPopulates(query) {
    return query
      .populate("PolluantId", "name unit regulatoryLimit")
      .populate({
        path: "SensorId",
        select: "model type sensorNodeId",
        populate: {
          path: "sensorNodeId",
          select: "nom zone IndustrieId",
        },
      })
      .populate("ReadingId", "value unit timestamp")
      .populate("acknowledgedBy", "username email")
      .populate("resolvedBy", "username email");
  }

  async _resolveSensorIds(zoneCodes) {
    if (!zoneCodes || zoneCodes.length === 0) return null;

    const SensorNode = require("../models/SensorNode");
    const Sensor = require("../models/Sensor");

    const orConditions = zoneCodes.map((c) => ({
      zone: {
        $regex: "^" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
        $options: "i",
      },
    }));

    const nodes = await SensorNode.find({ $or: orConditions })
      .select("_id")
      .lean();
    if (nodes.length === 0) return null;

    const sensors = await Sensor.find({
      sensorNodeId: { $in: nodes.map((n) => n._id) },
    })
      .select("_id")
      .lean();

    return sensors.length > 0 ? sensors.map((s) => s._id) : null;
  }

  async _buildScopedFilter(filter = {}) {
    const pollutantName = filter._pollutantName;
    const zoneId = filter._zoneId;
    const siteId = filter._siteId;
    const siteIds = filter._siteIds;
    const industryId = filter._industryId;

    const dbFilter = { ...filter };
    delete dbFilter._pollutantName;
    delete dbFilter._zoneId;
    delete dbFilter._siteId;
    delete dbFilter._siteIds;
    delete dbFilter._industryId;

    if (pollutantName) {
      const Polluant = require("../models/Polluant");
      const aliases = [pollutantName];
      if (pollutantName.toUpperCase() === "PM") aliases.push("PM25", "PM2.5", "PM10");
      if (pollutantName.toUpperCase() === "PM25") aliases.push("PM", "PM10");
      if (pollutantName.toUpperCase() === "PM10") aliases.push("PM", "PM25");
      const polluants = await Polluant.find({
        $or: aliases.flatMap((alias) => [
          { code: new RegExp("^" + alias + "$", "i") },
          { name: new RegExp("^" + alias + "$", "i") },
        ]),
      }).select("_id");
      dbFilter.PolluantId = { $in: polluants.map((p) => p._id) };
    }

    if (zoneId && !dbFilter.SensorId) {
      const Zone = require("../models/Zone");
      const zone = await Zone.findById(zoneId).select("code nom").lean();
      if (zone) {
        const codes = [zone.code, zone.nom].filter(Boolean);
        const sensorIds = await this._resolveSensorIds(codes);
        if (sensorIds !== null) {
          dbFilter.SensorId = { $in: sensorIds };
        }
      }
    }

    if (siteId && !dbFilter.SensorId) {
      const Zone = require("../models/Zone");
      const zones = await Zone.find({ siteId }).select("code nom").lean();
      if (zones.length > 0) {
        const codes = zones.flatMap((z) => [z.code, z.nom].filter(Boolean));
        const sensorIds = await this._resolveSensorIds(codes);
        if (sensorIds !== null) {
          dbFilter.SensorId = { $in: sensorIds };
        }
      }
    }

    if (siteIds && siteIds.length > 0 && !dbFilter.SensorId) {
      const Zone = require("../models/Zone");
      const zones = await Zone.find({ siteId: { $in: siteIds } })
        .select("code nom")
        .lean();
      if (zones.length > 0) {
        const codes = zones.flatMap((z) => [z.code, z.nom].filter(Boolean));
        const sensorIds = await this._resolveSensorIds(codes);
        if (sensorIds !== null) {
          dbFilter.SensorId = { $in: sensorIds };
        }
      }
    }

    if (industryId && !dbFilter.SensorId) {
      const Zone = require("../models/Zone");
      const zones = await Zone.find({ industrieId: industryId })
        .select("code nom")
        .lean();
      if (zones.length > 0) {
        const codes = zones.flatMap((z) => [z.code, z.nom].filter(Boolean));
        const sensorIds = await this._resolveSensorIds(codes);
        if (sensorIds !== null) {
          dbFilter.SensorId = { $in: sensorIds };
        }
      }
    }

    return dbFilter;
  }

  /**
   * Recupere toutes les alertes avec filtres et pagination
   */
  async findAllPaginated(filter = {}, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const dbFilter = await this._buildScopedFilter(filter);

    const [items, total] = await Promise.all([
      this._applyStandardPopulates(Alert.find(dbFilter))
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize),
      Alert.countDocuments(dbFilter),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findAll(filter = {}, limit = 50) {
    const dbFilter = await this._buildScopedFilter(filter);
    return await this._applyStandardPopulates(Alert.find(dbFilter))
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findById(id) {
    return await this._applyStandardPopulates(Alert.findById(id));
  }

  async create(data) {
    return await Alert.create(data);
  }

  async acknowledge(id, userId) {
    const updated = await Alert.findByIdAndUpdate(
      id,
      {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        // resolvedAt is NOT set here — acknowledging ≠ resolving
      },
      { returnDocument: "after" },
    );
    if (!updated) return null;
    return this.findById(id);
  }

  async escalate(id, newSeverity, reason) {
    return await Alert.findByIdAndUpdate(
      id,
      { severity: newSeverity, escalationReason: reason },
      { returnDocument: "after" },
    );
  }

  /**
   * Manual resolution by a user — sets resolvedAt + resolutionNote.
   * Does NOT force isAcknowledged (operator may resolve without acknowledging first).
   */
  async resolve(id, userId, note) {
    const updated = await Alert.findByIdAndUpdate(
      id,
      {
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNote: note,
      },
      { returnDocument: "after" },
    );
    if (!updated) return null;
    return this.findById(id);
  }

  /**
   * Automatic resolution by the alert engine when the measured value
   * drops back below the threshold. Sets resolvedAt only — does NOT
   * touch isAcknowledged (the operator may not have seen it yet).
   */
  async autoResolve(id, note) {
    return await Alert.findByIdAndUpdate(
      id,
      {
        resolvedAt: new Date(),
        resolvedBy: null, // system-resolved, no user
        resolutionNote:
          note || "Valeur revenue dans les limites réglementaires",
      },
      { returnDocument: "after" },
    );
  }

  /**
   * Update an active (open) alert in place — new value, severity, timestamp.
   * Used by the alert engine to refresh a breach without creating duplicates.
   */
  async updateActive(id, { severity, value, ReadingId, message, timestamp }) {
    return await Alert.findByIdAndUpdate(
      id,
      {
        severity,
        value,
        ReadingId,
        message,
        timestamp,
        // Keep isAcknowledged as-is — operator may have already seen it
      },
      { returnDocument: "after" },
    );
  }

  async countUnacknowledged(filters = {}) {
    const dbFilter = await this._buildScopedFilter(filters);
    return await Alert.countDocuments({ ...dbFilter, isAcknowledged: false });
  }

  async countCriticalUnacknowledged(filters = {}) {
    const dbFilter = await this._buildScopedFilter(filters);
    return await Alert.countDocuments({
      ...dbFilter,
      isAcknowledged: false,
      severity: { $in: ["Critical", "High", "HIGH", "CRITICAL"] },
    });
  }

  async countResolved(filters = {}) {
    const dbFilter = await this._buildScopedFilter(filters);
    return await Alert.countDocuments({
      ...dbFilter,
      resolvedAt: { $ne: null },
    });
  }

  async statsBySeverity(filters = {}) {
    const dbFilter = await this._buildScopedFilter(filters);
    return await Alert.aggregate([
      { $match: dbFilter },
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

  async statsByPolluant(filters = {}) {
    const dbFilter = await this._buildScopedFilter(filters);
    return await Alert.aggregate([
      { $match: dbFilter },
      { $group: { _id: "$PolluantId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "polluants",
          localField: "_id",
          foreignField: "_id",
          as: "polluant",
        },
      },
      { $unwind: "$polluant" },
      { $project: { polluantName: "$polluant.name", count: 1 } },
    ]);
  }
}

module.exports = new AlertRepository();
