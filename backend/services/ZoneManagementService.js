/**
 * SERVICE : ZONE MANAGEMENT
 * Logique métier pour la gestion des zones de monitoring
 * Hierarchie: Site → Zone → SensorNode
 */

const zoneRepository = require("../repositories/ZoneRepository");
const siteRepository = require("../repositories/SiteRepository");
const userRepository = require("../repositories/UserRepository");

class ZoneManagementService {
  /**
   * Crée une nouvelle zone (SITE_SUPERVISOR ou HEAD_SUPERVISOR)
   * @param {Object} data - { code, nom, siteId, industrieId, description, localisation }
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Zone créée
   */
  async createZone(data, requester) {
    const { code, nom, siteId, industrieId, description, localisation } = data;

    // Vérifier permissions
    if (!["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(requester.role)) {
      throw new Error("Autorisation insuffisante pour créer des zones");
    }

    // Valider champs requis
    if (!code || !nom || !siteId || !industrieId) {
      throw new Error("code, nom, siteId et industrieId requis");
    }

    // Vérifier que le site existe
    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new Error("Site non trouvé");
    }

    // Vérifier que site et industrieId correspondent
    if (site.industrieId.toString() !== industrieId) {
      throw new Error("Site et industrieId ne correspondent pas");
    }

    // Vérifier les droits d'accès selon le rôle
    if (requester.role === "SITE_SUPERVISOR") {
      // SITE_SUPERVISOR peut créer des zones uniquement dans ses sites
      if (site.supervisorId.toString() !== requester._id.toString()) {
        throw new Error("Vous ne pouvez créer des zones que dans vos propres sites");
      }
    } else if (requester.role === "HEAD_SUPERVISOR") {
      // HEAD_SUPERVISOR peut créer des zones dans l'industrie qu'il supervise
      if (site.industrieId.toString() !== requester.industryId.toString()) {
        throw new Error("Vous ne pouvez créer des zones que dans votre industrie");
      }
    }
    // SUPER_ADMIN peut créer partout

    // Créer la zone
    const zone = await zoneRepository.create({
      code,
      nom,
      siteId,
      industrieId,
      description: description || null,
      localisation: localisation || null,
      operatorsAssigned: [],
      actif: true,
    });

    return zone;
  }

  /**
   * Récupère toutes les zones (avec filtrage par rôle)
   * @param {Object} requester - Utilisateur qui fait la requête
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Array>} Zones
   */
  async getZones(requester, filters = {}) {
    let query = { ...filters };

    if (requester.role === "SUPER_ADMIN") {
      return await zoneRepository.findAll(query);
    } else if (requester.role === "HEAD_SUPERVISOR") {
      query.industrieId = requester.industryId;
      return await zoneRepository.findAll(query);
    } else if (requester.role === "SITE_SUPERVISOR") {
      // Récupérer les sites supervisés par ce SITE_SUPERVISOR
      const supervisedSites = await siteRepository.findBySupervisor(requester._id);
      const siteIds = supervisedSites.map(s => s._id);
      query.siteId = { $in: siteIds };
      return await zoneRepository.findAll(query);
    } else if (requester.role === "OPERATOR") {
      // OPERATOR voit les zones assignées
      return await zoneRepository.findByOperator(requester._id);
    }

    throw new Error("Accès refusé");
  }

  /**
   * Récupère une zone par ID
   * @param {String} zoneId - ID zone
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Zone
   */
  async getZoneById(zoneId, requester) {
    const zone = await zoneRepository.findById(zoneId);
    if (!zone) {
      throw new Error("Zone non trouvée");
    }

    // Vérifier autorisation
    if (requester.role === "SUPER_ADMIN") {
      return zone;
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (zone.industrieId.toString() !== requester.industryId.toString()) {
        throw new Error("Accès refusé");
      }
      return zone;
    } else if (requester.role === "SITE_SUPERVISOR") {
      const site = await siteRepository.findById(zone.siteId);
      if (site.supervisorId.toString() !== requester._id.toString()) {
        throw new Error("Accès refusé");
      }
      return zone;
    } else if (requester.role === "OPERATOR") {
      // Vérifier que l'opérateur est assigné à cette zone
      if (!zone.operatorsAssigned.some(id => id.toString() === requester._id.toString())) {
        throw new Error("Accès refusé");
      }
      return zone;
    }

    throw new Error("Accès refusé");
  }

  /**
   * Met à jour une zone
   * @param {String} zoneId - ID zone
   * @param {Object} updateData - Données à mettre à jour
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Zone mise à jour
   */
  async updateZone(zoneId, updateData, requester) {
    const zone = await this.getZoneById(zoneId, requester);

    // SITE_SUPERVISOR peut modifier les zones de ses sites
    // HEAD_SUPERVISOR peut modifier les zones de son industrie
    if (
      !["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(
        requester.role
      )
    ) {
      throw new Error("Autorisation insuffisante");
    }

    const allowedFields = ["code", "nom", "description", "localisation", "actif"];
    const filteredData = {};

    for (const field of allowedFields) {
      if (field in updateData) {
        filteredData[field] = updateData[field];
      }
    }

    const updatedZone = await zoneRepository.update(zoneId, filteredData);
    return updatedZone;
  }

  /**
   * Supprime une zone (avec vérification qu'elle n'a pas de capteurs)
   * @param {String} zoneId - ID zone
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Zone supprimée
   */
  async deleteZone(zoneId, requester) {
    if (requester.role !== "SUPER_ADMIN") {
      throw new Error("Seul le SUPER_ADMIN peut supprimer des zones");
    }

    const zone = await zoneRepository.findById(zoneId);
    if (!zone) {
      throw new Error("Zone non trouvée");
    }

    // Vérifier qu'il n'y a pas de capteurs actifs
    const canDelete = await zoneRepository.canDelete(zoneId);
    if (!canDelete) {
      throw new Error("Impossible de supprimer une zone qui contient des capteurs");
    }

    return await zoneRepository.delete(zoneId);
  }

  /**
   * Assigne un opérateur à une zone
   * @param {String} zoneId - ID zone
   * @param {String} operatorId - ID opérateur
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Zone mise à jour
   */
  async assignOperator(zoneId, operatorId, requester) {
    const zone = await this.getZoneById(zoneId, requester);

    // Seul SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR peuvent assigner
    if (
      !["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(
        requester.role
      )
    ) {
      throw new Error("Autorisation insuffisante");
    }

    // Vérifier que l'opérateur existe
    const operator = await userRepository.findById(operatorId);
    if (!operator || operator.role !== "OPERATOR") {
      throw new Error("Opérateur non trouvé ou n'est pas OPERATOR");
    }

    return await zoneRepository.addOperator(zoneId, operatorId);
  }

  /**
   * Retire un opérateur d'une zone
   * @param {String} zoneId - ID zone
   * @param {String} operatorId - ID opérateur
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Object>} Zone mise à jour
   */
  async removeOperator(zoneId, operatorId, requester) {
    const zone = await this.getZoneById(zoneId, requester);

    // Seul SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR peuvent retirer
    if (
      !["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(
        requester.role
      )
    ) {
      throw new Error("Autorisation insuffisante");
    }

    return await zoneRepository.removeOperator(zoneId, operatorId);
  }

  /**
   * Récupère les zones d'un site
   * @param {String} siteId - ID site
   * @param {Object} requester - Utilisateur qui fait la requête
   * @returns {Promise<Array>} Zones du site
   */
  async getZonesBySite(siteId, requester) {
    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new Error("Site non trouvé");
    }

    // Vérifier autorisation
    if (requester.role === "SUPER_ADMIN") {
      return await zoneRepository.findBySite(siteId);
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (site.industrieId.toString() !== requester.industryId.toString()) {
        throw new Error("Accès refusé");
      }
      return await zoneRepository.findBySite(siteId);
    } else if (requester.role === "SITE_SUPERVISOR") {
      if (site.supervisorId.toString() !== requester._id.toString()) {
        throw new Error("Accès refusé");
      }
      return await zoneRepository.findBySite(siteId);
    }

    throw new Error("Accès refusé");
  }

  /**
   * Compte les capteurs d'une zone
   * @param {String} zoneId - ID zone
   * @returns {Promise<Number>} Nombre de capteurs
   */
  async countSensors(zoneId) {
    return await zoneRepository.countSensors(zoneId);
  }
}

module.exports = new ZoneManagementService();
