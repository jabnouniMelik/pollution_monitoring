const mongoose = require("mongoose");
const Polluant = require("./Polluant");
const ReadingSchema = new mongoose.Schema(
  {
    sensorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sensor",
      required: true,
    },
    PolluantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Polluant",
      required: true,
    },
    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SensorNode",
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    isValid: {
      type: Boolean,
      default: false,
    },
    rawValue: {
      type: Number, //valeur brute avant conversion
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);
//index temps reel:plus recent au plus ancien
ReadingSchema.index({ timestamp: -1 });
//index : filtrer par capteur+date
ReadingSchema.index({ sensorId: 1, timestamp: -1 });
//index : filtrer par polluant+date
ReadingSchema.index({ PolluantId: 1, timestamp: -1 });
//index : filtrer par nodeId+date
ReadingSchema.index({ nodeId: 1, timestamp: -1 });

module.exports = mongoose.model("Reading", ReadingSchema);
