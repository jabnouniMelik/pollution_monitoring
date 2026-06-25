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
      .populate("IndustrieId", "nom secteur localisation")
      .populate("zoneId", "nom code description")
      .populate("siteId", "nom localisation")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère un nœud par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document nœud ou null
   */
  async findById(id) {
    return await SensorNode.findById(id)
      .populate("IndustrieId", "nom secteur localisation")
      .populate("zoneId", "nom code description")
      .populate("siteId", "nom localisation");
  }

  /**
   * Récupère tous les nœuds d'une zone (utilisé pour les calculs KPI)
   * @param {String} zoneId - ID de la zone
   * @returns {Promise<Array>} Array de nœuds
   */
  async findByZone(zoneId) {
    return await SensorNode.find({ zoneId })
      .select("_id nom Status")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère les IDs des nœuds d'une zone (optimisé pour les filtres KPI)
   * @param {String} zoneId - ID de la zone
   * @returns {Promise<Array<ObjectId>>} Array d'IDs
   */
  async findNodeIdsByZone(zoneId) {
    const nodes = await SensorNode.find({ zoneId }).select("_id");
    return nodes.map((n) => n._id);
  }

  /**
   * Récupère tous les nœuds d'un site (utilisé pour les calculs KPI site-level)
   * @param {String} siteId - ID du site
   * @returns {Promise<Array>} Array de nœuds
   */
  async findBySite(siteId) {
    return await SensorNode.find({ siteId })
      .select("_id nom zoneId Status")
      .sort({ createdAt: -1 });
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
      returnDocument: "after",
      runValidators: true,
    })
      .populate("IndustrieId", "nom secteur localisation")
      .populate("zoneId", "nom code description")
      .populate("siteId", "nom localisation");
  }

  /**
   * Met à jour uniquement le statut d'un nœud
   * @param {String} id - ID MongoDB
   * @param {String} status - Nouveau statut
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateStatus(id, status) {
    return await SensorNode.findByIdAndUpdate(
      id,
      { Status: status },
      { returnDocument: "after" },
    );
  }

  /**
   * Compte les nœuds d'une industrie
   * @param {String} industrieId - ID de l'industrie
   * @returns {Promise<Number>} Nombre de nœuds
   */
  async countByIndustrie(industrieId) {
    return await SensorNode.countDocuments({ IndustrieId: industrieId });
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
