const mongoose = require("mongoose");

const IndustrieSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
    },
    secteur: {
      type: String,
      required: true, // ex: "Ciment", "Chimie", "Raffinerie"
    },
    localisation: {
      ville: { type: String },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    contact: {
      type: String,
    },
    actif: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Industrie", IndustrieSchema);
