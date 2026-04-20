// ROUTES : SENSOR NODE
// Base URL : /api/sensor-nodes
//
// GET    /api/sensor-nodes              → liste tous les nœuds
// GET    /api/sensor-nodes/:id          → détail d'un nœud
// POST   /api/sensor-nodes              → créer un nœud
// PUT    /api/sensor-nodes/:id          → modifier un nœud
// PATCH  /api/sensor-nodes/:id/status   → changer le statut
// DELETE /api/sensor-nodes/:id          → supprimer un nœud

const express = require("express");
const router = express.Router();
const {
  getAllSensorNodes,
  getSensorNodeById,
  createSensorNode,
  updateSensorNode,
  updateNodeStatus,
  deleteSensorNode,
} = require("../controllers/sensorNodeController");

const { validateSensorNode } = require("../middleware/validators");

router
  .route("/")
  .get(getAllSensorNodes)
  .post(validateSensorNode, createSensorNode);
router
  .route("/:id")
  .get(getSensorNodeById)
  .put(updateSensorNode, validateSensorNode)
  .delete(deleteSensorNode);
//route spéciale pour le status uniquement
router.patch("/:id/status", updateNodeStatus);

module.exports = router;
