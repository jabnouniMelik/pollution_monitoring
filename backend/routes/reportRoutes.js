// ROUTES : REPORT
// Base URL : /api/reports
//
// GET  /api/reports                → liste tous les rapports
// GET  /api/reports/:id            → détail d'un rapport
// POST /api/reports/generate       → générer un rapport
// POST /api/reports/:id/submit     → soumettre à l'ANPE
// DELETE /api/reports/:id          → supprimer un rapport DRAFT
//
//  /generate AVANT /:id

const express = require("express");
const router = express.Router();

const {
  getAllReports,
  getReportById,
  generateReport,
  submitReport,
  deleteReport,
} = require("../controllers/reportController");

// Route spéciale AVANT /:id
router.post("/generate", generateReport);

// Routes générales
router.route("/").get(getAllReports);

router.route("/:id").get(getReportById).delete(deleteReport);

// Action soumission ANPE
router.post("/:id/submit", submitReport);

module.exports = router;
