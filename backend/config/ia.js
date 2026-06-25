/**
 * Configuration intégration LSTM 4 h (alignée sur ia/config.py LSTM_FEATURE_NAMES).
 */

const LSTM_FEATURE_ORDER = [
  "CO2",
  "NOX",
  "SOX",
  "PM25",
  "PM10",
  "COV",
  "TEMPERATURE",
  "HUMIDITY",
];

/** Noms MongoDB (Polluant.name) → clé LSTM */
const DB_POLLUTANT_TO_LSTM = {
  CO2: "CO2",
  NOX: "NOX",
  SO2: "SOX",
  PM25: "PM25",
  "PM2.5": "PM25",
  PM10: "PM10",
  COV: "COV",
  TEMPERATURE: "TEMPERATURE",
  HUMIDITY: "HUMIDITY",
};

/** Valeurs physiques par défaut si absentes des agrégations site */
const LSTM_MISSING_DEFAULTS = {
  PM10: null,
  TEMPERATURE: 25,
  HUMIDITY: 50,
};

/** Colonnes Isolation Forest (notebook 04 — pivot horaire) */
const IF_FEATURE_ORDER = ["NOX", "SOX", "PM25", "PM10", "CO2", "COV"];

const IA_CONFIG = {
  enabled: process.env.IA_ENABLED !== "false",
  ifEnabled: process.env.IA_IF_ENABLED !== "false",
  serviceUrl: (process.env.IA_SERVICE_URL || "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  ),
  lookbackHours: parseInt(process.env.IA_LOOKBACK_HOURS || "48", 10),
  horizonHours: 4,
  ifMinFeatures: parseInt(process.env.IA_IF_MIN_FEATURES || "4", 10),
  ifLookbackHours: parseInt(process.env.IA_IF_LOOKBACK_HOURS || "48", 10),
  ifSyncHours: parseInt(process.env.IA_IF_SYNC_HOURS || "48", 10),
  createForecastAlerts: process.env.IA_CREATE_FORECAST_ALERTS === "true",
  createAnomalyAlerts: process.env.IA_CREATE_ANOMALY_ALERTS !== "false",
  requestTimeoutMs: parseInt(process.env.IA_REQUEST_TIMEOUT_MS || "30000", 10),
  skillReportPath:
    process.env.IA_SKILL_REPORT_PATH ||
    require("path").join(__dirname, "../../ia/models/lstm_4h_skill_report.json"),
};

module.exports = {
  LSTM_FEATURE_ORDER,
  IF_FEATURE_ORDER,
  DB_POLLUTANT_TO_LSTM,
  LSTM_MISSING_DEFAULTS,
  IA_CONFIG,
};
