const mongoose = require("mongoose");
//const Industrie = require("./Industrie");

const SensorNodeSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
    },
    IndustrieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Industrie",
      required: true,
    },
    localisation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    zone: {
      type: String, //Zone-A , Zone-B , Zone-C
      required: true,
    },
    Status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Inactive",
    },
    IPAddress: {
      type: String,
    },
    macAddress: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true },
);
//index pour la géolocalisation
SensorNodeSchema.index({ localisation: "2dsphere" });
//index pour la recherche par industrie
SensorNodeSchema.index({ IndustrieId: 1 });

module.exports = mongoose.model("SensorNode", SensorNodeSchema);
