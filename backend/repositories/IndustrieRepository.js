/**
 * REPOSITORY : INDUSTRIE
 * Gère toutes les opérations DB pour les industries
 * Encapsule les appels Mongoose
 */

const Industrie = require("../models/Industrie");

class IndustrieRepository {
  /**
   * Récupère toutes les industries avec filtres optionnels
   * @param {Object} filter - Filtre MongoDB (ex: { actif: true, secteur: "ciment" })
   * @returns {Promise<Array>} Array d'industries
   */
  async findAll(filter = {}) {
    return await Industrie.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Récupère une industrie par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document industrie ou null
   */
  async findById(id) {
    return await Industrie.findById(id);
  }

  /**
   * Crée une nouvelle industrie
   * @param {Object} data - Données industrie
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await Industrie.create(data);
  }

  /**
   * Met à jour une industrie
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @param {Object} options - Options Mongoose (ex: { new: true })
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data, options = { new: true, runValidators: true }) {
    return await Industrie.findByIdAndUpdate(id, data, options);
  }

  /**
   * Supprime une industrie
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await Industrie.findByIdAndDelete(id);
  }
}

module.exports = new IndustrieRepository();
