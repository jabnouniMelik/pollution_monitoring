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
    const {
      code, nom, siteId, industrieId, description, localisation,
      pollutants, approvalStatus, actif,
      approvalRequestedBy, approvalRequestedAt, approvedBy, approvedAt,
    } = data;

    // Permission check
    if (!["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"].includes(requester.role)) {
      throw new Error("Autorisation insuffisante pour créer des zones");
    }

    // Required fields (code and industrieId are already resolved by the controller)
    if (!nom || !siteId || !industrieId) {
      throw new Error("nom, siteId et industrieId requis");
    }

    // Verify site exists
    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw new Error("Site non trouvé");
    }

    // site.industrieId may be a populated object (from repository) or a raw ObjectId
    const siteIndustrieId = (site.industrieId?._id || site.industrieId)?.toString();

    // Verify site belongs to the given industry
    if (siteIndustrieId !== industrieId) {
      throw new Error("Site et industrieId ne correspondent pas");
    }

    // Role-based access check
    if (requester.role === "SITE_SUPERVISOR") {
      const supervisorId = (site.supervisorId?._id || site.supervisorId)?.toString();
      const requesterId = (requester.userId || requester._id)?.toString();
      if (supervisorId !== requesterId) {
        throw new Error("Vous ne pouvez créer des zones que dans vos propres sites");
      }
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (!requester.industryId) {
        throw new Error("Votre compte n'est pas associé à une industrie");
      }
      if (siteIndustrieId !== requester.industryId.toString()) {
        throw new Error("Vous ne pouvez créer des zones que dans votre industrie");
      }
    }

    // Create the zone — pass all fields from controller (approval, actif, pollutants)
    const zone = await zoneRepository.create({
      code,
      nom,
      siteId,
      industrieId,
      description: description || null,
      localisation: localisation || null,
      pollutants: pollutants || [],
      operatorsAssigned: [],
      actif: actif !== undefined ? actif : false,
      approvalStatus: approvalStatus || "PENDING",
      approvalRequestedBy: approvalRequestedBy || null,
      approvalRequestedAt: approvalRequestedAt || null,
      approvedBy: approvedBy || null,
      approvedAt: approvedAt || null,
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
      const requesterId = requester.userId || requester._id;
      const supervisedSites = await siteRepository.findBySupervisor(requesterId);
      const siteIds = supervisedSites.map(s => s._id);
      query.siteId = { $in: siteIds };
      return await zoneRepository.findAll(query);
    } else if (requester.role === "OPERATOR") {
      // OPERATOR voit les zones assignées
      const requesterId = requester.userId || requester._id;
      return await zoneRepository.findByOperator(requesterId);
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
      const zoneIndustrieId = (zone.industrieId?._id || zone.industrieId)?.toString();
      if (zoneIndustrieId !== requester.industryId?.toString()) {
        throw new Error("Accès refusé");
      }
      return zone;
    } else if (requester.role === "SITE_SUPERVISOR") {
      const site = await siteRepository.findById(zone.siteId);
      const supervisorId = (site?.supervisorId?._id || site?.supervisorId)?.toString();
      const requesterId = (requester.userId || requester._id)?.toString();
      if (supervisorId !== requesterId) {
        throw new Error("Accès refusé");
      }
      return zone;
    } else if (requester.role === "OPERATOR") {
      const requesterId = (requester.userId || requester._id)?.toString();
      if (!zone.operatorsAssigned.some(id => id.toString() === requesterId)) {
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

    const siteIndustrieId = (site.industrieId?._id || site.industrieId)?.toString();

    let zones;
    if (requester.role === "SUPER_ADMIN") {
      zones = await zoneRepository.findBySite(siteId);
    } else if (requester.role === "HEAD_SUPERVISOR") {
      if (siteIndustrieId !== requester.industryId?.toString()) {
        throw new Error("Accès refusé");
      }
      zones = await zoneRepository.findBySite(siteId);
    } else if (requester.role === "SITE_SUPERVISOR") {
      const requesterId = (requester.userId || requester._id)?.toString();
      if ((site.supervisorId?._id || site.supervisorId)?.toString() !== requesterId) {
        throw new Error("Accès refusé");
      }
      zones = await zoneRepository.findBySite(siteId);
    } else {
      throw new Error("Accès refusé");
    }

    return this._attachSensorNodeCounts(zones);
  }

  async _attachSensorNodeCounts(zones) {
    if (!zones?.length) return zones;
    const SensorNode = require("../models/SensorNode");
    const zoneIds = zones.map((z) => z._id);
    const grouped = await SensorNode.aggregate([
      { $match: { zoneId: { $in: zoneIds } } },
      { $group: { _id: "$zoneId", sensorNodeCount: { $sum: 1 } } },
    ]);
    const countByZone = new Map(
      grouped.map((g) => [g._id.toString(), g.sensorNodeCount]),
    );

    return zones.map((z) => {
      const plain = z.toObject ? z.toObject() : { ...z };
      return {
        ...plain,
        sensorNodeCount: countByZone.get(z._id.toString()) || 0,
      };
    });
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
