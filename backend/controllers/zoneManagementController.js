/**
 * CONTROLLER : ZONE MANAGEMENT
 * Endpoints HTTP pour la gestion des zones de monitoring
 * RBAC: SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR, OPERATOR
 */

const zoneManagementService = require("../services/ZoneManagementService");

/**
 * POST /api/zones
 * Crée une nouvelle zone (SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR)
 */
const createZone = async (req, res, next) => {
  try {
    const { code, nom, siteId, industrieId, description, localisation } = req.body;

    if (!code || !nom || !siteId || !industrieId) {
      return res.status(400).json({
        success: false,
        message: "Champs requis: code, nom, siteId, industrieId",
      });
    }

    const newZone = await zoneManagementService.createZone(
      { code, nom, siteId, industrieId, description, localisation },
      req.user
    );

    res.status(201).json({
      success: true,
      message: `Zone ${nom} créée`,
      data: newZone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones
 * Récupère les zones (filtrage selon rôle)
 */
const getZones = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.siteId) filters.siteId = req.query.siteId;
    if (req.query.industrieId) filters.industrieId = req.query.industrieId;
    if (req.query.actif) filters.actif = req.query.actif === "true";

    const zones = await zoneManagementService.getZones(req.user, filters);

    res.status(200).json({
      success: true,
      data: zones,
      count: zones.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones/:id
 * Récupère une zone par ID
 */
const getZoneById = async (req, res, next) => {
  try {
    const zone = await zoneManagementService.getZoneById(req.params.id, req.user);

    res.status(200).json({
      success: true,
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/zones/:id
 * Met à jour une zone
 */
const updateZone = async (req, res, next) => {
  try {
    const updatedZone = await zoneManagementService.updateZone(
      req.params.id,
      req.body,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Zone mise à jour",
      data: updatedZone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/zones/:id
 * Supprime une zone (SUPER_ADMIN only)
 */
const deleteZone = async (req, res, next) => {
  try {
    const deletedZone = await zoneManagementService.deleteZone(
      req.params.id,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Zone supprimée",
      data: deletedZone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/zones/:id/operators
 * Assigne un opérateur à une zone
 */
const assignOperator = async (req, res, next) => {
  try {
    const { operatorId } = req.body;

    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: "operatorId requis",
      });
    }

    const updatedZone = await zoneManagementService.assignOperator(
      req.params.id,
      operatorId,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Opérateur assigné à la zone",
      data: updatedZone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/zones/:id/operators/:operatorId
 * Retire un opérateur d'une zone
 */
const removeOperator = async (req, res, next) => {
  try {
    const updatedZone = await zoneManagementService.removeOperator(
      req.params.id,
      req.params.operatorId,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Opérateur retiré de la zone",
      data: updatedZone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones/site/:siteId
 * Récupère les zones d'un site
 */
const getZonesBySite = async (req, res, next) => {
  try {
    const zones = await zoneManagementService.getZonesBySite(
      req.params.siteId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: zones,
      count: zones.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones/:id/sensors-count
 * Compte les capteurs d'une zone
 */
const countSensors = async (req, res, next) => {
  try {
    const count = await zoneManagementService.countSensors(req.params.id);

    res.status(200).json({
      success: true,
      data: { zoneId: req.params.id, sensorCount: count },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createZone,
  getZones,
  getZoneById,
  updateZone,
  deleteZone,
  assignOperator,
  removeOperator,
  getZonesBySite,
  countSensors,
};
