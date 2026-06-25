const AnomalyDetection = require("../models/AnomalyDetection");

class AnomalyDetectionRepository {
  async create(data) {
    return AnomalyDetection.create(data);
  }

  async findLatestByZone(zoneId, limit = 10) {
    return AnomalyDetection.find({ zoneId })
      .sort({ periodStart: -1 })
      .limit(limit)
      .lean();
  }

  async findByZoneAndPeriod(zoneId, periodStart) {
    return AnomalyDetection.findOne({ zoneId, periodStart }).lean();
  }

  async findLatestBySite(siteId, limit = 10) {
    return AnomalyDetection.find({ siteId })
      .sort({ periodStart: -1 })
      .limit(limit)
      .lean();
  }

  async findBySiteAndPeriod(siteId, periodStart) {
    return AnomalyDetection.findOne({ siteId, periodStart }).lean();
  }
}

module.exports = new AnomalyDetectionRepository();
