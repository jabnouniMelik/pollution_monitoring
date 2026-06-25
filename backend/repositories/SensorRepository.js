/**
 * REPOSITORY : SENSOR
 * Gère toutes les opérations DB pour les capteurs
 */

const Sensor = require("../models/Sensor");

class SensorRepository {
  /**
   * Récupère tous les capteurs avec filtres optionnels
   * @param {Object} filter - Filtre MongoDB
   * @returns {Promise<Array>} Array de capteurs
   */
  async findAll(filter = {}) {
    return await Sensor.find(filter)
      .populate("sensorNodeId", "name zone status")
      .populate("PolluantId", "name unit regulatoryLimit warningThreshold")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère un capteur par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document capteur ou null
   */
  async findById(id) {
    return await Sensor.findById(id)
      .populate("sensorNodeId", "name zone status industrieId")
      .populate("PolluantId", "name unit regulatoryLimit warningThreshold");
  }

  /**
   * Récupère un capteur avec filtres personnalisés
   * @param {Object} filter - Filtre MongoDB {type, model, etc.}
   * @returns {Promise<Object>} Document capteur ou null
   */
  async findOne(filter) {
    return await Sensor.findOne(filter)
      .populate("sensorNodeId", "name zone status industrieId")
      .populate("PolluantId", "name unit regulatoryLimit warningThreshold");
  }

  /**
   * Récupère les capteurs d'un nœud
   * @param {String} sensorNodeId - ID du nœud
   * @returns {Promise<Array>} Array de capteurs
   */
  async findByNodeId(sensorNodeId) {
    return await Sensor.find({ sensorNodeId }).populate(
      "PolluantId",
      "name unit regulatoryLimit",
    );
  }

  /**
   * Crée un nouveau capteur
   * @param {Object} data - Données capteur
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    const sensor = await Sensor.create(data);
    return await this.findById(sensor._id);
  }

  /**
   * Met à jour un capteur
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await Sensor.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    })
      .populate("sensorNodeId", "name zone")
      .populate("PolluantId", "name unit");
  }

  /**
   * Met à jour la date et seuil de calibration
   * @param {String} id - ID MongoDB
   * @param {Date} calibrationDate - Date de calibration
   * @param {Number} driftThreshold - Nouveau seuil de dérive
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateCalibration(id, calibrationDate, driftThreshold) {
    return await Sensor.findByIdAndUpdate(
      id,
      { calibrationDate, driftThreshold },
      { returnDocument: "after" },
    ).populate("PolluantId", "name unit");
  }

  /**
   * Compte les capteurs d'un nœud
   * @param {String} sensorNodeId - ID du nœud
   * @returns {Promise<Number>} Nombre de capteurs
   */
  async countByNodeId(sensorNodeId) {
    return await Sensor.countDocuments({ sensorNodeId });
  }

  /**
   * Supprime un capteur
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await Sensor.findByIdAndDelete(id);
  }
}

module.exports = new SensorRepository();
