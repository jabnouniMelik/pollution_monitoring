const express = require("express");
const router = express.Router();
const iaController = require("../controllers/iaController");
const verifyToken = require("../middleware/verifyToken");
const { checkPermission } = require("../middleware/checkRole");

router.get("/health", verifyToken, checkPermission("view_ai"), iaController.getHealth);

router.get(
  "/zone/:zoneId/forecasts/latest",
  verifyToken,
  checkPermission("view_ai"),
  iaController.getLatestForecast,
);

router.post(
  "/zone/:zoneId/forecasts/run",
  verifyToken,
  checkPermission("run_ia"),
  iaController.runForecast,
);

router.post(
  "/forecasts/run-all",
  verifyToken,
  checkPermission("run_ia"),
  iaController.runAllForecasts,
);

router.get(
  "/zone/:zoneId/anomalies/history",
  verifyToken,
  checkPermission("view_ai"),
  iaController.getAnomalyHistory,
);

router.post(
  "/zone/:zoneId/anomalies/detect",
  verifyToken,
  checkPermission("run_ia"),
  iaController.runAnomalyDetection,
);

router.post(
  "/anomalies/detect-all",
  verifyToken,
  checkPermission("run_ia"),
  iaController.runAllAnomalyDetection,
);

router.post(
  "/retrain/dataset/prepare",
  verifyToken,
  checkPermission("run_ia"),
  iaController.prepareRetrainDataset,
);

router.get(
  "/retrain/dataset/latest",
  verifyToken,
  checkPermission("view_ai"),
  iaController.getLatestRetrainDataset,
);

router.post("/retrain/start", verifyToken, checkPermission("run_ia"), iaController.startRetrain);

router.get(
  "/retrain/jobs/latest",
  verifyToken,
  checkPermission("view_ai"),
  iaController.getLatestRetrainJob,
);

router.get(
  "/retrain/jobs/:jobId",
  verifyToken,
  checkPermission("view_ai"),
  iaController.getRetrainJobById,
);

module.exports = router;

