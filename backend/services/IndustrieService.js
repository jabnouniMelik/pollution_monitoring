/**
 * SERVICE : INDUSTRIE
 * Logique métier pour les industries
 * Valide les données, applique les règles de gestion
 */

const industrieRepository = require("../repositories/IndustrieRepository");
const sensorNodeRepository = require("../repositories/SensorNodeRepository");

class IndustrieService {
  /**
   * Récupère toutes les industries avec filtres
   * @param {Object} filters - Filtres optionnels (actif, secteur)
   * @returns {Promise<Array>} Industries
   */
  async getAllIndustries(filters = {}) {
    return await industrieRepository.findAll(filters);
  }

  /**
   * Récupère une industrie avec infos associées
   * @param {String} id - ID industrie
   * @returns {Promise<Object>} Industrie avec count nœuds
   */
  async getIndustrieById(id) {
    const industrie = await industrieRepository.findById(id);
    if (!industrie) {
      throw new Error("Industrie non trouvée");
    }

    const nodeCount = await sensorNodeRepository.countByIndustrie(id);

    return {
      ...industrie.toObject(),
      sensorNodeCount: nodeCount,
    };
  }

  /**
   * Crée une nouvelle industrie
   * @param {Object} data - Données industrie
   * @returns {Promise<Object>} Industrie créée
   */
  async createIndustrie(data) {
    // Valider champs requis
    if (!data.nom || !data.secteur || !data.localisation) {
      throw new Error("nom, secteur et localisation sont requis");
    }

    // Vérifier format email contact
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("Format email invalide");
    }

    return await industrieRepository.create(data);
  }

  /**
   * Met à jour une industrie
   * @param {String} id - ID industrie
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Industrie mise à jour
   */
  async updateIndustrie(id, data) {
    const industrie = await industrieRepository.findById(id);
    if (!industrie) {
      throw new Error("Industrie non trouvée");
    }

    // Vérifier format email si fourni
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("Format email invalide");
    }

    return await industrieRepository.update(id, data);
  }

  /**
   * Supprime une industrie
   * Vérification : pas de nœuds associés
   * @param {String} id - ID industrie
   * @returns {Promise<Object>} Industrie supprimée
   */
  async deleteIndustrie(id) {
    const industrie = await industrieRepository.findById(id);
    if (!industrie) {
      throw new Error("Industrie non trouvée");
    }

    // Vérifier qu'il n'existe pas de nœuds
    const nodeCount = await sensorNodeRepository.countByIndustrie(id);
    if (nodeCount > 0) {
      throw new Error(`Impossible de supprimer : ${nodeCount} nœuds associés`);
    }

    return await industrieRepository.delete(id);
  }
}

module.exports = new IndustrieService();
