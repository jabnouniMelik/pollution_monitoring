const mongoose = require("mongoose");
const ReportSchema = new mongoose.Schema(
  {
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    overallScore: {
      type: Number, //IPE:score global/100
    },
    polluantScores: {
      type: Map,
      of: Number, //score par polluant/100
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
      //required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED"],
      default: "DRAFT",
    },
    fileUrl: {
      type: String, //URL du rapport généré (PDF)
    },
  },
  { timestamps: true },
);
//index: rapport par période
ReportSchema.index({ periodStart: -1, periodEnd: -1 });
//index:rapport par status
ReportSchema.index({ status: 1 });
module.exports = mongoose.model("Report", ReportSchema);
