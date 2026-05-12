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
      const err = new Error("Industrie non trouvée");
      err.statusCode = 404;
      throw err;
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
      const err = new Error("nom, secteur et localisation sont requis");
      err.statusCode = 400;
      throw err;
    }

    // Vérifier format email contact
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      const err = new Error("Format email invalide");
      err.statusCode = 400;
      throw err;
    }

    // Empêcher les doublons métier sur le nom d'industrie
    const existingIndustries = await industrieRepository.findAll({
      nom: data.nom,
    });
    if (existingIndustries.length > 0) {
      const err = new Error("Industrie déjà existante");
      err.statusCode = 400;
      throw err;
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
      const err = new Error("Industrie non trouvée");
      err.statusCode = 404;
      throw err;
    }

    // Vérifier format email si fourni
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      const err = new Error("Format email invalide");
      err.statusCode = 400;
      throw err;
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
      const err = new Error("Industrie non trouvée");
      err.statusCode = 404;
      throw err;
    }

    // Vérifier qu'il n'existe pas de nœuds
    const nodeCount = await sensorNodeRepository.countByIndustrie(id);
    if (nodeCount > 0) {
      const err = new Error(
        `Impossible de supprimer : ${nodeCount} nœuds associés`,
      );
      err.statusCode = 409;
      throw err;
    }

    return await industrieRepository.delete(id);
  }
}

module.exports = new IndustrieService();
