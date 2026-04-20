/**
 * Alert DTOs
 * Defines request/response contracts for alert endpoints
 */

/**
 * Alert DTO
 */
export class AlertDTO {
  constructor(
    id,
    sensorId,
    nodeId,
    pollutant,
    type,
    severity,
    message,
    value,
    threshold,
    timestamp,
    acknowledged = false,
    acknowledgedAt = null,
  ) {
    this.id = id;
    this.sensorId = sensorId;
    this.nodeId = nodeId;
    this.pollutant = pollutant;
    this.type = type; // "threshold_breach", "sensor_malfunction", "calibration_due"
    this.severity = severity; // "info", "warning", "critical"
    this.message = message;
    this.value = value;
    this.threshold = threshold;
    this.timestamp = timestamp;
    this.acknowledged = acknowledged;
    this.acknowledgedAt = acknowledgedAt;
  }

  static fromEntity(alert) {
    return new AlertDTO(
      alert._id || alert.id,
      alert.sensor_id || alert.sensorId,
      alert.node_id || alert.nodeId,
      alert.pollutant,
      alert.type,
      alert.severity,
      alert.message,
      alert.value,
      alert.threshold,
      alert.timestamp,
      alert.acknowledged || false,
      alert.acknowledged_at || alert.acknowledgedAt,
    );
  }
}

/**
 * Alert List Response DTO
 */
export class AlertsListDTO {
  constructor(alerts, total, page, pageSize, filters = {}) {
    this.alerts = alerts;
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
    this.filters = filters;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Alert Create Request DTO
 */
export class CreateAlertRequestDTO {
  constructor(
    sensorId,
    nodeId,
    pollutant,
    type,
    severity,
    message,
    value,
    threshold,
  ) {
    this.sensorId = sensorId;
    this.nodeId = nodeId;
    this.pollutant = pollutant;
    this.type = type;
    this.severity = severity;
    this.message = message;
    this.value = value;
    this.threshold = threshold;
  }

  static validate(data) {
    if (!data.sensorId || !data.nodeId || !data.pollutant) {
      throw new Error("sensorId, nodeId, and pollutant are required");
    }
    if (
      !["threshold_breach", "sensor_malfunction", "calibration_due"].includes(
        data.type,
      )
    ) {
      throw new Error("Invalid alert type");
    }
    if (!["info", "warning", "critical"].includes(data.severity)) {
      throw new Error("Invalid severity level");
    }
  }
}

/**
 * Alert Acknowledge Request DTO
 */
export class AcknowledgeAlertRequestDTO {
  constructor(alertId) {
    this.alertId = alertId;
  }
}

export default {
  AlertDTO,
  AlertsListDTO,
  CreateAlertRequestDTO,
  AcknowledgeAlertRequestDTO,
};
