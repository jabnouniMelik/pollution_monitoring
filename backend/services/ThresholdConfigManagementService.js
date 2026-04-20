/**
 * SERVICE : THRESHOLD CONFIG MANAGEMENT
 * Logique métier pour la gestion des seuils réglementaires
 * Limites d'émission Décret 2010-2516 (Tunisie) - SUPER_ADMIN only
 */

const thresholdConfigRepository = require("../repositories/ThresholdConfigRepository");

const VALID_POLLUTANTS = ["NOx", "SO2", "PM", "PM25", "COV", "CO2"];

class ThresholdConfigManagementService {
  /**
   * Récupère la configuration active des seuils
   * @returns {Promise<Object>} Configuration
   */
  async getActiveConfig() {
    const config = await thresholdConfigRepository.getActiveConfig();
    if (!config) {
      throw new Error("Aucune configuration de seuils active trouvée");
    }
    return config;
  }

  /**
   * Récupère toutes les configurations de seuils
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Array>} Configurations
   */
  async getAllConfigs(requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut consulter l'historique des seuils");
    }

    return await thresholdConfigRepository.findAll();
  }

  /**
   * Met à jour les limites d'un polluant - SUPER_ADMIN only
   * @param {String} configId - ID configuration
   * @param {String} polluantName - Nom du polluant
   * @param {Object} limits - { min, max, unit, reference }
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updatePollutantLimits(configId, polluantName, limits, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut modifier les seuils réglementaires");
    }

    // Valider polluant
    if (!VALID_POLLUTANTS.includes(polluantName)) {
      throw new Error(
        `Polluant invalide. Valides: ${VALID_POLLUTANTS.join(", ")}`
      );
    }

    const { min, max, unit, reference } = limits;

    // Valider limites
    if (min === undefined || max === undefined) {
      throw new Error("min et max requis");
    }

    if (parseFloat(min) >= parseFloat(max)) {
      throw new Error("min doit être inférieur à max");
    }

    // Calculer automatiquement warning et critical
    const maxValue = parseFloat(max);
    const warningOffset = 20; // 20% par défaut
    const criticalOffset = 20;

    const warning = maxValue - (maxValue * warningOffset) / 100;
    const critical = maxValue + (maxValue * criticalOffset) / 100;

    const pollutantData = {
      min: parseFloat(min),
      max: maxValue,
      warning: parseFloat(warning.toFixed(2)),
      critical: parseFloat(critical.toFixed(2)),
      unit: unit || "mg/Nm³",
      reference: reference || "Décret 2010-2516",
    };

    const updated = await thresholdConfigRepository.updatePollutantLimits(
      configId,
      polluantName,
      pollutantData
    );

    return updated;
  }

  /**
   * Met à jour les pourcentages de calcul des seuils - SUPER_ADMIN only
   * @param {String} configId - ID configuration
   * @param {Number} warningOffset - Pourcentage pour warning
   * @param {Number} criticalOffset - Pourcentage pour critical
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateOffsets(configId, warningOffset, criticalOffset, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut modifier les offsets");
    }

    // Valider offsets
    const wOffset = parseFloat(warningOffset);
    const cOffset = parseFloat(criticalOffset);

    if (isNaN(wOffset) || isNaN(cOffset) || wOffset < 0 || cOffset < 0) {
      throw new Error("Les offsets doivent être des nombres positifs");
    }

    const updated = await thresholdConfigRepository.updateOffsets(
      configId,
      wOffset,
      cOffset
    );

    // Recalculer tous les seuils avec les nouveaux offsets
    // Note: Ceci nécessiterait une mise à jour complète de tous les polluants
    return updated;
  }

  /**
   * Met à jour les limites de tous les polluants - SUPER_ADMIN only
   * @param {String} configId - ID configuration
   * @param {Object} pollutantsData - { NOx: {...}, SO2: {...}, ... }
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration mise à jour
   */
  async updateAllPollutants(configId, pollutantsData, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut modifier les seuils");
    }

    const config = await thresholdConfigRepository.findById(configId);
    if (!config) {
      throw new Error("Configuration non trouvée");
    }

    // Mettre à jour chaque polluant
    const updatedPollutants = { ...config.polluants };

    for (const [pollutantName, data] of Object.entries(pollutantsData)) {
      if (!VALID_POLLUTANTS.includes(pollutantName)) {
        continue; // Ignorer les polluants invalides
      }

      const { min, max, unit, reference } = data;

      if (min === undefined || max === undefined) {
        continue;
      }

      if (parseFloat(min) >= parseFloat(max)) {
        throw new Error(
          `Pour ${pollutantName}: min doit être inférieur à max`
        );
      }

      const maxValue = parseFloat(max);
      const warning = maxValue - (maxValue * config.warningOffsetPercent) / 100;
      const critical =
        maxValue + (maxValue * config.criticalOffsetPercent) / 100;

      updatedPollutants[pollutantName] = {
        min: parseFloat(min),
        max: maxValue,
        warning: parseFloat(warning.toFixed(2)),
        critical: parseFloat(critical.toFixed(2)),
        unit: unit || "mg/Nm³",
        reference: reference || "Décret 2010-2516",
      };
    }

    const updated = await thresholdConfigRepository.update(configId, {
      polluants: updatedPollutants,
      lastModifiedBy: requester._id,
      modificationReason: "Mise à jour en masse des polluants",
    });

    return updated;
  }

  /**
   * Obtient les limites d'un polluant spécifique
   * @param {String} polluantName - Nom du polluant
   * @returns {Promise<Object>} Limites
   */
  async getPollutantLimits(polluantName) {
    if (!VALID_POLLUTANTS.includes(polluantName)) {
      throw new Error(
        `Polluant invalide. Valides: ${VALID_POLLUTANTS.join(", ")}`
      );
    }

    return await thresholdConfigRepository.getPollutantLimits(polluantName);
  }

  /**
   * Clone une configuration (pour versioning/backup)
   * @param {String} sourceConfigId - ID configuration source
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Nouvelle configuration
   */
  async cloneConfig(sourceConfigId, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut cloner les configurations");
    }

    return await thresholdConfigRepository.clone(sourceConfigId, {
      createdBy: requester._id,
      lastModifiedBy: requester._id,
      modificationReason: "Clone pour sauvegarde",
    });
  }

  /**
   * Réinitialise les seuils aux valeurs par défaut (Décret 2010-2516)
   * @param {String} configId - ID configuration
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Configuration réinitialisée
   */
  async resetToDefaults(configId, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut réinitialiser");
    }

    const defaultPollutants = {
      NOx: {
        min: 120,
        max: 450,
        warning: 360,
        critical: 540,
        unit: "mg/Nm³",
        reference: "Décret 2010-2516",
      },
      SO2: {
        min: 35,
        max: 1700,
        warning: 1360,
        critical: 2040,
        unit: "mg/Nm³",
        reference: "Décret 2010-2516",
      },
      PM: {
        min: 5,
        max: 550,
        warning: 440,
        critical: 660,
        unit: "mg/m³",
        reference: "Décret 2010-2516",
      },
      PM25: {
        min: 5,
        max: 550,
        warning: 440,
        critical: 660,
        unit: "mg/m³",
        reference: "Décret 2010-2516",
      },
      COV: {
        min: 0,
        max: 110,
        warning: 88,
        critical: 132,
        unit: "mg/Nm³",
        reference: "ANPE",
      },
      CO2: {
        min: 0,
        max: 800,
        warning: 640,
        critical: 960,
        unit: "ppm",
        reference: "Custom",
      },
    };

    return await thresholdConfigRepository.update(configId, {
      polluants: defaultPollutants,
      warningOffsetPercent: 20,
      criticalOffsetPercent: 20,
      lastModifiedBy: requester._id,
      modificationReason: "Réinitialisation aux valeurs par défaut",
    });
  }

  /**
   * Obtient un rapport de conformité (% dépassements vs limites)
   * @returns {Promise<Object>} Rapport
   */
  async getComplianceReport() {
    const config = await this.getActiveConfig();

    const report = {
      timestamp: new Date(),
      configuration: config.nom,
      pollutants: {},
    };

    for (const [name, data] of Object.entries(config.polluants)) {
      report.pollutants[name] = {
        max: data.max,
        warning: data.warning,
        critical: data.critical,
        unit: data.unit,
      };
    }

    return report;
  }
}

module.exports = new ThresholdConfigManagementService();
