/**
 * CONTROLLER : INDUSTRIE
 * Gère toutes les opérations HTTP pour les industries
 * Logique métier déléguée à IndustrieService
 */

const industrieService = require("../services/IndustrieService");
const { error_messages, success_messages } = require("../utils/constants");

// ── GET /api/industries ──────────────────────────────────
// Retourne toutes les industries avec filtres optionnels
const getAllIndustries = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.actif !== undefined) {
      filter.actif = req.query.actif === "true";
    }
    if (req.query.secteur) {
      filter.secteur = req.query.secteur;
    }

    const industries = await industrieService.getAllIndustries(filter);

    res.status(200).json({
      success: true,
      count: industries.length,
      data: industries,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/industries/:id ──────────────────────────────
// Retourne une industrie avec le nombre de nœuds associés
const getIndustriesById = async (req, res, next) => {
  try {
    const industrie = await industrieService.getIndustrieById(req.params.id);

    res.status(200).json({
      success: true,
      data: industrie,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/industries ─────────────────────────────────
// Crée une nouvelle industrie
const createIndustrie = async (req, res, next) => {
  try {
    const industrie = await industrieService.createIndustrie(req.body);

    res.status(201).json({
      success: true,
      message: success_messages.created,
      data: industrie,
    });
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/industries/:id ──────────────────────────────
// Met à jour une industrie
const updateIndustrie = async (req, res, next) => {
  try {
    const industrie = await industrieService.updateIndustrie(
      req.params.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: success_messages.updated,
      data: industrie,
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/industries/:id ───────────────────────────
// Supprime une industrie (vérification: pas de nœuds associés)
const deleteIndustrie = async (req, res, next) => {
  try {
    await industrieService.deleteIndustrie(req.params.id);

    res.status(200).json({
      success: true,
      message: success_messages.deleted,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllIndustries,
  getIndustriesById,
  createIndustrie,
  updateIndustrie,
  deleteIndustrie,
};
