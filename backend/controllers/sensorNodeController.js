/**
 * CONTROLLER : SENSOR NODE
 * Gère toutes les opérations HTTP pour les nœuds ESP32
 * Logique métier déléguée à SensorNodeService
 */

const sensorNodeService = require("../services/SensorNodeService");
const { error_messages, success_messages } = require("../utils/constants");

// ── GET /api/sensor-nodes ────────────────────────────────
// Retourne tous les nœuds avec filtres optionnels
const getAllSensorNodes = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.industrieId) filter.industrieId = req.query.industrieId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.zone) filter.zone = req.query.zone;

    const nodes = await sensorNodeService.getAllSensorNodes(filter);

    res.status(200).json({
      success: true,
      count: nodes.length,
      data: nodes,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/sensor-nodes/:id ─────────────────────────────
// Retourne un nœud avec ses capteurs associés
const getSensorNodeById = async (req, res, next) => {
  try {
    const node = await sensorNodeService.getSensorNodeById(req.params.id);

    res.status(200).json({
      success: true,
      data: node,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/sensor-nodes ────────────────────────────────
// Enregistre un nouveau nœud ESP32
const createSensorNode = async (req, res, next) => {
  try {
    const node = await sensorNodeService.createSensorNode(req.body);

    res.status(201).json({
      success: true,
      message: success_messages.created,
      data: node,
    });
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/sensor-nodes/:id ───────────────────────────────
// Met à jour la configuration d'un nœud
const updateSensorNode = async (req, res, next) => {
  try {
    const node = await sensorNodeService.updateSensorNode(
      req.params.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: success_messages.updated,
      data: node,
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/sensor-nodes/:id/status ──────────────────
// Met à jour UNIQUEMENT le statut d'un nœud
const updateNodeStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const node = await sensorNodeService.updateNodeStatus(
      req.params.id,
      status,
    );

    res.status(200).json({
      success: true,
      message: `Statut mis à jour : ${status}`,
      data: { _id: node._id, nom: node.nom, status: node.status },
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/sensor-nodes/:id ──────────────────────────
// Supprime un nœud (vérification: pas de capteurs liés)
const deleteSensorNode = async (req, res, next) => {
  try {
    await sensorNodeService.deleteSensorNode(req.params.id);

    res.status(200).json({
      success: true,
      message: success_messages.deleted,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSensorNodes,
  getSensorNodeById,
  createSensorNode,
  updateSensorNode,
  updateNodeStatus,
  deleteSensorNode,
};
