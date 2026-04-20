const mongoose = require("mongoose");

const PolluantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    formula: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    regulatoryLimit: {
      type: Number,
      default: null,
    },
    warningThreshold: {
      type: Number,
      default: null,
    },
    description: {
      type: String,
    },
    conversionFactor: {
      type: Number,
      default: 1, //Facteur de conversion pour les capteurs qui mesurent dans une unité différente de l'unité réglementaire
    },
    weight: {
      type: Number,
      default: 0.1, // Poids pour calcul IPE (0-1), défaut 10%
      min: 0,
      max: 1,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Polluant", PolluantSchema);
