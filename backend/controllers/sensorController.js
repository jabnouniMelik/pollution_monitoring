/**
 * CONTROLLER : SENSOR
 * Gère toutes les opérations HTTP pour les capteurs
 * Logique métier déléguée à SensorService
 */

const sensorService = require("../services/SensorService");
const { error_messages, success_messages } = require("../utils/constants");

// ── GET /api/sensors ─────────────────────────────────────
// Retourne tous les capteurs avec filtres
const getAllSensors = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.sensorNodeId) filter.sensorNodeId = req.query.sensorNodeId;
    if (req.query.polluantId) filter.PolluantId = req.query.polluantId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    const sensors = await sensorService.getAllSensors(filter);

    res.status(200).json({
      success: true,
      count: sensors.length,
      data: sensors,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/sensors/:id ─────────────────────────────────
// Retourne un capteur avec sa dernière mesure
const getSensorById = async (req, res, next) => {
  try {
    const sensor = await sensorService.getSensorById(req.params.id);

    res.status(200).json({
      success: true,
      data: sensor,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/sensors ────────────────────────────────────
// Ajoute un nouveau capteur sur un nœud existant
const createSensor = async (req, res, next) => {
  try {
    const sensor = await sensorService.createSensor(req.body);

    res.status(201).json({
      success: true,
      message: success_messages.created,
      data: sensor,
    });
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/sensors/:id ─────────────────────────────────
// Met à jour un capteur
const updateSensor = async (req, res, next) => {
  try {
    const sensor = await sensorService.updateSensor(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: success_messages.updated,
      data: sensor,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/sensors/:id/calibrate ──────────────────────
// Effectue une calibration du capteur
const calibrateSensor = async (req, res, next) => {
  try {
    const { driftThreshold } = req.body;

    const sensor = await sensorService.calibrateSensor(
      req.params.id,
      driftThreshold,
    );

    res.status(200).json({
      success: true,
      message: `Capteur calibré à ${new Date().toISOString()}`,
      data: sensor,
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/sensors/:id ──────────────────────────────
// Effectue une suppression logique du capteur (isActive = false)
const deleteSensor = async (req, res, next) => {
  try {
    await sensorService.deleteSensor(req.params.id);

    res.status(200).json({
      success: true,
      message: success_messages.deleted,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSensors,
  getSensorById,
  createSensor,
  updateSensor,
  calibrateSensor,
  deleteSensor,
};
