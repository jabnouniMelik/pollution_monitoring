/**
 * KPI DTOs
 * Defines request/response contracts for KPI endpoints
 */

/**
 * KPI Dashboard DTO
 */
export class KpiDashboardDTO {
  constructor(
    kpiId,
    name,
    description,
    category,
    value,
    target,
    unit,
    status,
    trend,
    lastUpdated,
  ) {
    this.kpiId = kpiId;
    this.name = name;
    this.description = description;
    this.category = category;
    this.value = value;
    this.target = target;
    this.unit = unit;
    this.status = status; // "good", "warning", "critical"
    this.trend = trend; // "up", "down", "stable"
    this.lastUpdated = lastUpdated;
  }

  static fromEntity(kpi) {
    return new KpiDashboardDTO(
      kpi._id || kpi.id,
      kpi.name,
      kpi.description,
      kpi.category,
      kpi.value,
      kpi.target,
      kpi.unit,
      kpi.status || "good",
      kpi.trend || "stable",
      kpi.last_updated || kpi.lastUpdated || new Date(),
    );
  }
}

/**
 * KPI Trends Response DTO
 */
export class KpiTrendsDTO {
  constructor(kpiId, name, dataPoints = [], startDate, endDate) {
    this.kpiId = kpiId;
    this.name = name;
    this.dataPoints = dataPoints;
    this.startDate = startDate;
    this.endDate = endDate;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * KPI Data Point DTO
 */
export class KpiDataPointDTO {
  constructor(date, value, status = "good") {
    this.date = date;
    this.value = value;
    this.status = status;
  }
}

/**
 * KPI Dashboard Response DTO (aggregated)
 */
export class KpiDashboardResponseDTO {
  constructor(kpis = [], summary = {}) {
    this.kpis = kpis;
    this.summary = summary;
    this.timestamp = new Date().toISOString();
  }
}

export default {
  KpiDashboardDTO,
  KpiTrendsDTO,
  KpiDataPointDTO,
  KpiDashboardResponseDTO,
};
