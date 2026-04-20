/**
 * SERVICE : SENSOR NODE
 * Logique métier pour les nœuds ESP32
 */

const sensorNodeRepository = require("../repositories/SensorNodeRepository");
const industrieRepository = require("../repositories/IndustrieRepository");
const sensorRepository = require("../repositories/SensorRepository");
const { sensor_node_status } = require("../utils/constants");

class SensorNodeService {
  /**
   * Récupère tous les nœuds avec filtres
   * @param {Object} filters - Filtres (industrieId, status, zone)
   * @returns {Promise<Array>} Nœuds
   */
  async getAllSensorNodes(filters = {}) {
    return await sensorNodeRepository.findAll(filters);
  }

  /**
   * Récupère un nœud avec ses capteurs
   * @param {String} id - ID nœud
   * @returns {Promise<Object>} Nœud avec capteurs associés
   */
  async getSensorNodeById(id) {
    const node = await sensorNodeRepository.findById(id);
    if (!node) {
      throw new Error("Nœud non trouvé");
    }

    const sensors = await sensorRepository.findByNodeId(id);

    return {
      ...node.toObject(),
      sensors,
    };
  }

  /**
   * Crée un nouveau nœud
   * @param {Object} data - Données nœud
   * @returns {Promise<Object>} Nœud créé
   */
  async createSensorNode(data) {
    // Vérifier que l'industrie existe
    if (!data.industrieId) {
      throw new Error("industrieId est requis");
    }

    const industrie = await industrieRepository.findById(data.industrieId);
    if (!industrie) {
      throw new Error("Industrie non trouvée");
    }

    // Vérifier champs requis
    if (!data.nom || !data.zone) {
      throw new Error("nom et zone sont requis");
    }

    return await sensorNodeRepository.create(data);
  }

  /**
   * Met à jour un nœud
   * @param {String} id - ID nœud
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Nœud mis à jour
   */
  async updateSensorNode(id, data) {
    const node = await sensorNodeRepository.findById(id);
    if (!node) {
      throw new Error("Nœud non trouvé");
    }

    return await sensorNodeRepository.update(id, data);
  }

  /**
   * Met à jour uniquement le statut du nœud
   * @param {String} id - ID nœud
   * @param {String} status - Nouveau statut
   * @returns {Promise<Object>} Nœud mis à jour
   */
  async updateNodeStatus(id, status) {
    const node = await sensorNodeRepository.findById(id);
    if (!node) {
      throw new Error("Nœud non trouvé");
    }

    // Vérifier statut valide
    if (!Object.values(sensor_node_status).includes(status)) {
      throw new Error(
        `Statut invalide. Valeurs acceptées : ${Object.values(sensor_node_status).join(", ")}`,
      );
    }

    return await sensorNodeRepository.updateStatus(id, status);
  }

  /**
   * Supprime un nœud
   * Vérification : pas de capteurs associés
   * @param {String} id - ID nœud
   * @returns {Promise<Object>} Nœud supprimé
   */
  async deleteSensorNode(id) {
    const node = await sensorNodeRepository.findById(id);
    if (!node) {
      throw new Error("Nœud non trouvé");
    }

    // Vérifier qu'il n'existe pas de capteurs
    const sensorCount = await sensorRepository.countByNodeId(id);
    if (sensorCount > 0) {
      throw new Error(
        `Impossible de supprimer : ${sensorCount} capteurs associés`,
      );
    }

    return await sensorNodeRepository.delete(id);
  }
}

module.exports = new SensorNodeService();
