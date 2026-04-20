/**
 * SERVICE : SITE CONFIG MANAGEMENT
 * Logique métier pour la gestion de la configuration du site
 * Paramètres techniques : airflow, weights, targets (SUPER_ADMIN only)
 */

const siteConfigRepository = require("../repositories/SiteConfigRepository");

class SiteConfigManagementService {
  /**
   * Récupère la configuration active du site
   * @returns {Promise<Object>} Configuration
   */
  async getActiveConfig() {
    const config = await siteConfigRepository.getActiveConfig();
    if (!config) {
      throw new Error("Aucune configuration active trouvée");
    }
    return config;
  }

  /**
   * Met à jour le débit d'air (Q_air) - SUPER_ADMIN only
   * @param {String} configId - ID configuration
   * @param {Number} airflow - Nouveau débit (Nm³/s)
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateAirflow(configId, airflow, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut modifier le débit d'air");
    }

    // Valider la valeur
    if (!airflow || airflow < 0.1 || airflow > 100) {
      throw new Error("Le débit d'air doit être entre 0.1 et 100 Nm³/s");
    }

    const updated = await siteConfigRepository.update(configId, {
      airflow: parseFloat(airflow),
      lastModifiedBy: requester._id,
    });

    return updated;
  }

  /**
   * Met à jour les poids des polluants pour IPE - SUPER_ADMIN only
   * @param {String} configId - ID configuration
   * @param {Object} weights - { NOx, SO2, PM25, COV, CO2 }
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updatePollutantWeights(configId, weights, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut modifier les poids");
    }

    // Valider que les poids sont présents et valides
    const requiredPollutants = ["NOx", "SO2", "PM25", "COV", "CO2"];
    let totalWeight = 0;

    for (const pollutant of requiredPollutants) {
      if (!(pollutant in weights)) {
        throw new Error(`Poids manquant pour ${pollutant}`);
      }

      const weight = parseFloat(weights[pollutant]);
      if (isNaN(weight) || weight < 0 || weight > 1) {
        throw new Error(`Poids invalide pour ${pollutant} (doit être entre 0 et 1)`);
      }

      totalWeight += weight;
    }

    // Vérifier que la somme = 1.0 (avec une tolérance de 0.01)
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`Somme des poids doit égaler 1.0 (actuellement ${totalWeight.toFixed(2)})`);
    }

    const updated = await siteConfigRepository.update(configId, {
      polluantWeights: {
        NOx: parseFloat(weights.NOx),
        SO2: parseFloat(weights.SO2),
        PM25: parseFloat(weights.PM25),
        COV: parseFloat(weights.COV),
        CO2: parseFloat(weights.CO2),
      },
      lastModifiedBy: requester._id,
    });

    return updated;
  }

  /**
   * Met à jour les objectifs KPI - SUPER_ADMIN only
   * @param {String} configId - ID configuration
   * @param {Object} targets - { tauxDepassement, ipe, reductionCO2 }
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateTargets(configId, targets, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut modifier les objectifs");
    }

    const allowedTargets = ["tauxDepassement", "ipe", "reductionCO2"];
    const filteredTargets = {};

    for (const target of allowedTargets) {
      if (target in targets) {
        const value = parseFloat(targets[target]);
        if (isNaN(value)) {
          throw new Error(`Valeur invalide pour ${target}`);
        }
        filteredTargets[target] = value;
      }
    }

    const updated = await siteConfigRepository.update(configId, {
      targets: {
        tauxDepassement: filteredTargets.tauxDepassement || (await siteConfigRepository.getActiveConfig()).targets.tauxDepassement,
        ipe: filteredTargets.ipe || (await siteConfigRepository.getActiveConfig()).targets.ipe,
        reductionCO2: filteredTargets.reductionCO2 || (await siteConfigRepository.getActiveConfig()).targets.reductionCO2,
      },
      lastModifiedBy: requester._id,
    });

    return updated;
  }

  /**
   * Met à jour la configuration complète - SUPER_ADMIN only
   * @param {String} configId - ID configuration
   * @param {Object} data - Données complètes
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateCompleteConfig(configId, data, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut mettre à jour la configuration");
    }

    const allowedFields = ["siteName", "airflow", "thermalPower", "polluantWeights", "targets", "location"];
    const filteredData = {};

    for (const field of allowedFields) {
      if (field in data) {
        filteredData[field] = data[field];
      }
    }

    filteredData.lastModifiedBy = requester._id;

    const updated = await siteConfigRepository.update(configId, filteredData);
    return updated;
  }

  /**
   * Obtient tous les objectifs KPI
   * @returns {Promise<Object>} Objectifs
   */
  async getTargets() {
    const config = await this.getActiveConfig();
    return config.targets;
  }

  /**
   * Obtient tous les poids des polluants
   * @returns {Promise<Object>} Poids
   */
  async getPolluantWeights() {
    const config = await this.getActiveConfig();
    return config.polluantWeights;
  }

  /**
   * Obtient le débit d'air
   * @returns {Promise<Number>} Débit d'air
   */
  async getAirflow() {
    const config = await this.getActiveConfig();
    return config.airflow;
  }
}

module.exports = new SiteConfigManagementService();
