/**
 * SERVICE : USER MANAGEMENT
 * Logique métier pour la gestion des utilisateurs avec RBAC
 * Create, Read, Update, Delete avec contrôles d'accès
 */

const userRepository = require("../repositories/UserRepository");
const bcrypt = require("bcryptjs");

const BCRYPT_COST = Number(process.env.BCRYPT_COST) || 10;

const VALID_ROLES = [
  "SUPER_ADMIN",
  "HEAD_SUPERVISOR",
  "SITE_SUPERVISOR",
  "OPERATOR",
  "AUDITOR",
];

class UserManagementService {
  /**
   * Crée un nouvel utilisateur (SUPER_ADMIN only)
   * @param {Object} data - { username, email, password, role, industryId, ... }
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur créé
   */
  async createUser(data, requester) {
    // Vérifier permissions
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut créer des utilisateurs");
    }

    const { username, email, password, role, industryId, sitesManaging, zonesAssigned } = data;

    // Valider champs requis
    if (!username || !email || !password || !role) {
      throw new Error("username, email, password et role requis");
    }

    // Valider rôle
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Rôle invalide: ${VALID_ROLES.join(", ")}`);
    }

    // Vérifier unicité
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
      industryId: industryId || null,
      sitesManaging: sitesManaging || [],
      zonesAssigned: zonesAssigned || [],
      isActive: true,
    });

    return this._sanitizeUser(user);
  }

  /**
   * Récupère tous les utilisateurs avec filtres optionnels
   * @param {Object} requester - Utilisateur qui fait la requête
   * @param {Object} filters - { role, industryId, isActive }
   * @returns {Promise<Array>} Utilisateurs
   */
  async getUsers(requester, filters = {}) {
    // Chaque rôle ne peut voir que ce qu'il est autorisé
    let query = {};

    if (requester.role === "SUPER_ADMIN") {
      // Voir tous les utilisateurs
      query = filters;
    } else if (requester.role === "HEAD_SUPERVISOR") {
      // Voir uniquement les utilisateurs de son industrie
      query = { ...filters, industryId: requester.industryId };
    } else if (requester.role === "SITE_SUPERVISOR") {
      // Voir uniquement les utilisateurs de son site
      query = { ...filters, sitesManaging: requester.sitesManaging };
    } else {
      // OPERATOR et AUDITOR : accès limité
      throw new Error("Accès refusé");
    }

    const users = await userRepository.findAll(query);
    return users.map(u => this._sanitizeUser(u));
  }

  /**
   * Récupère un utilisateur par ID
   * @param {String} userId - ID utilisateur
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur
   */
  async getUserById(userId, requester) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    // Vérifier autorisation (SUPER_ADMIN voit tous, HEAD_SUPERVISOR voit son industrie)
    if (requester.role === "SUPER_ADMIN") {
      return this._sanitizeUser(user);
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (user.industryId.toString() !== requester.industryId.toString()) {
        throw new Error("Accès refusé");
      }
      return this._sanitizeUser(user);
    }

    throw new Error("Accès refusé");
  }

  /**
   * Met à jour un utilisateur
   * @param {String} userId - ID utilisateur
   * @param {Object} updateData - Données à mettre à jour
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur mis à jour
   */
  async updateUser(userId, updateData, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut modifier les utilisateurs");
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    // Éviter de modifier certains champs sensibles via l'API
    const allowedFields = ["username", "email", "role", "industryId", "sitesManaging", "zonesAssigned", "isActive"];
    const filteredData = {};

    for (const field of allowedFields) {
      if (field in updateData) {
        filteredData[field] = updateData[field];
      }
    }

    // Valider rôle s'il est modifié
    if (filteredData.role && !VALID_ROLES.includes(filteredData.role)) {
      throw new Error(`Rôle invalide: ${VALID_ROLES.join(", ")}`);
    }

    const updatedUser = await userRepository.update(userId, filteredData);
    return this._sanitizeUser(updatedUser);
  }

  /**
   * Supprime un utilisateur
   * @param {String} userId - ID utilisateur
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur supprimé
   */
  async deleteUser(userId, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut supprimer des utilisateurs");
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    // Éviter de supprimer le dernier SUPER_ADMIN
    if (user.role === "SUPER_ADMIN") {
      const adminCount = await userRepository.countByRole("SUPER_ADMIN");
      if (adminCount <= 1) {
        throw new Error("Impossible de supprimer le dernier SUPER_ADMIN");
      }
    }

    return await userRepository.delete(userId);
  }

  /**
   * Assigne des sites à un HEAD_SUPERVISOR
   * @param {String} userId - ID HEAD_SUPERVISOR
   * @param {Array} siteIds - IDs des sites à assigner
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur mis à jour
   */
  async assignSites(userId, siteIds, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut assigner des sites");
    }

    const user = await userRepository.findById(userId);
    if (!user || user.role !== "HEAD_SUPERVISOR") {
      throw new Error("Utilisateur non trouvé ou n'est pas HEAD_SUPERVISOR");
    }

    const updatedUser = await userRepository.update(userId, {
      sitesManaging: siteIds,
    });

    return this._sanitizeUser(updatedUser);
  }

  /**
   * Assigne des zones à un opérateur
   * @param {String} userId - ID OPERATOR
   * @param {Array} zoneIds - IDs des zones à assigner
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur mis à jour
   */
  async assignZones(userId, zoneIds, requester) {
    if (!["SUPER_ADMIN", "SITE_SUPERVISOR"].includes(requester.role)) {
      throw new Error("Autorisation insuffisante");
    }

    const user = await userRepository.findById(userId);
    if (!user || user.role !== "OPERATOR") {
      throw new Error("Utilisateur non trouvé ou n'est pas OPERATOR");
    }

    const updatedUser = await userRepository.update(userId, {
      zonesAssigned: zoneIds,
    });

    return this._sanitizeUser(updatedUser);
  }

  /**
   * Change le rôle d'un utilisateur
   * @param {String} userId - ID utilisateur
   * @param {String} newRole - Nouveau rôle
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur mis à jour
   */
  async changeRole(userId, newRole, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut changer les rôles");
    }

    if (!VALID_ROLES.includes(newRole)) {
      throw new Error(`Rôle invalide: ${VALID_ROLES.join(", ")}`);
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    return await userRepository.update(userId, { role: newRole });
  }

  /**
   * Récupère les utilisateurs par rôle
   * @param {String} role - Rôle
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Array>} Utilisateurs du rôle
   */
  async getUsersByRole(role, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut voir tous les rôles");
    }

    const users = await userRepository.findAll({ role });
    return users.map(u => this._sanitizeUser(u));
  }

  /**
   * Retire le password du document utilisateur
   * @private
   */
  _sanitizeUser(user) {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    return obj;
  }
}

module.exports = new UserManagementService();
