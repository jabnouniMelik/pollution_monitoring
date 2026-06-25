const mongoose = require("mongoose");

/**
 * MODEL : SENSOR_NODE
 * Représente un nœud ESP32 physique portant plusieurs capteurs.
 *
 * Hiérarchie : Industrie → Site → Zone → SensorNode → Sensor → Reading
 */
const SensorNodeSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
    },
    // ── Références hiérarchiques ───────────────────────────────
    IndustrieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Industrie",
      required: true,
    },
    // Zone physique où est installé le nœud (ObjectId → Zone)
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
    },
    // Site parent (dénormalisé pour éviter un join Zone→Site à chaque requête KPI)
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    // ── Localisation ───────────────────────────────────────────
    localisation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    // ── État ───────────────────────────────────────────────────
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

// Index géospatial
SensorNodeSchema.index({ localisation: "2dsphere" });
// Index pour la recherche par industrie
SensorNodeSchema.index({ IndustrieId: 1 });
// Index pour la recherche par zone (utilisé par les calculs KPI)
SensorNodeSchema.index({ zoneId: 1 });
// Index pour la recherche par site (utilisé par les calculs KPI)
SensorNodeSchema.index({ siteId: 1 });
// Index combiné zone + statut (filtrage des nœuds actifs d'une zone)
SensorNodeSchema.index({ zoneId: 1, Status: 1 });

module.exports = mongoose.model("SensorNode", SensorNodeSchema);
