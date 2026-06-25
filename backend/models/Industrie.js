const mongoose = require("mongoose");

/**
 * MODEL : INDUSTRIE
 * Représente une entreprise industrielle utilisant le système.
 *
 * Deux modes de création :
 *  1. SUPER_ADMIN crée directement → approvalStatus: APPROVED, actif: true
 *  2. Inscription publique (page login) → approvalStatus: PENDING, actif: false
 *     Le SUPER_ADMIN traite la demande via le workflow d'approbation.
 */

// Schéma d'un site demandé lors de l'inscription
const RequestedSiteSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    localisation: {
      ville: { type: String, default: null },
      adresse: { type: String, default: null },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    // Zones demandées pour ce site
    zones: [
      {
        nom: { type: String, required: true, trim: true },
        description: { type: String, default: null },
        pollutants: {
          type: [String],
          default: [],
          enum: ["CO2", "NOX", "SO2", "PM", "PM25", "PM10", "COV"],
        },
      },
    ],
  },
  { _id: false },
);

const IndustrieSchema = new mongoose.Schema(
  {
    // ── Informations de base ───────────────────────────────────
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    secteur: {
      type: String,
      required: true,
      enum: [
        "Ciment",
        "Chimie",
        "Raffinerie",
        "Sidérurgie",
        "Papier / Cellulose",
        "Agroalimentaire",
        "Textile",
        "Céramique / Verre",
        "Énergie / Centrale électrique",
        "Mines / Extraction",
        "Traitement des déchets",
        "Autre",
      ],
    },
    localisation: {
      ville: { type: String, default: null },
      gouvernorat: { type: String, default: null },
      adresse: { type: String, default: null },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    contact: {
      telephone: { type: String, default: null },
      email: { type: String, default: null },
      responsable: { type: String, default: null },
    },
    // Matricule fiscal (Tunisie)
    matriculeFiscal: {
      type: String,
      default: null,
      trim: true,
    },
    // Numéro d'autorisation environnementale (ANPE)
    autorisationAnpe: {
      type: String,
      default: null,
      trim: true,
    },
    actif: {
      type: Boolean,
      default: false, // inactive until approved
    },

    // ── Inscription publique ───────────────────────────────────
    // Email du superviseur principal (HEAD_SUPERVISOR) — compte créé à l'approbation
    superviseurEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    superviseurNom: {
      type: String,
      default: null,
      trim: true,
    },
    // Sites et zones demandés lors de l'inscription
    requestedSites: {
      type: [RequestedSiteSchema],
      default: [],
    },
    // Message libre du demandeur
    messageInscription: {
      type: String,
      default: null,
    },

    // ── Workflow d'approbation ─────────────────────────────────
    approvalStatus: {
      type: String,
      enum: ["PENDING", "PREPARING", "APPROVED", "REJECTED"],
      default: "APPROVED", // SUPER_ADMIN creates → approved immediately
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
    // Note interne SUPER_ADMIN (ex: "Visite terrain prévue le 20/06")
    adminNote: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Index pour recherches par statut
IndustrieSchema.index({ approvalStatus: 1 });
IndustrieSchema.index({ actif: 1 });
IndustrieSchema.index({ secteur: 1 });

module.exports = mongoose.model("Industrie", IndustrieSchema);
