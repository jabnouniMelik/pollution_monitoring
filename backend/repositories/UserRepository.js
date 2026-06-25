/**
 * REPOSITORY : USER
 * Gère toutes les opérations DB pour les utilisateurs
 */

const User = require("../models/User");

class UserRepository {
  /**
   * Récupère tous les utilisateurs avec filtre optionnel
   * @param {Object} filter - Filtre MongoDB
   * @returns {Promise<Array>} Array d'utilisateurs
   */
  async findAll(filter = {}) {
    return await User.find(filter)
      .select("-password")
      .populate("industryId", "nom secteur")
      .populate("sitesManaging", "nom localisation")
      .populate({
        path: "zonesAssigned",
        select: "code nom siteId",
        populate: { path: "siteId", select: "nom" },
      })
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère un utilisateur par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document utilisateur ou null
   */
  async findById(id) {
    return await User.findById(id)
      .select("-password")
      .populate("industryId", "nom secteur")
      .populate("sitesManaging", "nom localisation")
      .populate({
        path: "zonesAssigned",
        select: "code nom siteId",
        populate: { path: "siteId", select: "nom" },
      });
  }

  /**
   * Cherche un utilisateur par email
   * @param {String} email - Email
   * @returns {Promise<Object>} Document utilisateur (avec password)
   */
  async findByEmail(email) {
    return await User.findOne({ email });
  }

  /**
   * Cherche un utilisateur par username
   * @param {String} username - Username
   * @returns {Promise<Object>} Document utilisateur ou null
   */
  async findByUsername(username) {
    return await User.findOne({ username });
  }

  /**
   * Crée un nouvel utilisateur
   * @param {Object} data - Données utilisateur
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await User.create(data);
  }

  /**
   * Met à jour un utilisateur
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await User.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    }).select("-password");
  }

  /**
   * Compte les utilisateurs par rôle
   * @param {String} role - Rôle
   * @returns {Promise<Number>} Nombre d'utilisateurs
   */
  async countByRole(role) {
    return await User.countDocuments({ role });
  }

  /**
   * Supprime un utilisateur
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await User.findByIdAndDelete(id);
  }
}

module.exports = new UserRepository();
