const mongoose = require("mongoose");

const IARetrainJobSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["queued", "running", "success", "failed", "rolled_back"],
      default: "queued",
    },
    progressPct: { type: Number, default: 0, min: 0, max: 100 },
    stage: {
      type: String,
      default: "queued",
    },
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IADatasetSnapshot",
      required: true,
    },
    paths: {
      logFile: { type: String, default: null },
      backupDir: { type: String, default: null },
    },
    process: {
      pid: { type: Number, default: null },
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
      exitCode: { type: Number, default: null },
    },
    metrics: {
      previousGlobalSkill: { type: Number, default: null },
      newGlobalSkill: { type: Number, default: null },
      skillDelta: { type: Number, default: null },
      deploySuggested: { type: Boolean, default: false },
      rollbackApplied: { type: Boolean, default: false },
    },
    logsTail: [{ type: String }],
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

IARetrainJobSchema.index({ createdAt: -1 });
IARetrainJobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("IARetrainJob", IARetrainJobSchema);
