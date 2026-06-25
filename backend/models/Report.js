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
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
    },
    industryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Industrie",
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
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
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
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

ReportSchema.index({ periodStart: -1, periodEnd: -1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ industryId: 1, status: 1 });
ReportSchema.index({ zoneId: 1, periodStart: -1 });
ReportSchema.index({ siteId: 1, periodStart: -1 });
module.exports = mongoose.model("Report", ReportSchema);
