/**
 * REPOSITORY : SENSOR NODE
 * Gère toutes les opérations DB pour les nœuds ESP32
 */

const SensorNode = require("../models/SensorNode");

class SensorNodeRepository {
  /**
   * Récupère tous les nœuds avec filtres optionnels
   * @param {Object} filter - Filtre MongoDB
   * @returns {Promise<Array>} Array de nœuds
   */
  async findAll(filter = {}) {
    return await SensorNode.find(filter)
      .populate("industrieId", "nom secteur localisation")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère un nœud par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document nœud ou null
   */
  async findById(id) {
    return await SensorNode.findById(id).populate(
      "industrieId",
      "nom secteur localisation",
    );
  }

  /**
   * Crée un nouveau nœud
   * @param {Object} data - Données nœud
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    const node = await SensorNode.create(data);
    return await this.findById(node._id);
  }

  /**
   * Met à jour un nœud
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await SensorNode.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).populate("industrieId", "nom secteur localisation");
  }

  /**
   * Met à jour uniquement le statut d'un nœud
   * @param {String} id - ID MongoDB
   * @param {String} status - Nouveau statut
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateStatus(id, status) {
    return await SensorNode.findByIdAndUpdate(id, { status }, { new: true });
  }

  /**
   * Compte les nœuds d'une industrie
   * @param {String} industrieId - ID de l'industrie
   * @returns {Promise<Number>} Nombre de nœuds
   */
  async countByIndustrie(industrieId) {
    return await SensorNode.countDocuments({ industrieId });
  }

  /**
   * Supprime un nœud
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await SensorNode.findByIdAndDelete(id);
  }
}

module.exports = new SensorNodeRepository();
