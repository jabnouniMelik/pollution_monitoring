/**
 * CONTROLLER : READING
 * Gère toutes les opérations HTTP pour les mesures de capteurs
 * Logique métier (moteur d'alertes) déléguée à ReadingService
 */

const readingService = require("../services/ReadingService");
const Reading = require("../models/Reading");
const mongoose = require("mongoose");

// ── POST /api/readings/ingest ────────────────────────────
const ingestReading = async (req, res, next) => {
  try {
    const result = await readingService.ingestReading(req.body);
    res.status(201).json({
      success: true,
      message: "Mesure ingérée avec succès",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/readings/history ────────────────────────────
// Historique agrégé pour les graphiques.
// Regroupe les mesures en buckets temporels côté DB et retourne
// la moyenne par bucket — indépendamment du nombre de nœuds.
// Paramètres : polluantId, from, to, buckets (défaut 300)
const getHistory = async (req, res, next) => {
  try {
    const { polluantId, from, to, zoneId } = req.query;
    const targetBuckets = Math.min(parseInt(req.query.buckets) || 300, 500);

    if (!polluantId || !from || !to) {
      return res.status(400).json({
        error: "polluantId, from et to sont requis",
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const rangeMs = toDate.getTime() - fromDate.getTime();

    if (rangeMs <= 0) {
      return res.status(400).json({ error: "from doit être antérieur à to" });
    }

    // Bucket size in ms — divide the range into targetBuckets slots
    const bucketMs = Math.ceil(rangeMs / targetBuckets);

    const match = {
      PolluantId: new mongoose.Types.ObjectId(polluantId),
      timestamp: { $gte: fromDate, $lte: toDate },
      isValid: true,
    };

    // Resolve zoneId → nodeIds if provided
    if (zoneId) {
      const SensorNode = require("../models/SensorNode");
      const nodeIds = await SensorNode.find({ zoneId }).select("_id").lean();
      if (nodeIds.length > 0) {
        match.nodeId = { $in: nodeIds.map((n) => n._id) };
      }
    }

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          bucket: {
            $toDate: {
              $multiply: [
                { $floor: { $divide: [{ $toLong: "$timestamp" }, bucketMs] } },
                bucketMs,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: "$bucket",
          avg: { $avg: "$value" },
          min: { $min: "$value" },
          max: { $max: "$value" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          timestamp: "$_id",
          avg: { $round: ["$avg", 2] },
          min: { $round: ["$min", 2] },
          max: { $round: ["$max", 2] },
          count: 1,
        },
      },
    ];

    const points = await Reading.aggregate(pipeline);

    res.json({
      success: true,
      count: points.length,
      bucketMs,
      data: points,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/readings ────────────────────────────────────
const getAllReadings = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.sensorId) filter.sensorId = req.query.sensorId;
    if (req.query.polluantId) filter.PolluantId = req.query.polluantId;
    if (req.query.PolluantId) filter.PolluantId = req.query.PolluantId;
    if (req.query.nodeId) filter.nodeId = req.query.nodeId;
    if (req.query.isValid !== undefined)
      filter.isValid = req.query.isValid === "true";

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    if (req.query.zoneId) {
      const SensorNode = require("../models/SensorNode");
      const nodes = await SensorNode.find({ zoneId: req.query.zoneId })
        .select("_id")
        .lean();
      if (nodes.length > 0) {
        filter.nodeId = { $in: nodes.map((n) => n._id) };
      }
    }

    const limit = parseInt(req.query.limit) || 500;
    const readings = await readingService.getAllReadings(filter, limit);

    res.status(200).json({
      success: true,
      count: readings.length,
      data: readings,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/readings/latest ────────────────────────────
const getLatestReadings = async (req, res, next) => {
  try {
    let nodeId = req.query.nodeId || null;

    if (req.query.zoneId && !nodeId) {
      const SensorNode = require("../models/SensorNode");
      const nodeIds = await SensorNode.find({ zoneId: req.query.zoneId })
        .select("_id")
        .lean();
      if (nodeIds.length > 0) {
        const filter = { nodeId: { $in: nodeIds.map((n) => n._id) } };
        if (req.query.polluantId) filter.PolluantId = req.query.polluantId;
        const latestReadings = await readingService.getAllReadings(
          filter,
          parseInt(req.query.limit) || 200,
        );
        return res.status(200).json({
          success: true,
          count: latestReadings.length,
          data: latestReadings,
        });
      }
    }

    const latestReadings = await readingService.getLatestReadings(nodeId);
    res.status(200).json({
      success: true,
      count: latestReadings.length,
      data: latestReadings,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/readings/:id ────────────────────────────────
const getReadingById = async (req, res, next) => {
  try {
    const result = await readingService.getReadingById(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestReading,
  getHistory,
  getAllReadings,
  getLatestReadings,
  getReadingById,
};
