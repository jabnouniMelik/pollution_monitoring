/**
 * SERVICE : AUTH
 * Logique métier pour l'authentification JWT
 * Inscription, connexion, refresh, logout
 */

const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/UserRepository");
const refreshTokenRepository = require("../repositories/RefreshTokenRepository");
const { generateAccessToken, generateRefreshToken } = require("../config/jwt");

// See models/User.js — bcryptjs is pure JS, so cost 10 is the sane default.
const BCRYPT_COST = Number(process.env.BCRYPT_COST) || 10;

const VALID_ROLES = [
  "SUPER_ADMIN",
  "HEAD_SUPERVISOR",
  "SITE_SUPERVISOR",
  "OPERATOR",
  "AUDITOR",
];

class AuthService {
  /**
   * Enregistre un nouvel utilisateur
   * @param {Object} data - { username, email, password, role, zone, site }
   * @returns {Promise<Object>} Utilisateur créé
   */
  async register(data) {
    const { username, email, password, role, zone, site } = data;

    // Valider champs requis
    if (!username || !email || !password || !role) {
      throw new Error("username, email, password et role sont requis");
    }

    // Valider rôle
    if (!VALID_ROLES.includes(role)) {
      throw new Error(
        `Rôle invalide. Valeurs acceptées : ${VALID_ROLES.join(", ")}`,
      );
    }

    // Vérifier unicité email et username
    const existingByEmail = await userRepository.findByEmail(email);
    if (existingByEmail) {
      throw new Error("Email déjà utilisé");
    }

    const existingByUsername = await userRepository.findByUsername(username);
    if (existingByUsername) {
      throw new Error("Username déjà utilisé");
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    // Créer l'utilisateur
    const user = await userRepository.create({
      username,
      email,
      password: hashedPassword,
      role,
      zone: zone || null,
      site: site || null,
    });

    // Retourner utilisateur sans password
    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }

  /**
   * Connexion utilisateur
   * Retourne access token + refresh token
   * @param {String} email - Email utilisateur
   * @param {String} password - Mot de passe
   * @returns {Promise<Object>} { user, accessToken, refreshToken }
   */
  async login(email, password) {
    // Vérifier email
    if (!email || !password) {
      throw new Error("Email et mot de passe requis");
    }

    // Récupérer utilisateur avec password (nécessaire pour comparaison)
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error("Email ou mot de passe incorrect");
    }

    // Comparer mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error("Email ou mot de passe incorrect");
    }

    // Générer tokens
    const accessToken = generateAccessToken({
      _id: user._id,
      role: user.role,
    });
    const refreshTokenValue = generateRefreshToken({
      _id: user._id,
      role: user.role,
    });

    // Sauvegarder refresh token en DB
    await refreshTokenRepository.create({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
    });

    // Retourner user sans password
    const userObj = user.toObject();
    delete userObj.password;

    return {
      user: userObj,
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  /**
   * Rafraîchit l'access token
   * @param {String} refreshToken - Refresh token valide
   * @returns {Promise<Object>} { accessToken, refreshToken }
   */
  async refresh(refreshToken) {
    if (!refreshToken) {
      const err = new Error("Refresh token requis");
      err.statusCode = 401;
      throw err;
    }

    // Vérifier que le token existe en BD
    const tokenDoc = await refreshTokenRepository.findByToken(refreshToken);
    if (!tokenDoc) {
      const err = new Error("Refresh token invalide");
      err.statusCode = 401;
      throw err;
    }

    // Vérifier expiration
    if (tokenDoc.expiresAt < new Date()) {
      const err = new Error("Refresh token expiré");
      err.statusCode = 401;
      throw err;
    }

    // Récupérer l'utilisateur
    const user = await userRepository.findById(tokenDoc.userId);
    if (!user) {
      const err = new Error("Utilisateur introuvable");
      err.statusCode = 401;
      throw err;
    }

    // Générer nouvel access token
    const newAccessToken = generateAccessToken({
      _id: user._id,
      role: user.role,
    });

    return { accessToken: newAccessToken };
  }

  /**
   * Déconnecte l'utilisateur
   * Supprime le refresh token
   * @param {String} refreshToken - Token à invalider
   * @returns {Promise<void>}
   */
  async logout(refreshToken) {
    if (!refreshToken) {
      const err = new Error("Refresh token requis");
      err.statusCode = 401;
      throw err;
    }

    const tokenDoc = await refreshTokenRepository.findByToken(refreshToken);
    if (tokenDoc) {
      await refreshTokenRepository.delete(tokenDoc._id);
    }
  }

  /**
   * Récupère le profil de l'utilisateur connecté
   * @param {String} userId - ID utilisateur
   * @returns {Promise<Object>} Profil utilisateur
   */
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }
    return user;
  }
}

module.exports = new AuthService();
