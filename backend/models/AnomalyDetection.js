const mongoose = require("mongoose");

const AnomalyDetectionSchema = new mongoose.Schema(
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
    periodStart: { type: Date, required: true, index: true },
    runAt: { type: Date, default: Date.now },
    isAnomaly: { type: Boolean, required: true },
    anomalyScore: { type: Number, required: true },
    prediction: { type: Number, required: true },
    scoreThreshold: { type: Number, required: true },
    severity: {
      type: String,
      enum: ["Warning", "High", "Critical", null],
      default: null,
    },
    featureCols: [{ type: String }],
    featureValues: [{ type: Number }],
    alertSource: { type: String, default: "ISOLATION_FOREST" },
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alert",
      default: null,
    },
  },
  { timestamps: true },
);

AnomalyDetectionSchema.index({ zoneId: 1, periodStart: -1 });
AnomalyDetectionSchema.index({ siteId: 1, periodStart: -1 });

module.exports = mongoose.model("AnomalyDetection", AnomalyDetectionSchema);
