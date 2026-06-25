const aiService = require("../services/AIService");
const iaRetrainService = require("../services/IARetrainService");



exports.getHealth = async (req, res, next) => {

  try {

    const health = await aiService.checkHealth();

    const skill = aiService.getSkillSummary();

    res.json({ success: true, data: { health, skill } });

  } catch (err) {

    next(err);

  }

};



exports.getLatestForecast = async (req, res, next) => {

  try {

    const { zoneId } = req.params;

    const forecast = await aiService.getLatestForecast(zoneId);

    res.json({ success: true, data: { forecast: forecast ?? null } });

  } catch (err) {

    next(err);

  }

};



exports.runForecast = async (req, res, next) => {

  try {

    const { zoneId } = req.params;

    const doc = await aiService.runForecastForZone(zoneId);

    res.json({ success: true, data: { forecast: doc } });

  } catch (err) {

    res.status(400).json({ success: false, message: err.message });

  }

};



exports.runAllForecasts = async (req, res, next) => {

  try {

    const result = await aiService.runForecastsForAllZones();

    res.json({ success: true, data: result });

  } catch (err) {

    next(err);

  }

};



exports.getAnomalyHistory = async (req, res, next) => {

  try {

    const { zoneId } = req.params;

    const limit = parseInt(req.query.limit || "20", 10);

    const history = await aiService.getAnomalyHistory(zoneId, limit);

    res.json({ success: true, data: { history } });

  } catch (err) {

    next(err);

  }

};



exports.runAnomalyDetection = async (req, res, next) => {

  try {

    const { zoneId } = req.params;

    const doc = await aiService.runAnomalyDetectionForZone(zoneId);

    res.json({ success: true, data: { detection: doc } });

  } catch (err) {

    res.status(400).json({ success: false, message: err.message });

  }

};



exports.runAllAnomalyDetection = async (req, res, next) => {

  try {

    const result = await aiService.runAnomalyDetectionForAllZones();

    res.json({ success: true, data: result });

  } catch (err) {

    next(err);

  }

};

exports.prepareRetrainDataset = async (req, res) => {
  try {
    const { periodStart, periodEnd, siteId = null, zoneId = null } = req.body;
    const createdBy = req.user?.userId || null;
    const { snapshot, manifest } = await iaRetrainService.prepareDataset({
      periodStart,
      periodEnd,
      siteId,
      zoneId,
      createdBy,
    });
    res.json({ success: true, data: { dataset: snapshot, manifest } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getLatestRetrainDataset = async (req, res, next) => {
  try {
    const dataset = await iaRetrainService.getLatestDataset({
      siteId: req.query.siteId || undefined,
      zoneId: req.query.zoneId || undefined,
    });
    res.json({ success: true, data: { dataset: dataset ?? null } });
  } catch (err) {
    next(err);
  }
};

exports.startRetrain = async (req, res) => {
  try {
    const job = await iaRetrainService.startRetrain({
      datasetId: req.body?.datasetId || null,
      createdBy: req.user?.userId || null,
    });
    res.status(202).json({ success: true, data: { job } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getLatestRetrainJob = async (req, res, next) => {
  try {
    const job = await iaRetrainService.getLatestJob();
    res.json({ success: true, data: { job: job ?? null } });
  } catch (err) {
    next(err);
  }
};

exports.getRetrainJobById = async (req, res, next) => {
  try {
    const job = await iaRetrainService.getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job introuvable" });
    }
    res.json({ success: true, data: { job } });
  } catch (err) {
    next(err);
  }
};

