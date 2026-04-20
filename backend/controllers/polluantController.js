/**
 * CONTROLLER : POLLUANT
 * Gère toutes les opérations HTTP pour les polluants
 * Logique métier déléguée à PolluantService
 */

const polluantService = require("../services/PolluantService");
const { error_messages, success_messages } = require("../utils/constants");

// ── GET /api/polluants ──────────────────────────────────
// Retourne tous les polluants du référentiel
const getAllPolluants = async (req, res, next) => {
  try {
    const polluants = await polluantService.getAllPolluants();

    res.status(200).json({
      success: true,
      count: polluants.length,
      data: polluants,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/polluants/:id ─────────────────────────────
// Retourne un polluant par ID
const getPolluantById = async (req, res, next) => {
  try {
    const polluant = await polluantService.getPolluantById(req.params.id);

    res.status(200).json({
      success: true,
      data: polluant,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/polluants ────────────────────────────────
// Ajoute un nouveau polluant au référentiel
const createPolluant = async (req, res, next) => {
  try {
    const newPolluant = await polluantService.createPolluant(req.body);

    res.status(201).json({
      success: true,
      data: newPolluant,
      message: success_messages.created,
    });
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/polluants/:id ───────────────────────────────
// Met à jour un polluant
const updatePolluant = async (req, res, next) => {
  try {
    const polluant = await polluantService.updatePolluant(
      req.params.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: success_messages.updated,
      data: polluant,
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/polluants/:id/seuils ────────────────────
// Met à jour uniquement les seuils réglementaires
const updateSeuils = async (req, res, next) => {
  try {
    const { regulatoryLimit, warningThreshold } = req.body;

    const polluant = await polluantService.updateSeuils(
      req.params.id,
      regulatoryLimit,
      warningThreshold,
    );

    res.status(200).json({
      success: true,
      message: "Seuils mis à jour avec succès",
      data: {
        name: polluant.name,
        regulatoryLimit: polluant.regulatoryLimit,
        warningThreshold: polluant.warningThreshold,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/polluants/:id ──────────────────────────
// Supprime un polluant du référentiel
const deletePolluant = async (req, res, next) => {
  try {
    await polluantService.deletePolluant(req.params.id);

    res.status(200).json({
      success: true,
      message: success_messages.deleted,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPolluants,
  getPolluantById,
  createPolluant,
  updatePolluant,
  updateSeuils,
  deletePolluant,
};
