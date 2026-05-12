const mongoose = require("mongoose");
const ReportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Rapport Environnemental",
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    // Zone for which this report was generated
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    // Site for which this report was generated
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
    },
    overallScore: {
      type: Number,
    },
    polluantScores: {
      type: Map,
      of: Number,
    },
    breachCount: {
      type: Number,
      default: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED"],
      default: "DRAFT",
    },
    format: {
      type: String,
      enum: ["pdf", "csv", "xlsx"],
      default: "pdf",
    },
    fileUrl: {
      type: String,
    },
  },
  { timestamps: true },
);

ReportSchema.index({ periodStart: -1, periodEnd: -1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ zoneId: 1, periodStart: -1 });
ReportSchema.index({ siteId: 1, periodStart: -1 });
module.exports = mongoose.model("Report", ReportSchema);
