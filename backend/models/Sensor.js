const mongoose = require("mongoose");
const SensorSchema = new mongoose.Schema(
  {
    sensorNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SensorNode",
      required: true,
    },
    PolluantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Polluant",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "CO2",
        "SO2",
        "NOX",
        "PM25",
        "PM10",
        "COV",
        "TEMPERATURE",
        "HUMIDITY",
      ],
      required: true,
    },
    model: {
      type: String,
      required: true, //ex: "MH-Z19B", "ME4-SO2", "ME4-NO2", "SDS011", "SGP30", "DHT22"
    },
    unit: {
      type: String,
      required: true, //ex: "ppm", "µg/m³"
    },
    calibrationDate: {
      type: Date,
    },
    driftThreshold: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

//index pour la recherche par sensorNodeId
SensorSchema.index({ sensorNodeId: 1 });
//index pour la recherche par PolluantId
SensorSchema.index({ PolluantId: 1 });
module.exports = mongoose.model("Sensor", SensorSchema);
