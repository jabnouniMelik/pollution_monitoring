/**
 * CONTROLLER : READING
 * Gère toutes les opérations HTTP pour les mesures de capteurs
 * Logique métier (moteur d'alertes) déléguée à ReadingService
 */

const readingService = require("../services/ReadingService");
const { error_messages, success_messages } = require("../utils/constants");

// ── POST /api/readings/ingest ────────────────────────────
// Endpoint principal : réception données IoT (ESP32 → MQTT → ingest)
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

// ── GET /api/readings ────────────────────────────────────
// Historique des mesures avec filtres avancés
const getAllReadings = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.sensorId) filter.sensorId = req.query.sensorId;

    // PolluantId uses capital P in the schema — accept both casings from clients
    if (req.query.polluantId) filter.PolluantId = req.query.polluantId;
    if (req.query.PolluantId) filter.PolluantId = req.query.PolluantId;

    if (req.query.nodeId) filter.nodeId = req.query.nodeId;
    if (req.query.isValid !== undefined)
      filter.isValid = req.query.isValid === "true";

    // Filtre de date
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
    }

    // zoneId filter: resolve nodeIds that belong to this zone
    if (req.query.zoneId) {
      const SensorNode = require("../models/SensorNode");
      const nodes = await SensorNode.find({ ZoneId: req.query.zoneId })
        .select("_id")
        .lean();
      // Also try matching by zone string code if no ObjectId match
      if (nodes.length === 0) {
        const Zone = require("../models/Zone");
        const zone = await Zone.findById(req.query.zoneId).select("code").lean();
        if (zone) {
          const nodesByCode = await SensorNode.find({ zone: zone.code })
            .select("_id")
            .lean();
          if (nodesByCode.length > 0) {
            filter.nodeId = { $in: nodesByCode.map((n) => n._id) };
          }
        }
      } else {
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
// Retourne la dernière mesure de chaque capteur actif
const getLatestReadings = async (req, res, next) => {
  try {
    let nodeId = req.query.nodeId || null;

    // zoneId filter: resolve nodeIds from zone
    if (req.query.zoneId && !nodeId) {
      const SensorNode = require("../models/SensorNode");
      const Zone = require("../models/Zone");
      const zone = await Zone.findById(req.query.zoneId).select("code").lean();
      if (zone) {
        const nodes = await SensorNode.find({ zone: zone.code })
          .select("_id")
          .lean();
        // Pass first node or handle multiple — service accepts single nodeId
        // For latest readings we pass the filter differently
        if (nodes.length > 0) {
          const filter = { nodeId: { $in: nodes.map((n) => n._id) } };
          if (req.query.polluantId) filter.PolluantId = req.query.polluantId;
          const latestReadings = await readingService.getAllReadings(filter, parseInt(req.query.limit) || 200);
          return res.status(200).json({
            success: true,
            count: latestReadings.length,
            data: latestReadings,
          });
        }
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
// Détails d'une mesure spécifique
const getReadingById = async (req, res, next) => {
  try {
    const result = await readingService.getReadingById(req.params.id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestReading,
  getAllReadings,
  getLatestReadings,
  getReadingById,
};
