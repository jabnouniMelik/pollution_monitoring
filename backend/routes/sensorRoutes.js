// ROUTES : SENSOR
// Base URL : /api/sensors
//
// GET    /api/sensors                → liste tous les capteurs
// GET    /api/sensors/:id            → détail d'un capteur
// POST   /api/sensors                → ajouter un capteur
// PUT    /api/sensors/:id            → modifier un capteur
// POST   /api/sensors/:id/calibrate  → calibrer un capteur
// DELETE /api/sensors/:id            → désactiver un capteur

const express = require("express");
const router = express.Router();
const {
  getAllSensors,
  getSensorById,
  updateSensor,
  createSensor,
  calibrateSensor,
  deleteSensor,
} = require("../controllers/sensorController");
const { validateSensor } = require("../middleware/validators");
router.route("/").get(getAllSensors).post(validateSensor, createSensor);

router
  .route("/:id")
  .get(getSensorById)
  .put(validateSensor, updateSensor)
  .delete(deleteSensor);

//route pour calibrer un capteur
router.post("/:id/calibrate", calibrateSensor);

module.exports = router;
