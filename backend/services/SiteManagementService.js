/**
 * SERVICE : SITE MANAGEMENT
 * Logique métier pour la gestion des sites industriels
 * Hierarchie: Industrie → Site → Zone → SensorNode
 */

const siteRepository = require("../repositories/SiteRepository");
const userRepository = require("../repositories/UserRepository");

class SiteManagementService {
  /**
   * Crée un nouveau site (SUPER_ADMIN ou HEAD_SUPERVISOR pour son industrie)
   * @param {Object} data - { nom, industrieId, supervisorId, localisation, contact }
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Site créé
   */
  async createSite(data, requester) {
    const { nom, industrieId, supervisorId, localisation, contact } = data;

    // Vérifier permissions
    if (requester.role === "SUPER_ADMIN") {
      // SUPER_ADMIN peut créer des sites dans n'importe quelle industrie
    } else if (requester.role === "HEAD_SUPERVISOR") {
      // HEAD_SUPERVISOR peut créer des sites uniquement dans son industrie
      if (industrieId !== requester.industryId.toString()) {
        throw new Error("HEAD_SUPERVISOR ne peut créer des sites que dans son industrie");
      }
    } else {
      throw new Error("Seul SUPER_ADMIN et HEAD_SUPERVISOR peuvent créer des sites");
    }

    // Valider champs requis
    if (!nom || !industrieId || !supervisorId) {
      throw new Error("nom, industrieId et supervisorId requis");
    }

    // Vérifier que le superviseur existe et est HEAD_SUPERVISOR
    const supervisor = await userRepository.findById(supervisorId);
    if (!supervisor || supervisor.role !== "HEAD_SUPERVISOR") {
      throw new Error("Superviseur non trouvé ou n'est pas HEAD_SUPERVISOR");
    }

    // Vérifier que l'industrie du superviseur correspond
    if (supervisor.industryId.toString() !== industrieId) {
      throw new Error("Superviseur ne peut superviser que les sites de son industrie");
    }

    // Créer le site
    const site = await siteRepository.create({
      nom,
      industrieId,
      supervisorId,
      localisation: localisation || null,
      contact: contact || null,
      actif: true,
    });

    return site;
  }

  /**
   * Récupère tous les sites (avec filtrage par rôle)
   * @param {Object} requester - Utilisateur qui fait la requête
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Array>} Sites
   */
  async getSites(requester, filters = {}) {
    let query = { ...filters };

    if (requester.role === "SUPER_ADMIN") {
      // Voir tous les sites
      return await siteRepository.findAll(query);
    } else if (requester.role === "HEAD_SUPERVISOR") {
      // Voir uniquement les sites de son industrie
      query.industrieId = requester.industryId;
      return await siteRepository.findAll(query);
    } else if (requester.role === "SITE_SUPERVISOR") {
      // Voir uniquement les sites dont il supervise
      return await siteRepository.findBySupervisor(requester._id);
    } else if (requester.role === "OPERATOR") {
      // L'OPERATOR voit les sites via les zones assignées
      // À implémenter lors de la requête des zones
      throw new Error("Les OPERATOR doivent accéder aux sites via les zones");
    }

    throw new Error("Accès refusé");
  }

  /**
   * Récupère un site par ID
   * @param {String} siteId - ID site
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Site
   */
  async getSiteById(siteId, requester) {
    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new Error("Site non trouvé");
    }

    // Vérifier autorisation
    if (requester.role === "SUPER_ADMIN") {
      return site;
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (site.industrieId.toString() !== requester.industryId.toString()) {
        throw new Error("Accès refusé");
      }
      return site;
    } else if (requester.role === "SITE_SUPERVISOR") {
      if (site.supervisorId.toString() !== requester._id.toString()) {
        throw new Error("Accès refusé");
      }
      return site;
    }

    throw new Error("Accès refusé");
  }

  /**
   * Met à jour un site
   * @param {String} siteId - ID site
   * @param {Object} updateData - Données à mettre à jour
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Site mis à jour
   */
  async updateSite(siteId, updateData, requester) {
    const site = await this.getSiteById(siteId, requester);

    // HEAD_SUPERVISOR peut modifier les sites de son industrie
    // SUPER_ADMIN peut modifier tous les sites
    if (
      requester.role !== "SUPER_ADMIN" &&
      requester.role !== "HEAD_SUPERVISOR"
    ) {
      throw new Error("Autorisation insuffisante");
    }

    const allowedFields = ["nom", "contact", "localisation", "actif"];
    const filteredData = {};

    for (const field of allowedFields) {
      if (field in updateData) {
        filteredData[field] = updateData[field];
      }
    }

    const updatedSite = await siteRepository.update(siteId, filteredData);
    return updatedSite;
  }

  /**
   * Supprime un site (avec vérification qu'il n'a pas de zones)
   * @param {String} siteId - ID site
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Site supprimé
   */
  async deleteSite(siteId, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut supprimer des sites");
    }

    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new Error("Site non trouvé");
    }

    // Vérifier qu'il n'y a pas de zones actives
    const canDelete = await siteRepository.canDelete(siteId);
    if (!canDelete) {
      throw new Error("Impossible de supprimer un site qui contient des zones");
    }

    return await siteRepository.delete(siteId);
  }

  /**
   * Assigne un nouveau superviseur à un site
   * @param {String} siteId - ID site
   * @param {String} supervisorId - ID nouvel superviseur (HEAD_SUPERVISOR)
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Site mis à jour
   */
  async assignSupervisor(siteId, supervisorId, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut assigner des superviseurs");
    }

    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new Error("Site non trouvé");
    }

    const newSupervisor = await userRepository.findById(supervisorId);
    if (!newSupervisor || newSupervisor.role !== "HEAD_SUPERVISOR") {
      throw new Error("Superviseur non trouvé ou n'est pas HEAD_SUPERVISOR");
    }

    // Vérifier que le superviseur et le site sont du même industrie
    if (newSupervisor.industryId.toString() !== site.industrieId.toString()) {
      throw new Error("Superviseur et site doivent être du même industrie");
    }

    return await siteRepository.update(siteId, {
      supervisorId: supervisorId,
    });
  }

  /**
   * Récupère les sites d'une industrie
   * @param {String} industrieId - ID industrie
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Array>} Sites de l'industrie
   */
  async getSitesByIndustrie(industrieId, requester) {
    if (requester.role === "SUPER_ADMIN") {
      return await siteRepository.findByIndustrie(industrieId);
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (industrieId !== requester.industryId.toString()) {
        throw new Error("Accès refusé");
      }
      return await siteRepository.findByIndustrie(industrieId);
    }

    throw new Error("Accès refusé");
  }

  /**
   * Compte les zones d'un site
   * @param {String} siteId - ID site
   * @returns {Promise<Number>} Nombre de zones
   */
  async countZones(siteId) {
    return await siteRepository.countZones(siteId);
  }
}

module.exports = new SiteManagementService();
