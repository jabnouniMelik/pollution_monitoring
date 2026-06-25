//les constantes golbales du projet
//toutes les valeurs fixes utiliseés dans controllers ,models and middleware sont definies ici

//status des noeuds esp32
const sensor_node_status = {
  Active: "ACTIVE",
  Inactive: "INACTIVE",
  Maintenance: "MAINTENANCE",
};

//types des polluants
const pollutant_types = {
  CO2: "CO2",
  NOX: "NOX",
  PM25: "PM2.5",
  PM10: "PM10",
  COV: "COV",
  SO2: "SO2",
};

//niveau de gravité des alertes
const alert_severity = {
  Warning: "Warning",
  High: "High",
  Critical: "Critical",
};
//types des alertes
const alert_types = {
  Threshold: "Threshold",
  Anomaly: "Anomaly",
  SensorFault: "SensorFault",
  Forecast: "Forecast",
};

//status des rapports reglementaires
const report_status = {
  draft: "DRAFT",
  submitted: "SUBMITTED",
  approved: "APPROVED",
  rejected: "REJECTED",
};

//message d'erreur standards de l'API
const error_messages = {
  not_found: "Resource not found",
  invalid_id: "Invalid ID",
  validation_error: "Validation error",
  server_error: "Internal server error",
  duplicate: "Duplicate entry",
  unauthorized: "Unauthorized",
};

//messages de succès standards de l'API
const success_messages = {
  created: "Resource created successfully",
  updated: "Resource updated successfully",
  deleted: "Resource deleted successfully",
};
module.exports = {
  sensor_node_status,
  pollutant_types,
  alert_severity,
  alert_types,
  report_status,
  error_messages,
  success_messages,
};
