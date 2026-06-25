const LstmForecast = require("../models/LstmForecast");

class LstmForecastRepository {
  async create(data) {
    return LstmForecast.create(data);
  }

  async findLatestByZone(zoneId, limit = 1) {
    return LstmForecast.find({ zoneId })
      .sort({ runAt: -1 })
      .limit(limit)
      .lean();
  }

  async findLatestBySite(siteId, limit = 1) {
    return LstmForecast.find({ siteId })
      .sort({ runAt: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new LstmForecastRepository();
