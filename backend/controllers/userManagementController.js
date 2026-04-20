/**
 * CONTROLLER : USER MANAGEMENT
 * Endpoints HTTP pour la gestion des utilisateurs
 * RBAC: SUPER_ADMIN only pour create/update/delete
 */

const userManagementService = require("../services/UserManagementService");

/**
 * POST /api/users
 * Crée un nouvel utilisateur (SUPER_ADMIN only)
 */
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, role, industryId, sitesManaging, zonesAssigned } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Champs requis: username, email, password, role",
      });
    }

    const newUser = await userManagementService.createUser(
      { username, email, password, role, industryId, sitesManaging, zonesAssigned },
      req.user
    );

    res.status(201).json({
      success: true,
      message: `Utilisateur ${username} créé avec le rôle ${role}`,
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users
 * Récupère les utilisateurs (filtrage selon rôle)
 */
const getUsers = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.role) filters.role = req.query.role;
    if (req.query.industryId) filters.industryId = req.query.industryId;
    if (req.query.isActive) filters.isActive = req.query.isActive === "true";

    const users = await userManagementService.getUsers(req.user, filters);

    res.status(200).json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id
 * Récupère un utilisateur par ID
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userManagementService.getUserById(req.params.id, req.user);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id
 * Met à jour un utilisateur (SUPER_ADMIN only)
 */
const updateUser = async (req, res, next) => {
  try {
    const updatedUser = await userManagementService.updateUser(
      req.params.id,
      req.body,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Utilisateur mis à jour",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id
 * Supprime un utilisateur (SUPER_ADMIN only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const deletedUser = await userManagementService.deleteUser(
      req.params.id,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Utilisateur supprimé",
      data: deletedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/:id/sites
 * Assigne des sites à un HEAD_SUPERVISOR (SUPER_ADMIN only)
 */
const assignSites = async (req, res, next) => {
  try {
    const { siteIds } = req.body;

    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "siteIds doit être un array non-vide",
      });
    }

    const updatedUser = await userManagementService.assignSites(
      req.params.id,
      siteIds,
      req.user
    );

    res.status(200).json({
      success: true,
      message: `${siteIds.length} site(s) assigné(s)`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/:id/zones
 * Assigne des zones à un OPERATOR
 */
const assignZones = async (req, res, next) => {
  try {
    const { zoneIds } = req.body;

    if (!Array.isArray(zoneIds) || zoneIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "zoneIds doit être un array non-vide",
      });
    }

    const updatedUser = await userManagementService.assignZones(
      req.params.id,
      zoneIds,
      req.user
    );

    res.status(200).json({
      success: true,
      message: `${zoneIds.length} zone(s) assignée(s)`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id/role
 * Change le rôle d'un utilisateur (SUPER_ADMIN only)
 */
const changeRole = async (req, res, next) => {
  try {
    const { newRole } = req.body;

    if (!newRole) {
      return res.status(400).json({
        success: false,
        message: "newRole requis",
      });
    }

    const updatedUser = await userManagementService.changeRole(
      req.params.id,
      newRole,
      req.user
    );

    res.status(200).json({
      success: true,
      message: `Rôle changé à ${newRole}`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/role/:role
 * Récupère tous les utilisateurs d'un rôle spécifique
 */
const getUsersByRole = async (req, res, next) => {
  try {
    const users = await userManagementService.getUsersByRole(
      req.params.role,
      req.user
    );

    res.status(200).json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  assignSites,
  assignZones,
  changeRole,
  getUsersByRole,
};
