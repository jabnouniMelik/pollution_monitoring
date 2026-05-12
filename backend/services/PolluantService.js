/**
 * SERVICE : POLLUANT
 * Logique métier pour les polluants et leurs seuils réglementaires
 */

const polluantRepository = require("../repositories/PolluantRepository");

class PolluantService {
  /**
   * Récupère tous les polluants
   * @returns {Promise<Array>} Polluants triés par nom
   */
  async getAllPolluants() {
    return await polluantRepository.findAll();
  }

  /**
   * Récupère un polluant par ID
   * @param {String} id - ID polluant
   * @returns {Promise<Object>} Polluant
   */
  async getPolluantById(id) {
    const polluant = await polluantRepository.findById(id);
    if (!polluant) {
      const err = new Error("Polluant non trouvé");
      err.statusCode = 404;
      throw err;
    }
    return polluant;
  }

  /**
   * Crée un nouveau polluant
   * @param {Object} data - Données polluant
   * @returns {Promise<Object>} Polluant créé
   */
  async createPolluant(data) {
    // Valider champs requis
    if (!data.name || !data.unit || data.regulatoryLimit === undefined) {
      const err = new Error("name, unit et regulatoryLimit sont requis");
      err.statusCode = 400;
      throw err;
    }

    // Vérifier que la limite réglementaire > 0
    if (data.regulatoryLimit <= 0) {
      throw new Error("La limite réglementaire doit être positive");
    }

    // Vérifier cohérence seuils si warningThreshold fourni
    if (
      data.warningThreshold &&
      data.warningThreshold >= data.regulatoryLimit
    ) {
      throw new Error(
        "Le seuil d'avertissement doit être inférieur au seuil réglementaire",
      );
    }

    return await polluantRepository.create(data);
  }

  /**
   * Met à jour un polluant
   * @param {String} id - ID polluant
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Polluant mis à jour
   */
  async updatePolluant(id, data) {
    const polluant = await polluantRepository.findById(id);
    if (!polluant) {
      throw new Error("Polluant non trouvé");
    }

    // Vérifier cohérence seuils
    const regulatoryLimit = data.regulatoryLimit || polluant.regulatoryLimit;
    const warningThreshold = data.warningThreshold || polluant.warningThreshold;

    if (warningThreshold && warningThreshold >= regulatoryLimit) {
      throw new Error(
        "Le seuil d'avertissement doit être inférieur au seuil réglementaire",
      );
    }

    return await polluantRepository.update(id, data);
  }

  /**
   * Met à jour uniquement les seuils d'un polluant
   * Endpoint spécialisé pour les modifications fréquentes
   * @param {String} id - ID polluant
   * @param {Number} regulatoryLimit - Limite réglementaire
   * @param {Number} warningThreshold - Seuil d'avertissement
   * @returns {Promise<Object>} Polluant mis à jour
   */
  async updateSeuils(id, regulatoryLimit, warningThreshold) {
    const polluant = await polluantRepository.findById(id);
    if (!polluant) {
      throw new Error("Polluant non trouvé");
    }

    // Valider les seuils
    if (!regulatoryLimit || !warningThreshold) {
      throw new Error("Les seuils réglementaires et d'alerte sont requis");
    }

    if (warningThreshold >= regulatoryLimit) {
      throw new Error(
        "Le seuil d'alerte doit être inférieur à la limite réglementaire",
      );
    }

    return await polluantRepository.updateSeuils(
      id,
      regulatoryLimit,
      warningThreshold,
    );
  }

  /**
   * Supprime un polluant
   * @param {String} id - ID polluant
   * @returns {Promise<Object>} Polluant supprimé
   */
  async deletePolluant(id) {
    const polluant = await polluantRepository.findById(id);
    if (!polluant) {
      throw new Error("Polluant non trouvé");
    }

    return await polluantRepository.delete(id);
  }
}

module.exports = new PolluantService();
