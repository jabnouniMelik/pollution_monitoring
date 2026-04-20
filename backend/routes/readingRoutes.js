// ROUTES : READING
// Base URL : /api/readings
//
// POST /api/readings/ingest    → réception données capteurs IoT
// GET  /api/readings/latest    → dernière mesure par capteur
// GET  /api/readings           → historique avec filtres
// GET  /api/readings/:id       → détail d'une mesure
//
// IMPORTANT : /ingest et /latest AVANT /:id
// Sinon Express confond "ingest" et "latest" avec un :id
// ============================================================

const express = require("express");
const router = express.Router();

const {
  ingestReading,
  getAllReadings,
  getLatestReadings,
  getReadingById,
} = require("../controllers/readingController");

const { validateReading } = require("../middleware/validators");

// Routes spéciales AVANT /:id — ordre important !
router.post("/ingest", validateReading, ingestReading);
router.get("/latest", getLatestReadings);

// Routes générales
router.route("/").get(getAllReadings);

router.route("/:id").get(getReadingById);

module.exports = router;
