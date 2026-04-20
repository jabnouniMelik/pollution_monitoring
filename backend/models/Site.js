/**
 * MODEL : SITE
 * Représente un site/établissement au sein d'une industrie
 * Chaque site peut contenir plusieurs zones avec des capteurs
 * 
 * Structure:
 * Industrie
 *   └── Site(s)
 *       └── Zone(s)
 *           └── SensorNode(s)
 */

const mongoose = require("mongoose");

const SiteSchema = new mongoose.Schema(
  {
    // Nom du site (ex: "Cimenterie Sfax - Principale", "Usine Tunis - Annexe")
    nom: {
      type: String,
      required: true,
      trim: true,
    },

    // Industrie à laquelle appartient ce site
    industrieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Industrie",
      required: true,
    },

    // Responsable du site (HEAD_SUPERVISOR ou SITE_SUPERVISOR)
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Localisation géographique du site
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
      ville: String,
      adresse: String,
    },

    // Contact du site
    contact: {
      telephone: String,
      email: String,
      responsable: String,
    },

    // Statut du site
    actif: {
      type: Boolean,
      default: true,
    },

    // Nombre de zones (dénormalisé pour rapidité)
    zoneCount: {
      type: Number,
      default: 0,
    },

    // Métadonnées
    description: String,
  },
  { timestamps: true },
);

// Index géospatial pour recherches par position
SiteSchema.index({ localisation: "2dsphere" });

// Index pour recherches par industrie
SiteSchema.index({ industrieId: 1 });

// Index pour recherches par supervisor
SiteSchema.index({ supervisorId: 1 });

// Index pour statut actif
SiteSchema.index({ actif: 1 });

// Index combiné pour filtrer par industrie et statut
SiteSchema.index({ industrieId: 1, actif: 1 });

module.exports = mongoose.model("Site", SiteSchema);
