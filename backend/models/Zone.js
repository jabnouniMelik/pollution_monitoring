/**
 * MODEL : ZONE
 * Représente une zone de surveillance au sein d'un site
 * Chaque zone peut contenir plusieurs nœuds de capteurs
 * 
 * Structure:
 * Site
 *   └── Zone(s) (ex: "Zone A - Fours", "Zone B - Concassage", etc.)
 *       └── SensorNode(s)
 */

const mongoose = require("mongoose");

const ZoneSchema = new mongoose.Schema(
  {
    // Identifiant de la zone (ex: "Zone-A", "Zone-Fours")
    code: {
      type: String,
      required: true,
      trim: true,
    },

    // Nom descriptif
    nom: {
      type: String,
      required: true,
      trim: true,
    },

    // Site auquel appartient cette zone
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },

    // Industrie (dénormalisé pour performances)
    industrieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Industrie",
      required: true,
    },

    // Description du type de zone (ex: "Fours de calcination", "Unité de concassage")
    description: String,

    // Localisation géographique
    localisation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    // Opérateurs assignés à cette zone
    operatorsAssigned: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Polluants surveillés dans cette zone
    pollutants: {
      type: [String],
      default: [],
      enum: ["CO2", "NOX", "SO2", "PM", "PM25", "PM10", "COV"],
    },

    // Statut de la zone
    actif: {
      type: Boolean,
      default: false,  // inactive until approved
    },

    // ── Approval workflow ─────────────────────────────────────
    approvalStatus: {
      type: String,
      enum: ["PENDING", "PREPARING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    approvalRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvalRequestedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },

    // Nombre de nœuds capteurs (dénormalisé)
    sensorNodeCount: {
      type: Number,
      default: 0,
    },

    // Note d'installation du nœud capteur (renseignée par SUPER_ADMIN lors de la préparation)
    sensorNodeNote: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Index géospatial
ZoneSchema.index({ localisation: "2dsphere" });

// Index pour recherches par site
ZoneSchema.index({ siteId: 1 });

// Index pour recherches par industrie
ZoneSchema.index({ industrieId: 1 });

// Index pour recherches par statut
ZoneSchema.index({ actif: 1 });

// Index combiné pour filtrer par site et statut
ZoneSchema.index({ siteId: 1, actif: 1 });

// Index pour recherche par code
ZoneSchema.index({ code: 1, siteId: 1 });

// Index pour le workflow d'approbation
ZoneSchema.index({ approvalStatus: 1 });
ZoneSchema.index({ approvalStatus: 1, industrieId: 1 });

module.exports = mongoose.model("Zone", ZoneSchema);
