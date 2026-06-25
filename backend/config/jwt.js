// CONFIGURATION JWT
// Centralise la génération et vérification des tokens
//
// Deux types de tokens :
// 1. Access Token  : 15 min, mémoire JS, Authorization header
// 2. Refresh Token : 7 jours, HttpOnly Cookie + MongoDB
//
// Sécurité : HttpOnly Cookie = inaccessible au JavaScript
// → Protection contre les attaques XSS

const jwt = require("jsonwebtoken");

const JWT_CONFIG = {
  access: {
    secret: process.env.JWT_ACCESS_SECRET,
    expires: process.env.JWT_ACCESS_EXPIRES || "15m",
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET,
    expires: process.env.JWT_REFRESH_EXPIRES || "7d",
  },
};

const requireSecret = (value, envName) => {
  if (!value) {
    const err = new Error(`Missing required env var: ${envName}`);
    err.statusCode = 500;
    throw err;
  }
  return value;
};

// ── Générer un Access Token ───────────────────────────────────
// Payload : données de l'utilisateur encodées dans le token
// Ces données sont lisibles par le frontend (pas le secret !)
const generateAccessToken = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    zone: user.zone || null, // utilisé pour filtrer par zone (OPERATOR)
  };

  return jwt.sign(
    payload,
    requireSecret(JWT_CONFIG.access.secret, "JWT_ACCESS_SECRET"),
    {
      expiresIn: JWT_CONFIG.access.expires,
    },
  );
};

// ── Générer un Refresh Token ──────────────────────────────────
// Payload minimal — juste l'ID pour retrouver l'utilisateur
const generateRefreshToken = (user) => {
  const payload = {
    userId: user._id,
  };

  return jwt.sign(
    payload,
    requireSecret(JWT_CONFIG.refresh.secret, "JWT_REFRESH_SECRET"),
    {
      expiresIn: JWT_CONFIG.refresh.expires,
    },
  );
};

// ── Vérifier un Access Token ──────────────────────────────────
// Retourne le payload décodé ou lève une erreur
const verifyAccessToken = (token) => {
  return jwt.verify(
    token,
    requireSecret(JWT_CONFIG.access.secret, "JWT_ACCESS_SECRET"),
  );
};

// ── Vérifier un Refresh Token ─────────────────────────────────
const verifyRefreshToken = (token) => {
  return jwt.verify(
    token,
    requireSecret(JWT_CONFIG.refresh.secret, "JWT_REFRESH_SECRET"),
  );
};

// ── Options du Cookie HttpOnly ────────────────────────────────
// Ces options sécurisent le cookie refresh token
const COOKIE_OPTIONS = {
  httpOnly: true, // inaccessible au JavaScript → protection XSS
  secure: process.env.NODE_ENV === "production", // HTTPS en production
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // lax pour développement (localhost cross-port)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours en millisecondes
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  COOKIE_OPTIONS,
};
