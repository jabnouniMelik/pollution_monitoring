const mongoose = require("mongoose");

const IADatasetSnapshotSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["ready", "invalid"],
      default: "ready",
    },
    scope: {
      siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site", default: null },
      zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", default: null },
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    rowCount: { type: Number, required: true, min: 0 },
    featureColumns: [{ type: String, required: true }],
    missingRatio: { type: Number, required: true, min: 0 },
    paths: {
      datasetCsv: { type: String, required: true },
      manifestJson: { type: String, required: true },
    },
    quality: {
      minRows: { type: Number, required: true },
      maxMissingRatio: { type: Number, required: true },
      validForTraining: { type: Boolean, default: true },
      reasons: [{ type: String }],
    },
  },
  { timestamps: true },
);

IADatasetSnapshotSchema.index({ createdAt: -1 });
IADatasetSnapshotSchema.index({ "scope.siteId": 1, "scope.zoneId": 1, createdAt: -1 });

module.exports = mongoose.model("IADatasetSnapshot", IADatasetSnapshotSchema);
