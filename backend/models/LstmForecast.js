const mongoose = require("mongoose");

const ForecastPollutantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    valuePhysical: { type: Number, required: true },
    valueNormalized: { type: Number, required: true },
    predictionSource: {
      type: String,
      enum: ["LSTM", "PERSISTENCE", "blend"],
      required: true,
    },
    skillAtTrain: { type: Number, default: 0 },
    unit: { type: String, default: null },
    regulatoryLimit: { type: Number, default: null },
    exceedsRegulatory: { type: Boolean, default: false },
    severity: {
      type: String,
      enum: ["Warning", "High", "Critical", null],
      default: null,
    },
  },
  { _id: false },
);

const ForecastStepSchema = new mongoose.Schema(
  {
    stepHours: { type: Number, required: true },
    stepLabel: { type: String, required: true },
    targetTime: { type: Date, required: true },
    pollutants: [ForecastPollutantSchema],
  },
  { _id: false },
);

const LstmForecastSchema = new mongoose.Schema(
  {
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
      index: true,
    },
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },
    runAt: { type: Date, default: Date.now, index: true },
    anchorPeriodStart: { type: Date, required: true },
    goDeploy: { type: Boolean, default: false },
    alertSource: { type: String, default: "LSTM_4H" },
    horizonHours: { type: Number, default: 4 },
    lookbackHours: { type: Number, default: 48 },
    steps: [ForecastStepSchema],
    iaHealth: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

LstmForecastSchema.index({ zoneId: 1, runAt: -1 });
LstmForecastSchema.index({ siteId: 1, runAt: -1 });

module.exports = mongoose.model("LstmForecast", LstmForecastSchema);
