/**
 * SERVICE : SENSOR
 * Logique métier pour les capteurs physiques
 */

const sensorRepository = require("../repositories/SensorRepository");
const sensorNodeRepository = require("../repositories/SensorNodeRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const readingRepository = require("../repositories/ReadingRepository");

class SensorService {
  /**
   * Récupère tous les capteurs avec filtres
   * @param {Object} filters - Filtres (sensorNodeId, polluantId, isActive)
   * @returns {Promise<Array>} Capteurs
   */
  async getAllSensors(filters = {}) {
    return await sensorRepository.findAll(filters);
  }

  /**
   * Récupère un capteur avec sa dernière mesure
   * @param {String} id - ID capteur
   * @returns {Promise<Object>} Capteur avec lastReading
   */
  async getSensorById(id) {
    const sensor = await sensorRepository.findById(id);
    if (!sensor) {
      throw new Error("Capteur non trouvé");
    }

    const lastReading = await readingRepository.findLastBySensorId(id);

    return {
      ...sensor.toObject(),
      lastReading,
    };
  }

  /**
   * Crée un nouveau capteur
   * @param {Object} data - Données capteur
   * @returns {Promise<Object>} Capteur créé
   */
  async createSensor(data) {
    // Vérifier que le nœud existe
    if (!data.sensorNodeId) {
      throw new Error("sensorNodeId est requis");
    }

    const node = await sensorNodeRepository.findById(data.sensorNodeId);
    if (!node) {
      throw new Error("Nœud non trouvé");
    }

    // Vérifier que le polluant existe
    if (!data.polluantId && !data.PolluantId) {
      throw new Error("polluantId est requis");
    }

    const polluantId = data.polluantId || data.PolluantId;
    const polluant = await polluantRepository.findById(polluantId);
    if (!polluant) {
      throw new Error("Polluant non trouvé");
    }

    // Vérifier champs requis
    if (!data.model || !data.type) {
      throw new Error("model et type sont requis");
    }

    // Normaliser le field name avant de passer au repository
    const sensorData = { ...data, PolluantId: polluantId };
    delete sensorData.polluantId; // Remove lowercase version

    return await sensorRepository.create(sensorData);
  }

  /**
   * Met à jour un capteur
   * @param {String} id - ID capteur
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Capteur mis à jour
   */
  async updateSensor(id, data) {
    const sensor = await sensorRepository.findById(id);
    if (!sensor) {
      throw new Error("Capteur non trouvé");
    }

    return await sensorRepository.update(id, data);
  }

  /**
   * Calibre un capteur
   * Vérifie que le capteur est actif
   * Met à jour calibrationDate et driftThreshold
   * @param {String} id - ID capteur
   * @param {Number} driftThreshold - Nouveau seuil de dérive (défaut: 0.5)
   * @returns {Promise<Object>} Capteur calibré
   */
  async calibrateSensor(id, driftThreshold = 0.5) {
    const sensor = await sensorRepository.findById(id);
    if (!sensor) {
      throw new Error("Capteur non trouvé");
    }

    if (!sensor.isActive) {
      throw new Error("Capteur inactif. Activation requise avant calibration.");
    }

    return await sensorRepository.updateCalibration(
      id,
      new Date(),
      driftThreshold,
    );
  }

  /**
   * Supprime un capteur
   * @param {String} id - ID capteur
   * @returns {Promise<Object>} Capteur supprimé
   */
  async deleteSensor(id) {
    const sensor = await sensorRepository.findById(id);
    if (!sensor) {
      throw new Error("Capteur non trouvé");
    }

    return await sensorRepository.delete(id);
  }
}

module.exports = new SensorService();
