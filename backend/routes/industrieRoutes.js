/**
 * ROUTES : INDUSTRIE
 * Base URL : /api/industries
 *
 * Routes publiques (sans auth) :
 *   POST /api/industries/register  → inscription d'une nouvelle industrie
 *
 * Routes protégées (SUPER_ADMIN) :
 *   GET  /api/industries/pending   → demandes en attente
 *   PATCH /api/industries/:id/prepare → marquer en préparation
 *   POST /api/industries/:id/approve  → approuver + créer comptes/sites/zones
 *   POST /api/industries/:id/reject   → rejeter
 *
 * Routes protégées (authentifié) :
 *   GET    /api/industries         → liste
 *   GET    /api/industries/:id     → détail
 *   POST   /api/industries         → créer (SUPER_ADMIN)
 *   PUT    /api/industries/:id     → modifier (SUPER_ADMIN)
 *   DELETE /api/industries/:id     → supprimer (SUPER_ADMIN)
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { checkRole } = require("../middleware/checkRole");
const {
  getAllIndustries,
  getPendingIndustries,
  getIndustriesById,
  createIndustrie,
  registerIndustrie,
  prepareIndustrie,
  approveIndustrie,
  rejectIndustrie,
  updateIndustrie,
  deleteIndustrie,
} = require("../controllers/industrieController");

// ── Route publique — inscription sans auth ────────────────────
router.post("/register", registerIndustrie);

// ── Routes protégées ──────────────────────────────────────────
router.use(verifyToken);

// Routes spéciales AVANT /:id
router.get("/pending", checkRole("SUPER_ADMIN"), getPendingIndustries);

// CRUD
router.get("/", getAllIndustries);
router.post("/", checkRole("SUPER_ADMIN"), createIndustrie);
router.get("/:id", getIndustriesById);
router.put("/:id", checkRole("SUPER_ADMIN"), updateIndustrie);
router.delete("/:id", checkRole("SUPER_ADMIN"), deleteIndustrie);

// Workflow d'approbation
router.patch("/:id/prepare", checkRole("SUPER_ADMIN"), prepareIndustrie);
router.post("/:id/approve", checkRole("SUPER_ADMIN"), approveIndustrie);
router.post("/:id/reject", checkRole("SUPER_ADMIN"), rejectIndustrie);

module.exports = router;
