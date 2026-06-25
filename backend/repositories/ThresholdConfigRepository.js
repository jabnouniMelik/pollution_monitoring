/**
 * REPOSITORY : THRESHOLD_CONFIG
 * Gère toutes les opérations DB pour la configuration des seuils réglementaires
 */

const ThresholdConfig = require("../models/ThresholdConfig");

class ThresholdConfigRepository {
  /**
   * Récupère la configuration active des seuils
   * @returns {Promise<Object>} Configuration ou null
   */
  async getActiveConfig() {
    return await ThresholdConfig.findOne({ actif: true })
      .populate("createdBy", "nom email role")
      .populate("lastModifiedBy", "nom email role");
  }

  /**
   * Récupère tous les seuils
   * @param {Object} filter - Filtre optionnel
   * @returns {Promise<Array>} Array de configurations
   */
  async findAll(filter = {}) {
    return await ThresholdConfig.find(filter)
      .populate("createdBy", "nom email role")
      .populate("lastModifiedBy", "nom email role")
      .sort({ createdAt: -1 });
  }

  /**
   * Récupère une configuration par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Configuration ou null
   */
  async findById(id) {
    return await ThresholdConfig.findById(id)
      .populate("createdBy", "nom email role")
      .populate("lastModifiedBy", "nom email role");
  }

  /**
   * Crée une nouvelle configuration des seuils
   * @param {Object} data - Données configuration
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await ThresholdConfig.create(data);
  }

  /**
   * Met à jour une configuration des seuils
   * @param {String} id - ID configuration
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async update(id, data) {
    return await ThresholdConfig.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    })
      .populate("createdBy", "nom email role")
      .populate("lastModifiedBy", "nom email role");
  }

  /**
   * Met à jour les limites pour un polluant spécifique
   * @param {String} id - ID configuration
   * @param {String} polluantName - Nom du polluant (ex: 'NOx')
   * @param {Object} limits - Limites {min, max, unit, reference}
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updatePollutantLimits(id, polluantName, limits) {
    return await ThresholdConfig.findByIdAndUpdate(
      id,
      { $set: { [`polluants.${polluantName}`]: limits } },
      { returnDocument: "after", runValidators: true },
    );
  }

  /**
   * Met à jour les pourcentages de calcul des seuils d'alerte
   * @param {String} id - ID configuration
   * @param {Number} warningOffset - Pourcentage d'avertissement (ex: 20)
   * @param {Number} criticalOffset - Pourcentage critique (ex: 20)
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateOffsets(id, warningOffset, criticalOffset) {
    return await ThresholdConfig.findByIdAndUpdate(
      id,
      {
        warningOffsetPercent: warningOffset,
        criticalOffsetPercent: criticalOffset,
      },
      { returnDocument: "after" },
    );
  }

  /**
   * Obtient les limites d'un polluant spécifique
   * @param {String} polluantName - Nom du polluant
   * @returns {Promise<Object>} Limites du polluant
   */
  async getPollutantLimits(polluantName) {
    const config = await this.getActiveConfig();
    if (!config || !config.polluants[polluantName]) {
      return null;
    }
    return config.polluants[polluantName];
  }

  /**
   * Supprime une configuration (soft delete - désactiver)
   * @param {String} id - ID configuration
   * @returns {Promise<Object>} Configuration désactivée
   */
  async deactivate(id) {
    return await ThresholdConfig.findByIdAndUpdate(
      id,
      { actif: false },
      { returnDocument: "after" },
    );
  }

  /**
   * Crée une copie d'une configuration (pour versioning)
   * @param {String} sourceId - ID configuration source
   * @param {Object} metadata - Métadonnées additionnelles
   * @returns {Promise<Object>} Nouvelle configuration
   */
  async clone(sourceId, metadata = {}) {
    const source = await this.findById(sourceId);
    if (!source) {
      throw new Error("Configuration source non trouvée");
    }

    const newConfig = new ThresholdConfig({
      nom: `${source.nom} (Copie ${new Date().toLocaleDateString()})`,
      description: source.description,
      polluants: source.polluants,
      warningOffsetPercent: source.warningOffsetPercent,
      criticalOffsetPercent: source.criticalOffsetPercent,
      alertLevels: source.alertLevels,
      ...metadata,
    });

    return await newConfig.save();
  }
}

module.exports = new ThresholdConfigRepository();
