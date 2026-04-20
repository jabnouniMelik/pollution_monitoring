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
    if (req.query.polluantId) filter.polluantId = req.query.polluantId;
    if (req.query.nodeId) filter.nodeId = req.query.nodeId;
    if (req.query.isValid !== undefined)
      filter.isValid = req.query.isValid === "true";

    // Filtre de date
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
    }

    const limit = parseInt(req.query.limit) || 100;
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
    const nodeId = req.query.nodeId || null;
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
