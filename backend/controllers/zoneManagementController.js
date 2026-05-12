/**
 * CONTROLLER : ZONE MANAGEMENT
 * Endpoints HTTP pour la gestion des zones de monitoring
 * RBAC: SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR, OPERATOR
 */

const zoneManagementService = require("../services/ZoneManagementService");
const Zone = require("../models/Zone");

/**
 * POST /api/zones
 * Crée une nouvelle zone
 * industrieId is resolved automatically from the site — never required in body
 */
const createZone = async (req, res, next) => {
  try {
    const { code, nom, siteId, description, localisation, pollutants } = req.body;

    if (!nom || !siteId) {
      return res.status(400).json({
        success: false,
        message: "Champs requis: nom, siteId",
      });
    }

    // Resolve industrieId from the site
    const Site = require("../models/Site");
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ success: false, message: "Site non trouvé" });
    }
    const industrieId = site.industrieId.toString();

    // Auto-generate code from nom if not provided
    const resolvedCode = (code || nom)
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 20);

    const isSuperAdmin = req.user.role === "SUPER_ADMIN";
    const approvalStatus = isSuperAdmin ? "APPROVED" : "PENDING";

    const newZone = await zoneManagementService.createZone(
      {
        code: resolvedCode,
        nom,
        siteId,
        industrieId,
        description,
        localisation: localisation || site.localisation || null,  // inherit site location
        pollutants: pollutants || [],
        approvalStatus,
        approvalRequestedBy: isSuperAdmin ? null : req.user.userId,
        approvalRequestedAt: isSuperAdmin ? null : new Date(),
        approvedBy: isSuperAdmin ? req.user.userId : null,
        approvedAt: isSuperAdmin ? new Date() : null,
        actif: isSuperAdmin,
      },
      req.user
    );

    res.status(201).json({
      success: true,
      message: isSuperAdmin
        ? `Zone ${nom} créée et activée`
        : `Demande de création de la zone ${nom} envoyée — en attente d'approbation`,
      data: newZone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones
 */
const getZones = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.siteId) filters.siteId = req.query.siteId;
    if (req.query.industrieId) filters.industrieId = req.query.industrieId;
    if (req.query.actif !== undefined) filters.actif = req.query.actif === "true";
    if (req.query.approvalStatus) filters.approvalStatus = req.query.approvalStatus;

    const zones = await zoneManagementService.getZones(req.user, filters);
    res.status(200).json({ success: true, data: zones, count: zones.length });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones/:id
 */
const getZoneById = async (req, res, next) => {
  try {
    const zone = await zoneManagementService.getZoneById(req.params.id, req.user);
    res.status(200).json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/zones/:id
 */
const updateZone = async (req, res, next) => {
  try {
    const updatedZone = await zoneManagementService.updateZone(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, message: "Zone mise à jour", data: updatedZone });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/zones/:id
 */
const deleteZone = async (req, res, next) => {
  try {
    const deletedZone = await zoneManagementService.deleteZone(req.params.id, req.user);
    res.status(200).json({ success: true, message: "Zone supprimée", data: deletedZone });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/zones/:id/approve
 * Approuve une zone en attente (SUPER_ADMIN only)
 */
const approveZone = async (req, res, next) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: "Zone non trouvée" });
    if (!["PENDING", "PREPARING"].includes(zone.approvalStatus)) {
      return res.status(400).json({ success: false, message: "Cette zone n'est pas en attente d'approbation" });
    }

    zone.approvalStatus = "APPROVED";
    zone.approvedBy = req.user.userId;
    zone.approvedAt = new Date();
    zone.actif = true;
    zone.rejectionReason = null;
    await zone.save();

    res.status(200).json({
      success: true,
      message: `Zone "${zone.nom}" approuvée et activée`,
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/zones/:id/reject
 * Rejette une zone en attente (SUPER_ADMIN only)
 */
const rejectZone = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const zone = await Zone.findById(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: "Zone non trouvée" });
    if (!["PENDING", "PREPARING"].includes(zone.approvalStatus)) {
      return res.status(400).json({ success: false, message: "Cette zone n'est pas en attente d'approbation" });
    }

    zone.approvalStatus = "REJECTED";
    zone.rejectionReason = reason || "Aucune raison fournie";
    zone.actif = false;
    await zone.save();

    res.status(200).json({
      success: true,
      message: `Zone "${zone.nom}" rejetée`,
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones/pending
 * Liste les zones PENDING + PREPARING (SUPER_ADMIN only)
 * Excludes zones whose parent site is also PENDING/PREPARING
 * (those are shown as part of the site request, not separately)
 */
const getPendingZones = async (req, res, next) => {
  try {
    // Find all pending/preparing sites to exclude their initial zones
    const pendingSiteIds = await require("../models/Site")
      .find({ approvalStatus: { $in: ["PENDING", "PREPARING"] } })
      .select("_id")
      .lean()
      .then(sites => sites.map(s => s._id));

    // Only return zones that are NOT the initial zone of a pending site
    const zones = await Zone.find({
      approvalStatus: { $in: ["PENDING", "PREPARING"] },
      siteId: { $nin: pendingSiteIds },  // exclude zones belonging to pending sites
    })
      .populate("approvalRequestedBy", "username email role")
      .populate("siteId", "nom localisation")
      .populate("industrieId", "nom secteur")
      .sort({ approvalRequestedAt: -1 });

    res.status(200).json({ success: true, data: zones, count: zones.length });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/zones/:id/prepare
 * Marque une zone comme "en préparation" — nœud capteur assigné (SUPER_ADMIN only)
 */
const prepareZone = async (req, res, next) => {
  try {
    const { sensorNodeNote } = req.body;
    const zone = await Zone.findById(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: "Zone non trouvée" });
    if (zone.approvalStatus !== "PENDING") {
      return res.status(400).json({ success: false, message: "Cette zone n'est pas en attente" });
    }

    zone.approvalStatus = "PREPARING";
    if (sensorNodeNote) zone.sensorNodeNote = sensorNodeNote;
    await zone.save();

    res.status(200).json({
      success: true,
      message: `Zone "${zone.nom}" marquée en préparation`,
      data: zone,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/zones/:id/operators
 */
const assignOperator = async (req, res, next) => {
  try {
    const { operatorId } = req.body;
    if (!operatorId) return res.status(400).json({ success: false, message: "operatorId requis" });
    const updatedZone = await zoneManagementService.assignOperator(req.params.id, operatorId, req.user);
    res.status(200).json({ success: true, message: "Opérateur assigné à la zone", data: updatedZone });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/zones/:id/operators/:operatorId
 */
const removeOperator = async (req, res, next) => {
  try {
    const updatedZone = await zoneManagementService.removeOperator(req.params.id, req.params.operatorId, req.user);
    res.status(200).json({ success: true, message: "Opérateur retiré de la zone", data: updatedZone });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones/site/:siteId
 */
const getZonesBySite = async (req, res, next) => {
  try {
    const zones = await zoneManagementService.getZonesBySite(req.params.siteId, req.user);
    res.status(200).json({ success: true, data: zones, count: zones.length });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/zones/:id/sensors-count
 */
const countSensors = async (req, res, next) => {
  try {
    const count = await zoneManagementService.countSensors(req.params.id);
    res.status(200).json({ success: true, data: { zoneId: req.params.id, sensorCount: count } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createZone, getZones, getZoneById, updateZone, deleteZone,
  approveZone, rejectZone, getPendingZones, prepareZone,
  assignOperator, removeOperator, getZonesBySite, countSensors,
};
