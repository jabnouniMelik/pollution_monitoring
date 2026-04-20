// ROUTES : INDUSTRIE
// Définit les endpoints disponibles pour les industries
//
// Base URL : /api/industries
//
// GET    /api/industries         → liste toutes les industries
// GET    /api/industries/:id     → détail d'une industrie
// POST   /api/industries         → créer une industrie
// PUT    /api/industries/:id     → modifier une industrie
// DELETE /api/industries/:id     → supprimer une industrie

const express = require("express");
const router = express.Router();
const {
  getAllIndustries,
  getIndustriesById,
  createIndustrie,
  updateIndustrie,
  deleteIndustrie,
} = require("../controllers/industrieController");
const { validateIndustrie } = require("../middleware/validators");
//Routes sans paramètres
router
  .route("/")
  .get(getAllIndustries)
  .post(validateIndustrie, createIndustrie); //validation avant création
//Routes avec parametre:id
router
  .route("/:id")
  .get(getIndustriesById)
  .put(validateIndustrie, updateIndustrie) //validation avant mise à jour
  .delete(deleteIndustrie);

module.exports = router;
