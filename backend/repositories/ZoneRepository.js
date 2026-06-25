/**
 * REPOSITORY : ZONE
 * Gère toutes les opérations DB pour les zones de monitoring
 */

const Zone = require("../models/Zone");

class ZoneRepository {
  /**
   * Récupère toutes les zones avec filtres optionnels
   * @param {Object} filter - Filtre MongoDB
   * @returns {Promise<Array>} Array de zones
   */
  async findAll(filter = {}) {
    return await Zone.find(filter)
      .populate("siteId", "nom localisation")
      .populate("industrieId", "nom secteur")
      .populate("operatorsAssigned", "nom email role")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère une zone par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document zone ou null
   */
  async findById(id) {
    return await Zone.findById(id)
      .populate("siteId", "nom localisation")
      .populate("industrieId", "nom secteur")
      .populate("operatorsAssigned", "nom email role");
  }

  /**
   * Récupère les zones d'un site
   * @param {String} siteId - ID site
   * @returns {Promise<Array>} Array de zones
   */
  async findBySite(siteId) {
    return await Zone.find({ siteId, actif: true })
      .populate("siteId", "nom localisation")
      .populate("industrieId", "nom secteur")
      .populate("operatorsAssigned", "nom email role")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère les zones d'une industrie
   * @param {String} industrieId - ID industrie
   * @returns {Promise<Array>} Array de zones
   */
  async findByIndustrie(industrieId) {
    return await Zone.find({ industrieId, actif: true })
      .populate("siteId", "nom localisation")
      .populate("industrieId", "nom secteur")
      .populate("operatorsAssigned", "nom email role")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère les zones assignées à un opérateur
   * @param {String} operatorId - ID opérateur
   * @returns {Promise<Array>} Array de zones
   */
  async findByOperator(operatorId) {
    return await Zone.find({ operatorsAssigned: operatorId, actif: true })
      .populate("siteId", "nom localisation")
      .populate("industrieId", "nom secteur")
      .sort({ createdAt: -1 });
  }

  /**
   * Crée une nouvelle zone
   * @param {Object} data - Données zone
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await Zone.create(data);
  }

  /**
   * Met à jour une zone
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await Zone.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    })
      .populate("siteId", "nom localisation")
      .populate("industrieId", "nom secteur")
      .populate("operatorsAssigned", "nom email role");
  }

  /**
   * Ajoute un opérateur à une zone
   * @param {String} zoneId - ID zone
   * @param {String} operatorId - ID opérateur
   * @returns {Promise<Object>} Zone mise à jour
   */
  async addOperator(zoneId, operatorId) {
    return await Zone.findByIdAndUpdate(
      zoneId,
      { $addToSet: { operatorsAssigned: operatorId } },
      { returnDocument: "after" },
    ).populate("operatorsAssigned", "nom email role");
  }

  /**
   * Retire un opérateur d'une zone
   * @param {String} zoneId - ID zone
   * @param {String} operatorId - ID opérateur
   * @returns {Promise<Object>} Zone mise à jour
   */
  async removeOperator(zoneId, operatorId) {
    return await Zone.findByIdAndUpdate(
      zoneId,
      { $pull: { operatorsAssigned: operatorId } },
      { returnDocument: "after" },
    ).populate("operatorsAssigned", "nom email role");
  }

  /**
   * Supprime une zone
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await Zone.findByIdAndDelete(id);
  }

  /**
   * Compte les capteurs d'une zone
   * @param {String} zoneId - ID zone
   * @returns {Promise<Number>} Nombre de capteurs
   */
  async countSensors(zoneId) {
    const SensorNode = require("../models/SensorNode");
    return await SensorNode.countDocuments({ zoneId });
  }

  /**
   * Vérifie si une zone peut être supprimée (pas de capteurs actifs)
   * @param {String} zoneId - ID zone
   * @returns {Promise<Boolean>} true si peut être supprimé
   */
  async canDelete(zoneId) {
    const SensorNode = require("../models/SensorNode");
    const sensorCount = await SensorNode.countDocuments({ zoneId });
    return sensorCount === 0;
  }
}

module.exports = new ZoneRepository();
