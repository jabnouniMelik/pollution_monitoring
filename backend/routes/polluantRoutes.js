// ROUTES : POLLUANT
// Base URL : /api/polluants
//
// GET    /api/polluants                → liste tous les polluants
// GET    /api/polluants/:id            → détail d'un polluant
// POST   /api/polluants                → créer un polluant
// PUT    /api/polluants/:id            → modifier un polluant
// PATCH  /api/polluants/:id/seuils     → modifier les seuils
// DELETE /api/polluants/:id            → supprimer un polluant

const express = require("express");
const router = express.Router();
const {
  getAllPolluants,
  getPolluantById,
  createPolluant,
  updatePolluant,
  updateSeuils,
  deletePolluant,
} = require("../controllers/polluantController");
const { validatePolluant } = require("../middleware/validators");

router.route("/").get(getAllPolluants).post(validatePolluant, createPolluant);
router
  .route("/:id")
  .get(getPolluantById)
  .put(validatePolluant, updatePolluant)
  .delete(deletePolluant);
router.route("/:id/seuils").patch(updateSeuils); //route spécial pour les euils uniquement

module.exports = router;
