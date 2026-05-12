// MODEL : USER
// Représente tous les utilisateurs du système
//
// 5 rôles selon le diagramme Use Case :
// SUPER_ADMIN      → accès total + configuration seuils
// HEAD_SUPERVISOR  → gestion sites, nœuds, rôles globaux
// SITE_SUPERVISOR  → gestion opérateurs de son site
// OPERATOR         → consultation données de sa zone
// AUDITOR          → génération et export rapports
//
// Sécurité :
// - Mot de passe hashé automatiquement avec bcrypt (salt=12)
// - Méthode comparePassword pour vérification login

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Cost factor for bcryptjs. `bcryptjs` is a pure-JS implementation, so each
// bump is ~2x slower. Cost 10 is the bcryptjs default and runs in ~200-500ms;
// cost 12 runs ~1-3s and blocks the event loop under contention, stretching
// login latency to tens of seconds while MQTT ingestion is active.
// Override with BCRYPT_COST env var if you need different security/perf trade.
const BCRYPT_COST = Number(process.env.BCRYPT_COST) || 10;

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "HEAD_SUPERVISOR",
        "SITE_SUPERVISOR",
        "OPERATOR",
        "AUDITOR",
      ],
      required: true,
    },
    // Industrie assignée (pour HEAD_SUPERVISOR, SITE_SUPERVISOR, OPERATOR)
    industryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Industrie",
      default: null,
    },
    // Sites assignés (pour HEAD_SUPERVISOR et SITE_SUPERVISOR)
    // Peut gérer ou surveiller plusieurs sites
    sitesManaging: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
      },
    ],
    // Zones assignées (pour OPERATOR)
    // Un opérateur peut être assigné à plusieurs zones
    zonesAssigned: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Zone",
      },
    ],
    // Champ legacy - pour rétrocompatibilité si nécessaire
    zone: {
      type: String,
      default: null,
    },
    site: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ── Hook : Hashage automatique du mot de passe ────────────────
// Exécuté automatiquement AVANT chaque save()
// Ne hashe que si le mot de passe a été modifié
// (évite de re-hasher à chaque mise à jour du profil)
UserSchema.pre("save", async function () {
  // Si le mot de passe n'a pas changé → on passe
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
});

// ── Méthode : Comparer le mot de passe ───────────────────────
// Utilisée dans authController pour vérifier le login
// Compare le mot de passe en clair avec le hash stocké
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ── Index pour les recherches fréquentes ─────────────────────
// Note: email a déjà un index unique via le schéma { unique: true }
// donc on ne le redéfinit pas ici pour éviter le warning Mongoose

UserSchema.index({ role: 1 });
UserSchema.index({ industryId: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ role: 1, industryId: 1 }); // Pour filtrer users par role + industrie

module.exports = mongoose.model("User", UserSchema);
