/**
 * SERVICE : SITE MANAGEMENT
 * Logique métier pour la gestion des sites industriels
 * Hierarchie: Industrie → Site → Zone → SensorNode
 */

const siteRepository = require("../repositories/SiteRepository");
const zoneRepository = require("../repositories/ZoneRepository");
const userRepository = require("../repositories/UserRepository");

class SiteManagementService {
  /**
   * Crée un nouveau site + une zone initiale obligatoire
   * @param {Object} data - { nom, industrieId, zoneName, pollutants, localisation, ... }
   * @param {Object} requester
   */
  async createSite(data, requester) {
    const { nom, industrieId, zoneName, pollutants, localisation, contact, ...rest } = data;

    // Permission check
    if (requester.role === "SUPER_ADMIN") {
      // ok — can create anywhere
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (!requester.industryId) {
        const err = new Error("Votre compte n'est pas associé à une industrie — contactez le Super Admin");
        err.statusCode = 403;
        throw err;
      }
      if (industrieId !== requester.industryId.toString()) {
        const err = new Error("HEAD_SUPERVISOR ne peut créer des sites que dans son industrie");
        err.statusCode = 403;
        throw err;
      }
    } else {
      const err = new Error("Seul SUPER_ADMIN et HEAD_SUPERVISOR peuvent créer des sites");
      err.statusCode = 403;
      throw err;
    }

    if (!nom) {
      const err = new Error("nom requis");
      err.statusCode = 400;
      throw err;
    }

    if (!industrieId) {
      const err = new Error("industrieId introuvable — vérifiez votre profil");
      err.statusCode = 400;
      throw err;
    }

    if (!zoneName) {
      const err = new Error("zoneName requis — un site doit contenir au moins une zone");
      err.statusCode = 400;
      throw err;
    }

    // Create the site (supervisorId is the requester for HEAD_SUPERVISOR)
    const supervisorId = requester.role === "HEAD_SUPERVISOR" ? requester.userId : null;

    const site = await siteRepository.create({
      nom,
      industrieId,
      supervisorId,
      localisation: localisation || null,
      contact: contact || null,
      ...rest,
    });

    // Auto-create the initial zone
    const zoneCode = zoneName
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 20);

    await zoneRepository.create({
      code: zoneCode,
      nom: zoneName,
      siteId: site._id,
      industrieId,
      localisation: localisation || null,  // same location as site
      pollutants: pollutants || [],
      operatorsAssigned: [],
      actif: site.actif,
    });

    // Update zone count
    await siteRepository.update(site._id, { zoneCount: 1 });

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
      const requesterId = requester.userId || requester._id;
      return await siteRepository.findBySupervisor(requesterId);
    } else if (requester.role === "OPERATOR") {
      // L'OPERATOR voit les sites via les zones assignées
      // À implémenter lors de la requête des zones
      const err = new Error(
        "Les OPERATOR doivent accéder aux sites via les zones",
      );
      err.statusCode = 403;
      throw err;
    }

    const err = new Error("Accès refusé");
    err.statusCode = 403;
    throw err;
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
      const err = new Error("Site non trouvé");
      err.statusCode = 404;
      throw err;
    }

    // Vérifier autorisation
    if (requester.role === "SUPER_ADMIN") {
      return site;
    } else if (requester.role === "HEAD_SUPERVISOR") {
      const siteIndustrieId = (site.industrieId?._id || site.industrieId)?.toString();
      if (siteIndustrieId !== requester.industryId?.toString()) {
        const err = new Error("Accès refusé");
        err.statusCode = 403;
        throw err;
      }
      return site;
    } else if (requester.role === "SITE_SUPERVISOR") {
      const supervisorId = (site.supervisorId?._id || site.supervisorId)?.toString();
      const requesterId = (requester.userId || requester._id)?.toString();
      if (supervisorId !== requesterId) {
        const err = new Error("Accès refusé");
        err.statusCode = 403;
        throw err;
      }
      return site;
    }

    const err = new Error("Accès refusé");
    err.statusCode = 403;
    throw err;
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
      const err = new Error("Autorisation insuffisante");
      err.statusCode = 403;
      throw err;
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
      const err = new Error("Seul le SUPER_ADMIN peut supprimer des sites");
      err.statusCode = 403;
      throw err;
    }

    const site = await siteRepository.findById(siteId);
    if (!site) {
      const err = new Error("Site non trouvé");
      err.statusCode = 404;
      throw err;
    }

    // Vérifier qu'il n'y a pas de zones actives
    const canDelete = await siteRepository.canDelete(siteId);
    if (!canDelete) {
      const err = new Error(
        "Impossible de supprimer un site qui contient des zones",
      );
      err.statusCode = 400;
      throw err;
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
      const err = new Error(
        "Seul le SUPER_ADMIN peut assigner des superviseurs",
      );
      err.statusCode = 403;
      throw err;
    }

    const site = await siteRepository.findById(siteId);
    if (!site) {
      const err = new Error("Site non trouvé");
      err.statusCode = 404;
      throw err;
    }

    const newSupervisor = await userRepository.findById(supervisorId);
    if (!newSupervisor || newSupervisor.role !== "HEAD_SUPERVISOR") {
      const err = new Error(
        "Superviseur non trouvé ou n'est pas HEAD_SUPERVISOR",
      );
      err.statusCode = 400;
      throw err;
    }

    // Vérifier que le superviseur et le site sont du même industrie
    if (newSupervisor.industryId.toString() !== site.industrieId.toString()) {
      const err = new Error(
        "Superviseur et site doivent être du même industrie",
      );
      err.statusCode = 400;
      throw err;
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
        const err = new Error("Accès refusé");
        err.statusCode = 403;
        throw err;
      }
      return await siteRepository.findByIndustrie(industrieId);
    }

    const err = new Error("Accès refusé");
    err.statusCode = 403;
    throw err;
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
