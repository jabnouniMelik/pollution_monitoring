// MODEL : REFRESH TOKEN
// Stocke les refresh tokens en base de données
//
// Pourquoi stocker en DB ?
// → Permet la RÉVOCATION : logout invalide le token côté serveur
// → Même si le cookie est volé, le token ne fonctionnera plus
// → Historique des connexions actives
//
// TTL automatique : MongoDB supprime le document
// automatiquement quand expiresAt est dépassé

const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema(
  {
    // Référence à l'utilisateur propriétaire du token
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Le token lui-même (hashé pour plus de sécurité)
    token: {
      type: String,
      required: true,
      unique: true,
    },
    // Date d'expiration — MongoDB supprime auto après cette date
    expiresAt: {
      type: Date,
      required: true,
    },
    // Infos de la session pour audit
    userAgent: { type: String }, // navigateur/appareil
    ipAddress: { type: String }, // adresse IP de connexion
  },
  { timestamps: true },
);

// ── TTL Index : suppression automatique à expiration ─────────
// expires: 0 → supprimer exactement à la date expiresAt
RefreshTokenSchema.index({ expiresAt: 1 }, { expires: 0 });
// Index pour recherche rapide par userId
RefreshTokenSchema.index({ userId: 1 });

module.exports = mongoose.model("RefreshToken", RefreshTokenSchema);
