/**
 * REPOSITORY : POLLUANT
 * Gère toutes les opérations DB pour les polluants et leurs seuils
 */

const Polluant = require("../models/Polluant");

class PolluantRepository {
  /**
   * Récupère tous les polluants
   * @returns {Promise<Array>} Array de polluants triés par nom
   */
  async findAll() {
    return await Polluant.find().sort({ name: 1 });
  }

  /**
   * Récupère un polluant par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document polluant ou null
   */
  async findById(id) {
    return await Polluant.findById(id);
  }

  /**
   * Cherche un polluant par nom
   * @param {String} name - Nom du polluant
   * @returns {Promise<Object>} Document polluant ou null
   */
  async findByName(name) {
    return await Polluant.findOne({ name });
  }

  /**
   * Crée un nouveau polluant
   * @param {Object} data - Données polluant
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await Polluant.create(data);
  }

  /**
   * Met à jour un polluant
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await Polluant.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Met à jour uniquement les seuils d'un polluant
   * @param {String} id - ID MongoDB
   * @param {Number} regulatoryLimit - Limite réglementaire
   * @param {Number} warningThreshold - Seuil d'avertissement
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateSeuils(id, regulatoryLimit, warningThreshold) {
    return await Polluant.findByIdAndUpdate(
      id,
      { regulatoryLimit, warningThreshold },
      { new: true },
    );
  }

  /**
   * Supprime un polluant
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await Polluant.findByIdAndDelete(id);
  }
}

module.exports = new PolluantRepository();
