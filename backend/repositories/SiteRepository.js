/**
 * REPOSITORY : SITE
 * Gère toutes les opérations DB pour les sites industriels
 */

const Site = require("../models/Site");

class SiteRepository {
  /**
   * Récupère tous les sites avec filtres optionnels
   * @param {Object} filter - Filtre MongoDB
   * @returns {Promise<Array>} Array de sites
   */
  async findAll(filter = {}) {
    return await Site.find(filter)
      .populate("industrieId", "nom secteur")
      .populate("supervisorId", "nom email role")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère un site par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document site ou null
   */
  async findById(id) {
    return await Site.findById(id)
      .populate("industrieId", "nom secteur")
      .populate("supervisorId", "nom email role");
  }

  /**
   * Récupère les sites d'une industrie
   * @param {String} industrieId - ID industrie
   * @returns {Promise<Array>} Array de sites
   */
  async findByIndustrie(industrieId) {
    return await Site.find({ industrieId, actif: true })
      .populate("industrieId", "nom secteur")
      .populate("supervisorId", "nom email role")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère les sites supervisés par un utilisateur
   * @param {String} supervisorId - ID utilisateur (superviseur)
   * @returns {Promise<Array>} Array de sites
   */
  async findBySupervisor(supervisorId) {
    return await Site.find({ supervisorId, actif: true })
      .populate("industrieId", "nom secteur")
      .sort({ createdAt: -1 });
  }

  /**
   * Crée un nouveau site
   * @param {Object} data - Données site
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await Site.create(data);
  }

  /**
   * Met à jour un site
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await Site.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    })
      .populate("industrieId", "nom secteur")
      .populate("supervisorId", "nom email role");
  }

  /**
   * Supprime un site
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await Site.findByIdAndDelete(id);
  }

  /**
   * Compte les zones d'un site
   * @param {String} siteId - ID site
   * @returns {Promise<Number>} Nombre de zones
   */
  async countZones(siteId) {
    const Zone = require("../models/Zone");
    return await Zone.countDocuments({ siteId });
  }

  /**
   * Vérifie si un site peut être supprimé (pas de zones actives)
   * @param {String} siteId - ID site
   * @returns {Promise<Boolean>} true si peut être supprimé
   */
  async canDelete(siteId) {
    const Zone = require("../models/Zone");
    const zoneCount = await Zone.countDocuments({ siteId });
    return zoneCount === 0;
  }
}

module.exports = new SiteRepository();
