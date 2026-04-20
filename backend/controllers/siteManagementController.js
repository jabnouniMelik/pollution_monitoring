/**
 * CONTROLLER : SITE MANAGEMENT
 * Endpoints HTTP pour la gestion des sites industriels
 * RBAC: SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR
 */

const siteManagementService = require("../services/SiteManagementService");

/**
 * POST /api/sites
 * Crée un nouveau site (SUPER_ADMIN, HEAD_SUPERVISOR)
 */
const createSite = async (req, res, next) => {
  try {
    const { nom, industrieId, supervisorId, localisation, contact } = req.body;

    if (!nom || !industrieId || !supervisorId) {
      return res.status(400).json({
        success: false,
        message: "Champs requis: nom, industrieId, supervisorId",
      });
    }

    const newSite = await siteManagementService.createSite(
      { nom, industrieId, supervisorId, localisation, contact },
      req.user
    );

    res.status(201).json({
      success: true,
      message: `Site ${nom} créé`,
      data: newSite,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites
 * Récupère les sites (filtrage selon rôle)
 */
const getSites = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.industrieId) filters.industrieId = req.query.industrieId;
    if (req.query.actif) filters.actif = req.query.actif === "true";

    const sites = await siteManagementService.getSites(req.user, filters);

    res.status(200).json({
      success: true,
      data: sites,
      count: sites.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites/:id
 * Récupère un site par ID
 */
const getSiteById = async (req, res, next) => {
  try {
    const site = await siteManagementService.getSiteById(req.params.id, req.user);

    res.status(200).json({
      success: true,
      data: site,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sites/:id
 * Met à jour un site
 */
const updateSite = async (req, res, next) => {
  try {
    const updatedSite = await siteManagementService.updateSite(
      req.params.id,
      req.body,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Site mis à jour",
      data: updatedSite,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sites/:id
 * Supprime un site (SUPER_ADMIN only)
 */
const deleteSite = async (req, res, next) => {
  try {
    const deletedSite = await siteManagementService.deleteSite(
      req.params.id,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Site supprimé",
      data: deletedSite,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sites/:id/supervisor
 * Assigne un nouveau superviseur (SUPER_ADMIN only)
 */
const assignSupervisor = async (req, res, next) => {
  try {
    const { supervisorId } = req.body;

    if (!supervisorId) {
      return res.status(400).json({
        success: false,
        message: "supervisorId requis",
      });
    }

    const updatedSite = await siteManagementService.assignSupervisor(
      req.params.id,
      supervisorId,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Superviseur assigné",
      data: updatedSite,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites/industrie/:industrieId
 * Récupère les sites d'une industrie
 */
const getSitesByIndustrie = async (req, res, next) => {
  try {
    const sites = await siteManagementService.getSitesByIndustrie(
      req.params.industrieId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: sites,
      count: sites.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites/:id/zones-count
 * Compte les zones d'un site
 */
const countZones = async (req, res, next) => {
  try {
    const count = await siteManagementService.countZones(req.params.id);

    res.status(200).json({
      success: true,
      data: { siteId: req.params.id, zoneCount: count },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSite,
  getSites,
  getSiteById,
  updateSite,
  deleteSite,
  assignSupervisor,
  getSitesByIndustrie,
  countZones,
};
