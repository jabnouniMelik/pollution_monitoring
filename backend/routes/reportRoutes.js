// ROUTES : REPORT
// Base URL : /api/reports

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkPermission } = require("../middleware/checkRole");

const {
  getAllReports,
  getReportById,
  generateReport,
  submitReport,
  approveReport,
  rejectReport,
  deleteReport,
} = require("../controllers/reportController");

router.use(verifyToken);

router.post(
  "/generate",
  checkPermission("generate_reports"),
  generateReport,
);

router.get("/", checkPermission("generate_reports"), getAllReports);

router.get("/:id", checkPermission("generate_reports"), getReportById);

router.post(
  "/:id/submit",
  checkPermission("submit_reports"),
  submitReport,
);

router.post(
  "/:id/approve",
  checkPermission("approve_reports"),
  approveReport,
);

router.post(
  "/:id/reject",
  checkPermission("approve_reports"),
  rejectReport,
);

router.delete(
  "/:id",
  checkPermission("generate_reports"),
  deleteReport,
);

module.exports = router;
