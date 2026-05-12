/**
 * SERVICE : AUTH
 * Logique métier pour l'authentification JWT
 * Inscription, connexion, refresh, logout
 */

const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/UserRepository");
const refreshTokenRepository = require("../repositories/RefreshTokenRepository");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../config/jwt");

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
      const err = new Error("username, email, password et role sont requis");
      err.statusCode = 400;
      throw err;
    }

    // Valider rôle
    if (!VALID_ROLES.includes(role)) {
      const err = new Error(
        `Rôle invalide. Valeurs acceptées : ${VALID_ROLES.join(", ")}`,
      );
      err.statusCode = 400;
      throw err;
    }

    // Vérifier unicité email et username
    const existingByEmail = await userRepository.findByEmail(email);
    if (existingByEmail) {
      const err = new Error("Email déjà utilisé");
      err.statusCode = 400;
      throw err;
    }

    const existingByUsername = await userRepository.findByUsername(username);
    if (existingByUsername) {
      const err = new Error("Username déjà utilisé");
      err.statusCode = 400;
      throw err;
    }

    // Créer l'utilisateur
    // Le hook pre('save') du model User hash automatiquement le password
    const user = await userRepository.create({
      username,
      email,
      password,  // passé en clair — le model le hash via pre('save')
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
      const err = new Error("Email et mot de passe requis");
      err.statusCode = 400;
      throw err;
    }

    // Récupérer utilisateur avec password (nécessaire pour comparaison)
    const user = await userRepository.findByEmail(email);
    if (!user) {
      const err = new Error("Email ou mot de passe incorrect");
      err.statusCode = 401;
      throw err;
    }

    // Comparer mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      const err = new Error("Email ou mot de passe incorrect");
      err.statusCode = 401;
      throw err;
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

    // Populate zones and industry for operators and supervisors
    const populatePaths = [
      { path: 'industryId', select: 'nom secteur' },
      { path: 'sitesManaging', select: 'nom industrieId' }
    ];

    // OPERATOR: populate their assigned zones
    if (user.role === 'OPERATOR') {
      populatePaths.push({ path: 'zonesAssigned', select: 'code nom siteId industrieId' });
    }

    await user.populate(populatePaths);

    // SITE_SUPERVISOR / HEAD_SUPERVISOR: fetch all zones from their sites
    let supervisorZones = [];
    if (
      (user.role === 'SITE_SUPERVISOR' || user.role === 'HEAD_SUPERVISOR') &&
      user.sitesManaging?.length > 0
    ) {
      const Zone = require('../models/Zone');
      const siteIds = user.sitesManaging.map((s) => s._id || s);
      supervisorZones = await Zone.find({ siteId: { $in: siteIds }, actif: true })
        .select('code nom siteId industrieId')
        .lean();
    }

    // Retourner user sans password
    const userObj = user.toObject();
    delete userObj.password;
    if (supervisorZones.length > 0) {
      userObj.zonesAssigned = supervisorZones;
    }

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

    // Vérification cryptographique (signature/expiration JWT).
    try {
      verifyRefreshToken(refreshToken);
    } catch {
      const err = new Error("Refresh token invalide");
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
    try {
      const newAccessToken = generateAccessToken({
        _id: user._id,
        role: user.role,
      });
      return { accessToken: newAccessToken };
    } catch (e) {
      const err = new Error("Configuration JWT invalide (access token)");
      err.statusCode = 500;
      err.cause = e;
      throw err;
    }
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
   * Populate zones et industrie pour les opérateurs
   * @param {String} userId - ID utilisateur
   * @returns {Promise<Object>} Profil utilisateur
   */
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error("Utilisateur non trouvé");
      err.statusCode = 404;
      throw err;
    }

    const populatePaths = [
      { path: 'industryId', select: 'nom secteur' },
      { path: 'sitesManaging', select: 'nom industrieId' }
    ];

    if (user.role === 'OPERATOR') {
      populatePaths.push({ path: 'zonesAssigned', select: 'code nom siteId industrieId' });
    }

    await user.populate(populatePaths);

    // SITE_SUPERVISOR / HEAD_SUPERVISOR: fetch zones from their sites
    if (
      (user.role === 'SITE_SUPERVISOR' || user.role === 'HEAD_SUPERVISOR') &&
      user.sitesManaging?.length > 0
    ) {
      const Zone = require('../models/Zone');
      const siteIds = user.sitesManaging.map((s) => s._id || s);
      const zones = await Zone.find({ siteId: { $in: siteIds }, actif: true })
        .select('code nom siteId industrieId')
        .lean();
      const userObj = user.toObject();
      userObj.zonesAssigned = zones;
      return userObj;
    }

    return user;
  }
}

module.exports = new AuthService();
