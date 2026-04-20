/**
 * CONTROLLER : AUTH
 * Gère toutes les opérations HTTP pour l'authentification JWT
 * Logique métier déléguée à AuthService
 */

const authService = require("../services/AuthService");
const { COOKIE_OPTIONS } = require("../config/jwt");
const { error_messages, success_messages } = require("../utils/constants");

// ── POST /api/auth/register ──────────────────────────────
// Crée un nouvel utilisateur
// !! En production, cet endpoint doit être protégé
// Seul le SUPER_ADMIN peut créer des utilisateurs
const register = async (req, res, next) => {
  try {
    const { username, email, password, role, zone, site } = req.body;

    const user = await authService.register({
      username,
      email,
      password,
      role,
      zone,
      site,
    });

    res.status(201).json({
      success: true,
      message: `Utilisateur créé — Rôle : ${user.role}`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/login ─────────────────────────────────
// Connexion utilisateur
// Génère access token (mémoire) + refresh token (cookie + DB)
const login = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { email, password } = req.body;

    const { user, accessToken, refreshToken } = await authService.login(
      email,
      password,
    );

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

    const ms = Date.now() - t0;
    // Warn (don't spam) when login is unusually slow — typically >1s means the
    // event loop was busy (bcrypt contention + MQTT ingestion).
    if (ms > 1000) {
      console.warn(`[AUTH] login OK for ${email} in ${ms}ms (slow)`);
    } else {
      console.log(`[AUTH] login OK for ${email} in ${ms}ms`);
    }

    res.status(200).json({
      success: true,
      message: `Connexion réussie — Bienvenue ${user.username}`,
      data: {
        accessToken,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          zone: user.zone,
          site: user.site,
        },
      },
    });
  } catch (error) {
    const ms = Date.now() - t0;
    console.warn(`[AUTH] login FAILED after ${ms}ms — ${error.message}`);
    next(error);
  }
};

// ── POST /api/auth/refresh ──────────────────────────────
// Regénère un nouvel access token via le refresh token
// Le refresh token vient automatiquement du cookie HttpOnly
const refresh = async (req, res, next) => {
  try {
    // Lire le refresh token depuis le cookie
    const refreshToken = req.cookies?.refreshToken;

    const { accessToken } = await authService.refresh(refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/logout ────────────────────────────────
// Déconnexion — invalide le refresh token en DB
// et supprime le cookie
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    await authService.logout(refreshToken);

    // Supprimer le cookie côté client
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Déconnexion réussie",
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────
// Retourne le profil de l'utilisateur connecté
// req.user est défini par le middleware verifyToken
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user.userId);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
};
