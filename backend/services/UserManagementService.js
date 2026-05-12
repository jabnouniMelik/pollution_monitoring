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
    // Permission matrix:
    // SUPER_ADMIN      → any role
    // HEAD_SUPERVISOR  → OPERATOR, SITE_SUPERVISOR, HEAD_SUPERVISOR (same industry)
    // SITE_SUPERVISOR  → OPERATOR only (same industry)
    if (requester.role === "HEAD_SUPERVISOR") {
      const allowedRoles = ["OPERATOR", "SITE_SUPERVISOR", "HEAD_SUPERVISOR"];
      if (data.role && !allowedRoles.includes(data.role)) {
        throw new Error("Le responsable industrie ne peut créer que des opérateurs, superviseurs de site ou responsables industrie");
      }
      if (!data.role) data.role = "OPERATOR";
      // Force same industry
      data.industryId = requester.industryId;
    } else if (requester.role === "SITE_SUPERVISOR") {
      if (data.role && data.role !== "OPERATOR") {
        throw new Error("Le superviseur de site ne peut créer que des opérateurs");
      }
      data.role = "OPERATOR";
      data.industryId = requester.industryId;
    } else if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Autorisation insuffisante pour créer des utilisateurs");
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

    // Créer l'utilisateur
    // Le hook pre('save') du model User hash automatiquement le password
    const user = await userRepository.create({
      username,
      email,
      password,  // passé en clair — le model le hash via pre('save')
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
  /**
   * Helper: get zone IDs belonging to the supervisor's sites
   * @private
   */
  async _getSupervisorZoneIds(requester) {
    const Zone = require("../models/Zone");
    const siteIds = (requester.sitesManaging || []).map((s) =>
      s._id ? s._id.toString() : s.toString()
    );
    if (siteIds.length === 0) return [];
    const zones = await Zone.find({ siteId: { $in: siteIds } })
      .select("_id")
      .lean();
    return zones.map((z) => z._id.toString());
  }

  /**
   * Helper: check that an operator belongs to the supervisor's site
   * An operator belongs to the site if at least one of their zonesAssigned
   * is a zone of the supervisor's site.
   * @private
   */
  async _operatorBelongsToSupervisorSite(operator, requester) {
    const supervisorZoneIds = await this._getSupervisorZoneIds(requester);
    if (supervisorZoneIds.length === 0) return false;
    const operatorZoneIds = (operator.zonesAssigned || []).map((z) =>
      z._id ? z._id.toString() : z.toString()
    );
    // Operator has at least one zone in the supervisor's site
    return operatorZoneIds.some((id) => supervisorZoneIds.includes(id));
  }

  async getUsers(requester, filters = {}) {
    let query = {};

    if (requester.role === "SUPER_ADMIN") {
      query = filters;
      const users = await userRepository.findAll(query);
      return users.map((u) => this._sanitizeUser(u));
    } else if (requester.role === "HEAD_SUPERVISOR") {
      query = { ...filters, industryId: requester.industryId };
      const users = await userRepository.findAll(query);
      return users.map((u) => this._sanitizeUser(u));
    } else if (requester.role === "SITE_SUPERVISOR") {
      // Get all zone IDs for this supervisor's sites
      const supervisorZoneIds = await this._getSupervisorZoneIds(requester);

      // Operators whose zonesAssigned intersects with supervisor's zones
      // Also include operators with no zones yet but same industryId (newly created)
      const allOperators = await userRepository.findAll({
        role: "OPERATOR",
        industryId: requester.industryId,
      });

      // Filter: operator must have at least one zone in supervisor's site,
      // OR have no zones yet (just created by this supervisor)
      const filtered = allOperators.filter((op) => {
        const opZones = (op.zonesAssigned || []).map((z) =>
          z._id ? z._id.toString() : z.toString()
        );
        // No zones assigned yet → show (supervisor just created them)
        if (opZones.length === 0) return true;
        // Has zones → at least one must belong to supervisor's site
        return opZones.some((id) => supervisorZoneIds.includes(id));
      });

      return filtered.map((u) => this._sanitizeUser(u));
    } else {
      throw new Error("Accès refusé");
    }
  }

  /**
   * Récupère un utilisateur par ID
   * @param {String} userId - ID utilisateur
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Utilisateur
   */
  async getUserById(userId, requester) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error("Utilisateur non trouvé");

    if (requester.role === "SUPER_ADMIN") {
      return this._sanitizeUser(user);
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (user.industryId?.toString() !== requester.industryId?.toString())
        throw new Error("Accès refusé");
      return this._sanitizeUser(user);
    } else if (requester.role === "SITE_SUPERVISOR") {
      if (user.role !== "OPERATOR")
        throw new Error("Accès refusé");
      // Must be same industry AND belong to supervisor's site
      if (user.industryId?.toString() !== requester.industryId?.toString())
        throw new Error("Accès refusé");
      const belongs = await this._operatorBelongsToSupervisorSite(user, requester);
      // Allow access if operator has no zones yet (just created)
      const hasNoZones = !user.zonesAssigned || user.zonesAssigned.length === 0;
      if (!belongs && !hasNoZones) throw new Error("Accès refusé");
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
    if (!["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(requester.role)) {
      throw new Error("Autorisation insuffisante pour supprimer des utilisateurs");
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new Error("Utilisateur non trouvé");

    // HEAD_SUPERVISOR: can delete any user in their industry (except themselves)
    if (requester.role === "HEAD_SUPERVISOR") {
      if (user._id.toString() === requester.userId)
        throw new Error("Vous ne pouvez pas vous supprimer vous-même");
      if (user.industryId?.toString() !== requester.industryId?.toString())
        throw new Error("Cet utilisateur n'appartient pas à votre industrie");
      // Cannot delete SUPER_ADMIN
      if (user.role === "SUPER_ADMIN")
        throw new Error("Impossible de supprimer un SUPER_ADMIN");
    }

    // SITE_SUPERVISOR: operators in their site only
    if (requester.role === "SITE_SUPERVISOR") {
      if (user.role !== "OPERATOR")
        throw new Error("Le superviseur de site ne peut supprimer que des opérateurs");
      if (user.industryId?.toString() !== requester.industryId?.toString())
        throw new Error("Cet opérateur n'appartient pas à votre industrie");
      const belongs = await this._operatorBelongsToSupervisorSite(user, requester);
      const hasNoZones = !user.zonesAssigned || user.zonesAssigned.length === 0;
      if (!belongs && !hasNoZones)
        throw new Error("Cet opérateur n'est pas assigné à votre site");
    }

    if (user.role === "SUPER_ADMIN") {
      const adminCount = await userRepository.countByRole("SUPER_ADMIN");
      if (adminCount <= 1) throw new Error("Impossible de supprimer le dernier SUPER_ADMIN");
    }

    if (user.role === "OPERATOR") {
      const Zone = require("../models/Zone");
      await Zone.updateMany({ operatorsAssigned: userId }, { $pull: { operatorsAssigned: userId } });
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
    if (!["SUPER_ADMIN", "HEAD_SUPERVISOR"].includes(requester.role)) {
      throw new Error("Autorisation insuffisante pour assigner des sites");
    }

    const user = await userRepository.findById(userId);
    if (!user || !["HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(user.role)) {
      throw new Error("Utilisateur non trouvé ou rôle incompatible");
    }

    // HEAD_SUPERVISOR can only assign sites from their own industry
    if (requester.role === "HEAD_SUPERVISOR") {
      if (user.industryId?.toString() !== requester.industryId?.toString())
        throw new Error("Cet utilisateur n'appartient pas à votre industrie");
      const Site = require("../models/Site");
      const sites = await Site.find({ _id: { $in: siteIds } }).select("industrieId").lean();
      const allInIndustry = sites.every(
        s => s.industrieId?.toString() === requester.industryId?.toString()
      );
      if (!allInIndustry) throw new Error("Certains sites n'appartiennent pas à votre industrie");
    }

    // Derive industryId from the assigned sites and set it on the user
    const Site = require("../models/Site");
    const firstSite = await Site.findById(siteIds[0]).select("industrieId").lean();
    const industryId = firstSite?.industrieId ?? null;

    const updatedUser = await userRepository.update(userId, {
      sitesManaging: siteIds,
      ...(industryId ? { industryId } : {}),
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
    if (!["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(requester.role)) {
      throw new Error("Autorisation insuffisante");
    }

    const user = await userRepository.findById(userId);
    if (!user || user.role !== "OPERATOR") {
      throw new Error("Utilisateur non trouvé ou n'est pas OPERATOR");
    }

    // HEAD_SUPERVISOR: zones must be in their industry
    if (requester.role === "HEAD_SUPERVISOR") {
      if (user.industryId?.toString() !== requester.industryId?.toString())
        throw new Error("Cet opérateur n'appartient pas à votre industrie");
      const Zone = require("../models/Zone");
      const zones = await Zone.find({ _id: { $in: zoneIds } }).select("industrieId").lean();
      const allInIndustry = zones.every(
        z => z.industrieId?.toString() === requester.industryId?.toString()
      );
      if (!allInIndustry) throw new Error("Certaines zones n'appartiennent pas à votre industrie");
    }

    // SITE_SUPERVISOR: zones must be from their sites
    if (requester.role === "SITE_SUPERVISOR") {
      if (user.industryId?.toString() !== requester.industryId?.toString())
        throw new Error("Cet opérateur n'appartient pas à votre industrie");

      const supervisorZoneIds = await this._getSupervisorZoneIds(requester);

      // All requested zones must belong to supervisor's sites
      const invalidZones = zoneIds.filter(
        (id) => !supervisorZoneIds.includes(id.toString())
      );
      if (invalidZones.length > 0)
        throw new Error("Certaines zones n'appartiennent pas à vos sites");
    }

    // Remove operator from all previous zones
    const Zone = require("../models/Zone");
    await Zone.updateMany(
      { operatorsAssigned: userId },
      { $pull: { operatorsAssigned: userId } }
    );

    // Add operator to new zones
    if (zoneIds.length > 0) {
      await Zone.updateMany(
        { _id: { $in: zoneIds } },
        { $addToSet: { operatorsAssigned: userId } }
      );
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
