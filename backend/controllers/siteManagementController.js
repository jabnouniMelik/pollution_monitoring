/**
 * CONTROLLER : SITE MANAGEMENT
 * Endpoints HTTP pour la gestion des sites industriels
 * RBAC: SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR
 */

const siteManagementService = require("../services/SiteManagementService");
const Site = require("../models/Site");
const Zone = require("../models/Zone");

/**
 * POST /api/sites
 * Crée un nouveau site
 * SUPER_ADMIN → APPROVED immediately
 * HEAD_SUPERVISOR → PENDING (requires SUPER_ADMIN approval)
 */
const createSite = async (req, res, next) => {
  try {
    const { nom, description, localisation, contact, zoneName, pollutants } = req.body;

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: "Champs requis: nom",
      });
    }

    if (!zoneName) {
      return res.status(400).json({
        success: false,
        message: "Champs requis: zoneName (une zone initiale est obligatoire)",
      });
    }

    // industrieId is resolved from the requester's profile — never from the body
    const industrieId = req.user.role === "SUPER_ADMIN"
      ? (req.body.industrieId || req.user.industryId)
      : req.user.industryId;

    if (!industrieId) {
      return res.status(400).json({
        success: false,
        message: req.user.role === "SUPER_ADMIN"
          ? "Champs requis: industrieId"
          : "Votre compte n'est pas associé à une industrie — contactez le Super Admin",
      });
    }

    const isSuperAdmin = req.user.role === "SUPER_ADMIN";
    const approvalStatus = isSuperAdmin ? "APPROVED" : "PENDING";

    const newSite = await siteManagementService.createSite(
      {
        nom,
        industrieId,
        description,
        localisation,
        contact,
        approvalStatus,
        approvalRequestedBy: isSuperAdmin ? null : req.user.userId,
        approvalRequestedAt: isSuperAdmin ? null : new Date(),
        approvedBy: isSuperAdmin ? req.user.userId : null,
        approvedAt: isSuperAdmin ? new Date() : null,
        actif: isSuperAdmin,
        // Initial zone data
        zoneName,
        pollutants: pollutants || [],
      },
      req.user
    );

    res.status(201).json({
      success: true,
      message: isSuperAdmin
        ? `Site ${nom} créé et activé`
        : `Demande de création du site ${nom} envoyée — en attente d'approbation`,
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
    if (req.query.actif !== undefined) filters.actif = req.query.actif === "true";
    if (req.query.approvalStatus) filters.approvalStatus = req.query.approvalStatus;

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
 */
const getSiteById = async (req, res, next) => {
  try {
    const site = await siteManagementService.getSiteById(req.params.id, req.user);
    res.status(200).json({ success: true, data: site });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sites/:id
 */
const updateSite = async (req, res, next) => {
  try {
    const updatedSite = await siteManagementService.updateSite(
      req.params.id, req.body, req.user
    );
    res.status(200).json({ success: true, message: "Site mis à jour", data: updatedSite });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/sites/:id
 */
const deleteSite = async (req, res, next) => {
  try {
    const deletedSite = await siteManagementService.deleteSite(req.params.id, req.user);
    res.status(200).json({ success: true, message: "Site supprimé", data: deletedSite });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/sites/:id/prepare
 * Marque un site comme "en préparation" — nœud capteur assigné (SUPER_ADMIN only)
 */
const prepareSite = async (req, res, next) => {
  try {
    const { sensorNodeId, sensorNodeNote } = req.body;
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: "Site non trouvé" });
    if (site.approvalStatus !== "PENDING") {
      return res.status(400).json({ success: false, message: "Ce site n'est pas en attente" });
    }

    site.approvalStatus = "PREPARING";
    if (sensorNodeNote) site.sensorNodeNote = sensorNodeNote;
    await site.save();

    res.status(200).json({
      success: true,
      message: `Site "${site.nom}" marqué en préparation`,
      data: site,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sites/:id/approve
 * Approuve un site en attente (SUPER_ADMIN only)
 */
const approveSite = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: "Site non trouvé" });
    if (!["PENDING", "PREPARING"].includes(site.approvalStatus)) {
      return res.status(400).json({ success: false, message: "Ce site n'est pas en attente d'approbation" });
    }

    site.approvalStatus = "APPROVED";
    site.approvedBy = req.user.userId;
    site.approvedAt = new Date();
    site.actif = true;
    site.rejectionReason = null;
    await site.save();

    // Also activate the initial zone
    await Zone.updateMany(
      { siteId: site._id, approvalStatus: { $in: ["PENDING", "PREPARING"] } },
      { $set: { approvalStatus: "APPROVED", actif: true, approvedBy: req.user.userId, approvedAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: `Site "${site.nom}" approuvé et activé`,
      data: site,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sites/:id/reject
 * Rejette un site en attente (SUPER_ADMIN only)
 */
const rejectSite = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: "Site non trouvé" });
    if (!["PENDING", "PREPARING"].includes(site.approvalStatus)) {
      return res.status(400).json({ success: false, message: "Ce site n'est pas en attente d'approbation" });
    }

    site.approvalStatus = "REJECTED";
    site.rejectionReason = reason || "Aucune raison fournie";
    site.actif = false;
    await site.save();

    res.status(200).json({
      success: true,
      message: `Site "${site.nom}" rejeté`,
      data: site,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites/pending
 * Liste les sites en attente d'approbation (SUPER_ADMIN only)
 * Includes initial zone data (pollutants)
 * Zones that belong to a pending site are NOT returned separately
 * (they are shown as part of the site request)
 */
const getPendingSites = async (req, res, next) => {
  try {
    const sites = await Site.find({ approvalStatus: { $in: ["PENDING", "PREPARING"] } })
      .populate("approvalRequestedBy", "username email role")
      .populate("industrieId", "nom secteur")
      .sort({ approvalRequestedAt: -1 });

    // Attach initial zone data (pollutants) for each pending site
    const sitesWithZones = await Promise.all(
      sites.map(async (site) => {
        const initialZone = await Zone.findOne({ siteId: site._id })
          .select("nom code pollutants localisation")
          .lean();
        return { ...site.toObject(), initialZone: initialZone || null };
      })
    );

    res.status(200).json({ success: true, data: sitesWithZones, count: sitesWithZones.length });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites/my-requests
 * Liste les demandes de l'utilisateur connecté (HEAD_SUPERVISOR, SITE_SUPERVISOR)
 */
const getMyRequests = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const sites = await Site.find({ approvalRequestedBy: userId })
      .populate("industrieId", "nom secteur")
      .sort({ approvalRequestedAt: -1 });

    const sitesWithZones = await Promise.all(
      sites.map(async (site) => {
        const initialZone = await Zone.findOne({ siteId: site._id })
          .select("nom code pollutants approvalStatus")
          .lean();
        return { ...site.toObject(), initialZone: initialZone || null, type: "site" };
      })
    );

    // Also get standalone zone requests (not initial zones of a site request)
    const pendingSiteIds = sites.map(s => s._id);
    const zones = await Zone.find({
      approvalRequestedBy: userId,
      siteId: { $nin: pendingSiteIds },
    })
      .populate("siteId", "nom")
      .populate("industrieId", "nom secteur")
      .sort({ approvalRequestedAt: -1 });

    const zoneItems = zones.map(z => ({ ...z.toObject(), type: "zone" }));

    const all = [...sitesWithZones, ...zoneItems].sort(
      (a, b) => new Date(b.approvalRequestedAt ?? 0).getTime() - new Date(a.approvalRequestedAt ?? 0).getTime()
    );

    res.status(200).json({ success: true, data: all, count: all.length });
  } catch (error) {
    next(error);
  }
};
const assignSupervisor = async (req, res, next) => {
  try {
    const { supervisorId } = req.body;
    if (!supervisorId) return res.status(400).json({ success: false, message: "supervisorId requis" });
    const updatedSite = await siteManagementService.assignSupervisor(req.params.id, supervisorId, req.user);
    res.status(200).json({ success: true, message: "Superviseur assigné", data: updatedSite });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites/industrie/:industrieId
 */
const getSitesByIndustrie = async (req, res, next) => {
  try {
    const sites = await siteManagementService.getSitesByIndustrie(req.params.industrieId, req.user);
    res.status(200).json({ success: true, data: sites, count: sites.length });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sites/:id/zones-count
 */
const countZones = async (req, res, next) => {
  try {
    const count = await siteManagementService.countZones(req.params.id);
    res.status(200).json({ success: true, data: { siteId: req.params.id, zoneCount: count } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSite, getSites, getSiteById, updateSite, deleteSite,
  approveSite, rejectSite, getPendingSites, prepareSite, getMyRequests,
  assignSupervisor, getSitesByIndustrie, countZones,
};
