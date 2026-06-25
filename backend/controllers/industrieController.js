/**
 * CONTROLLER : INDUSTRIE
 * Gère les opérations HTTP pour les industries.
 *
 * Deux flux :
 *  1. CRUD classique (SUPER_ADMIN authentifié)
 *  2. Inscription publique (POST /api/industries/register — sans auth)
 *     → crée une demande PENDING traitée via le workflow d'approbation
 */

const Industrie = require("../models/Industrie");
const Site = require("../models/Site");
const Zone = require("../models/Zone");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// ── Helpers ───────────────────────────────────────────────────

/** Génère un mot de passe temporaire aléatoire */
function generateTempPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from(
    { length: 12 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

// ── GET /api/industries ───────────────────────────────────────
const getAllIndustries = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.actif !== undefined)
      filter.actif = req.query.actif === "true";
    if (req.query.secteur) filter.secteur = req.query.secteur;
    if (req.query.approvalStatus)
      filter.approvalStatus = req.query.approvalStatus;

    const industries = await Industrie.find(filter)
      .populate("approvedBy", "username email")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, count: industries.length, data: industries });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/industries/pending ───────────────────────────────
const getPendingIndustries = async (req, res, next) => {
  try {
    const industries = await Industrie.find({
      approvalStatus: { $in: ["PENDING", "PREPARING"] },
    }).sort({ approvalRequestedAt: -1 });

    res
      .status(200)
      .json({ success: true, data: industries, count: industries.length });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/industries/:id ───────────────────────────────────
const getIndustriesById = async (req, res, next) => {
  try {
    const industrie = await Industrie.findById(req.params.id).populate(
      "approvedBy",
      "username email",
    );
    if (!industrie) {
      return res
        .status(404)
        .json({ success: false, message: "Industrie non trouvée" });
    }
    res.status(200).json({ success: true, data: industrie });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/industries ──────────────────────────────────────
// Création directe par SUPER_ADMIN (approuvée immédiatement)
const createIndustrie = async (req, res, next) => {
  try {
    const industrie = await Industrie.create({
      ...req.body,
      approvalStatus: "APPROVED",
      actif: true,
      approvedBy: req.user?.userId || null,
      approvedAt: new Date(),
    });
    res
      .status(201)
      .json({ success: true, message: "Industrie créée", data: industrie });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/industries/register ────────────────────────────
// Inscription publique — sans authentification
// Crée une demande PENDING visible dans la page Approbations du SUPER_ADMIN
const registerIndustrie = async (req, res, next) => {
  try {
    const {
      nom,
      secteur,
      localisation,
      contact,
      matriculeFiscal,
      autorisationAnpe,
      superviseurEmail,
      superviseurNom,
      requestedSites,
      messageInscription,
    } = req.body;

    // Validation minimale
    if (!nom || !secteur || !superviseurEmail) {
      return res.status(400).json({
        success: false,
        message: "Champs requis : nom, secteur, superviseurEmail",
      });
    }

    // Vérifier que l'email superviseur n'est pas déjà utilisé
    const existingUser = await User.findOne({
      email: superviseurEmail.toLowerCase(),
    });
    if (existingUser) {
      console.warn(
        `[registerIndustrie] Email already in use: ${superviseurEmail} (User ID: ${existingUser._id})`,
      );
      return res.status(409).json({
        success: false,
        message:
          "Un compte avec cet email superviseur existe déjà. Veuillez utiliser un email différent ou vous connecter si vous avez déjà un compte.",
        code: "EMAIL_ALREADY_EXISTS",
      });
    }

    // Vérifier qu'une demande en cours n'existe pas déjà pour ce nom
    const existingRequest = await Industrie.findOne({
      nom: { $regex: new RegExp(`^${nom.trim()}$`, "i") },
      approvalStatus: { $in: ["PENDING", "PREPARING"] },
    });
    if (existingRequest) {
      console.warn(
        `[registerIndustrie] Pending registration already exists: "${existingRequest.nom}" (ID: ${existingRequest._id}, Status: ${existingRequest.approvalStatus})`,
      );
      return res.status(409).json({
        success: false,
        message: `Une demande d'inscription pour l'industrie "${existingRequest.nom}" est déjà en cours de traitement. Veuillez patienter ou contacter le support si vous pensez qu'il s'agit d'une erreur.`,
        code: "REGISTRATION_ALREADY_PENDING",
        existingId: existingRequest._id,
      });
    }

    console.log(
      `[registerIndustrie] Creating new registration request for industry: ${nom} with supervisor: ${superviseurEmail}`,
    );

    const industrie = await Industrie.create({
      nom: nom.trim(),
      secteur,
      localisation: localisation || {},
      contact: contact || {},
      matriculeFiscal: matriculeFiscal || null,
      autorisationAnpe: autorisationAnpe || null,
      superviseurEmail: superviseurEmail.toLowerCase().trim(),
      superviseurNom: superviseurNom || null,
      requestedSites: requestedSites || [],
      messageInscription: messageInscription || null,
      approvalStatus: "PENDING",
      approvalRequestedAt: new Date(),
      actif: false,
    });

    res.status(201).json({
      success: true,
      message:
        "Votre demande d'inscription a été soumise avec succès. " +
        "Le Super Administrateur examinera votre dossier et vous contactera à l'adresse fournie.",
      data: {
        id: industrie._id,
        nom: industrie.nom,
        approvalStatus: industrie.approvalStatus,
        approvalRequestedAt: industrie.approvalRequestedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/industries/:id/prepare ────────────────────────
// SUPER_ADMIN marque la demande "en préparation" (visite terrain, etc.)
const prepareIndustrie = async (req, res, next) => {
  try {
    const { adminNote } = req.body;
    const industrie = await Industrie.findById(req.params.id);
    if (!industrie) {
      return res
        .status(404)
        .json({ success: false, message: "Industrie non trouvée" });
    }
    if (industrie.approvalStatus !== "PENDING") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cette demande n'est pas en attente",
        });
    }

    industrie.approvalStatus = "PREPARING";
    if (adminNote) industrie.adminNote = adminNote;
    await industrie.save();

    res.status(200).json({
      success: true,
      message: `Demande "${industrie.nom}" marquée en préparation`,
      data: industrie,
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/industries/:id/approve ─────────────────────────
// SUPER_ADMIN approuve la demande :
//   1. Active l'industrie
//   2. Crée le compte HEAD_SUPERVISOR avec mot de passe temporaire
//   3. Crée les Sites et Zones demandés
const approveIndustrie = async (req, res, next) => {
  try {
    const industrie = await Industrie.findById(req.params.id);
    if (!industrie) {
      return res
        .status(404)
        .json({ success: false, message: "Industrie non trouvée" });
    }
    if (!["PENDING", "PREPARING"].includes(industrie.approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Cette demande n'est pas en attente d'approbation",
      });
    }

    // ── 1. Activer l'industrie ─────────────────────────────────
    industrie.approvalStatus = "APPROVED";
    industrie.actif = true;
    industrie.approvedBy = req.user.userId;
    industrie.approvedAt = new Date();
    industrie.rejectionReason = null;
    await industrie.save();

    // ── 2. Créer le compte HEAD_SUPERVISOR ────────────────────
    let superviseurUser = null;
    let tempPassword = null;

    if (industrie.superviseurEmail) {
      tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      superviseurUser = await User.create({
        username: industrie.superviseurNom
          ? industrie.superviseurNom.toLowerCase().replace(/\s+/g, "_")
          : industrie.superviseurEmail.split("@")[0],
        email: industrie.superviseurEmail,
        password: hashedPassword,
        role: "HEAD_SUPERVISOR",
        industryId: industrie._id,
        isActive: true,
      });
    }

    // ── 3. Créer les Sites et Zones demandés ──────────────────
    const createdSites = [];
    for (const siteReq of industrie.requestedSites || []) {
      const site = await Site.create({
        nom: siteReq.nom,
        industrieId: industrie._id,
        supervisorId: superviseurUser?._id || null,
        description: siteReq.description || null,
        localisation: siteReq.localisation?.latitude
          ? {
              type: "Point",
              coordinates: [
                siteReq.localisation.longitude || 0,
                siteReq.localisation.latitude || 0,
              ],
              ville: siteReq.localisation.ville || null,
              adresse: siteReq.localisation.adresse || null,
            }
          : {
              type: "Point",
              coordinates: [0, 0],
              ville: siteReq.localisation?.ville || null,
              adresse: siteReq.localisation?.adresse || null,
            },
        approvalStatus: "APPROVED",
        actif: true,
        approvedBy: req.user.userId,
        approvedAt: new Date(),
      });

      // Créer les zones du site
      for (const zoneReq of siteReq.zones || []) {
        const zoneCode = zoneReq.nom
          .toUpperCase()
          .replace(/\s+/g, "-")
          .replace(/[^A-Z0-9-]/g, "")
          .slice(0, 20);

        await Zone.create({
          code: zoneCode,
          nom: zoneReq.nom,
          siteId: site._id,
          industrieId: industrie._id,
          description: zoneReq.description || null,
          pollutants: zoneReq.pollutants || [],
          approvalStatus: "APPROVED",
          actif: true,
          approvedBy: req.user.userId,
          approvedAt: new Date(),
        });

        // Incrémenter le compteur de zones du site
        await Site.findByIdAndUpdate(site._id, { $inc: { zoneCount: 1 } });
      }

      createdSites.push(site);
    }

    res.status(200).json({
      success: true,
      message: `Industrie "${industrie.nom}" approuvée et activée`,
      data: {
        industrie,
        superviseurUser: superviseurUser
          ? {
              _id: superviseurUser._id,
              email: superviseurUser.email,
              username: superviseurUser.username,
              role: superviseurUser.role,
              // Mot de passe temporaire — à transmettre au superviseur par email
              tempPassword,
            }
          : null,
        sitesCreated: createdSites.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/industries/:id/reject ──────────────────────────
const rejectIndustrie = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const industrie = await Industrie.findById(req.params.id);
    if (!industrie) {
      return res
        .status(404)
        .json({ success: false, message: "Industrie non trouvée" });
    }
    if (!["PENDING", "PREPARING"].includes(industrie.approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Cette demande n'est pas en attente d'approbation",
      });
    }

    industrie.approvalStatus = "REJECTED";
    industrie.rejectionReason = reason || "Aucune raison fournie";
    industrie.actif = false;
    await industrie.save();

    res.status(200).json({
      success: true,
      message: `Demande "${industrie.nom}" rejetée`,
      data: industrie,
    });
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/industries/:id ───────────────────────────────────
const updateIndustrie = async (req, res, next) => {
  try {
    const industrie = await Industrie.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
    if (!industrie) {
      return res
        .status(404)
        .json({ success: false, message: "Industrie non trouvée" });
    }
    res
      .status(200)
      .json({
        success: true,
        message: "Industrie mise à jour",
        data: industrie,
      });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/industries/:id ────────────────────────────────
const deleteIndustrie = async (req, res, next) => {
  try {
    const industrie = await Industrie.findByIdAndDelete(req.params.id);
    if (!industrie) {
      return res
        .status(404)
        .json({ success: false, message: "Industrie non trouvée" });
    }
    res.status(200).json({ success: true, message: "Industrie supprimée" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
