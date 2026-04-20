/**
 * Reading DTOs
 * Defines request/response contracts for reading endpoints
 */

/**
 * Reading DTO
 */
export class ReadingDTO {
  constructor(
    id,
    sensorId,
    nodeId,
    pollutant,
    value,
    unit,
    timestamp,
    status = "normal",
  ) {
    this.id = id;
    this.sensorId = sensorId;
    this.nodeId = nodeId;
    this.pollutant = pollutant;
    this.value = value;
    this.unit = unit;
    this.timestamp = timestamp;
    this.status = status; // "normal", "warning", "critical"
  }

  static fromEntity(reading) {
    return new ReadingDTO(
      reading._id || reading.id,
      reading.sensor_id || reading.sensorId,
      reading.node_id || reading.nodeId,
      reading.pollutant,
      reading.value,
      reading.unit,
      reading.timestamp,
      reading.status || "normal",
    );
  }
}

/**
 * Readings History Response DTO
 */
export class ReadingsHistoryDTO {
  constructor(readings, total, page, pageSize, pollutants = []) {
    this.readings = readings;
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
    this.pollutants = pollutants;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Daily Aggregate DTO
 */
export class DailyAggregateDTO {
  constructor(date, pollutant, min, max, average, unit) {
    this.date = date;
    this.pollutant = pollutant;
    this.min = min;
    this.max = max;
    this.average = average;
    this.unit = unit;
  }
}

/**
 * Readings Stats DTO
 */
export class ReadingsStatsDTO {
  constructor(sensorId, pollutant, min, max, average, latest, unit) {
    this.sensorId = sensorId;
    this.pollutant = pollutant;
    this.min = min;
    this.max = max;
    this.average = average;
    this.latest = latest;
    this.unit = unit;
  }
}

export default {
  ReadingDTO,
  ReadingsHistoryDTO,
  DailyAggregateDTO,
  ReadingsStatsDTO,
};
