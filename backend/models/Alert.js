const mongoose = require("mongoose");
const Polluant = require("./Polluant");
const Sensor = require("./Sensor");
const Reading = require("./Reading");
const AlertSchema = new mongoose.Schema(
  {
    PolluantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Polluant",
      required: true,
    },
    SensorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sensor",
      required: true,
    },
    ReadingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reading",
      required: true,
    },
    severity: {
      type: String,
      enum: ["Warning", "High", "Critical"],
      required: true,
    },
    type: {
      type: String,
      enum: ["Threshold", "SensorFault", "Anomaly", "Forecast"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    isAcknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolutionNote: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);
//index pour les alertes non acquittées par gravité
AlertSchema.index({ isAcknowledged: 1, severity: 1 });
//index : historique chronologique des alertes
AlertSchema.index({ timestamp: -1 });
//index : alertes par polluant
AlertSchema.index({ PolluantId: 1, timestamp: -1 });

module.exports = mongoose.model("Alert", AlertSchema);
