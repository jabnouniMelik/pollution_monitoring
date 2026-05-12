// ROUTES : AUTH
// Base URL : /api/auth
//
// POST /api/auth/register  → créer un utilisateur
// POST /api/auth/login     → connexion
// POST /api/auth/refresh   → regénérer access token
// POST /api/auth/logout    → déconnexion
// GET  /api/auth/me        → profil utilisateur connecté
//
// Seul /me est protégé par verifyToken
// Login et refresh sont publics par définition

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  register,
  login,
  refresh,
  logout,
  getMe,
} = require("../controllers/authController");

const verifyToken = require("../middleware/verifyToken");

// ── Rate Limiting anti brute-force ────────────────────────────
// En production: strict (10 tentatives / 15 min).
// En dev/test: plus permissif pour éviter les faux positifs pendant les suites.
const isProd = process.env.NODE_ENV === "production";
const loginRateLimitMax =
  Number(process.env.LOGIN_RATE_LIMIT_MAX) || (isProd ? 10 : 200);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: loginRateLimitMax,
  message: {
    success: false,
    message: "Trop de tentatives de connexion — Réessayez dans 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes publiques (pas de token requis)
router.post("/register", register);
router.post("/login", loginLimiter, login); // rate limiter sur login
router.post("/refresh", refresh);
router.post("/logout", logout);

// Routes protégées (token requis)
router.get("/me", verifyToken, getMe);

module.exports = router;
