/**
 * REPOSITORY : SITE_CONFIG
 * Gère les opérations DB pour la configuration du site
 */

const SiteConfig = require("../models/SiteConfig");

class SiteConfigRepository {
  /**
   * Récupère la configuration active du site
   * @returns {Promise<Object>} Configuration ou null
   */
  async getActiveConfig() {
    return await SiteConfig.findOne({ isActive: true });
  }

  /**
   * Crée une nouvelle configuration
   * @param {Object} data - Données configuration
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await SiteConfig.create(data);
  }

  /**
   * Met à jour la configuration
   * @param {String} id - ID configuration
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await SiteConfig.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    });
  }

  /**
   * Met à jour le débit d'air (Q_air)
   * @param {Number} airflow - Nouveau débit (Nm³/s)
   * @param {String} userId - ID utilisateur modifiant
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateAirflow(airflow, userId) {
    const config = await this.getActiveConfig();
    if (!config) {
      throw new Error("Configuration active non trouvée");
    }

    config.airflow = airflow;
    config.lastModifiedBy = userId;
    return await config.save();
  }

  /**
   * Met à jour les poids des polluants pour IPE
   * @param {Object} weights - Objet des poids { polluantName: weight }
   * @param {String} userId - ID utilisateur modifiant
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updatePolluantWeights(weights, userId) {
    const config = await this.getActiveConfig();
    if (!config) {
      throw new Error("Configuration active non trouvée");
    }

    // Normaliser les noms (PM2.5 → PM25)
    const normalizedWeights = {};
    for (const [name, weight] of Object.entries(weights)) {
      const normalizedName = name.replace(".", "");
      normalizedWeights[normalizedName] = weight;
    }

    // Valider que la somme des poids = 1.0
    const totalWeight = Object.values(normalizedWeights).reduce(
      (sum, w) => sum + w,
      0,
    );
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(
        `La somme des poids doit être 1.0 (actuel: ${totalWeight.toFixed(2)})`,
      );
    }

    config.polluantWeights = normalizedWeights;
    config.lastModifiedBy = userId;
    return await config.save();
  }

  /**
   * Met à jour les objectifs KPI
   * @param {Object} targets - Nouveaux objectifs
   * @param {String} userId - ID utilisateur modifiant
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateTargets(targets, userId) {
    const config = await this.getActiveConfig();
    if (!config) {
      throw new Error("Configuration active non trouvée");
    }

    config.targets = { ...config.targets, ...targets };
    config.lastModifiedBy = userId;
    return await config.save();
  }

  /**
   * Récupère toutes les configurations
   * @returns {Promise<Array>} Array de configurations
   */
  async findAll() {
    return await SiteConfig.find().sort({ createdAt: -1 });
  }

  /**
   * Récupère une configuration par ID
   * @param {String} id - ID configuration
   * @returns {Promise<Object>} Document ou null
   */
  async findById(id) {
    return await SiteConfig.findById(id);
  }
}

module.exports = new SiteConfigRepository();
