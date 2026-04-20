// 📝 CODE PATTERNS & EXAMPLES
// Ready-to-use patterns for AI model to generate consistent code
// Last updated: April 2026

// ============================================================
// 1. CONTROLLER PATTERN (Général)
// ============================================================

const { createError } = require("../middleware/errorHandler");
const { error_messages, success_messages } = require("../utils/constants");

const controllerMethod = async (req, res, next) => {
  try {
    // Étape 1: Valider les paramètres
    const { paramName } = req.body;
    if (!paramName) {
      return next(createError(400, "paramName est requis"));
    }

    // Étape 2: Récupérer les données du contexte utilisateur
    const { userId, role } = req.user;

    // Étape 3: Logique métier
    const result = await Model.create({
      field1: value1,
      field2: value2,
    });

    // Étape 4: Réponse standardisée
    return res.status(201).json({
      success: true,
      message: success_messages.created,
      data: result,
    });
  } catch (error) {
    next(createError(500, error_messages.server_error));
  }
};

// ============================================================
// 2. READING INGEST + ALERT ENGINE (LE PLUS IMPORTANT!)
// ============================================================

const ingestReading = async (req, res, next) => {
  try {
    // 1️⃣ EXTRACTION DES DONNÉES
    const { sensorId, polluantId, nodeId, value, unit, rawValue } = req.body;

    // 2️⃣ VALIDATION DE BASE
    if (!sensorId || !polluantId || !nodeId || value === undefined || !unit) {
      return next(
        createError(
          400,
          "Paramètres requis: sensorId, polluantId, nodeId, value, unit",
        ),
      );
    }

    // 3️⃣ VALIDATION DE LA VALEUR (critère de qualité)
    const isValid = value >= 0 && value <= 1000;
    if (!isValid) {
      console.warn(
        `[WARN] Reading invalide: valeur ${value} aberrante (doit être entre 0-1000)`,
      );
      // Continue même si aberrante, mais marquer comme isValid=false
    }

    // 4️⃣ VÉRIFIER QUE LE CAPTEUR EXISTE ET EST ACTIF
    const sensor = await Sensor.findById(sensorId);
    if (!sensor) {
      return next(createError(404, "Capteur non trouvé"));
    }

    // 5️⃣ RÉCUPÉRER LE POLLUANT (pour seuils + unitS)
    const polluant = await Polluant.findById(polluantId);
    if (!polluant) {
      return next(createError(404, "Polluant non trouvé"));
    }

    // 6️⃣ CRÉER LA READING
    const reading = await Reading.create({
      sensorId,
      PolluantId: polluantId,
      nodeId,
      value,
      unit,
      rawValue,
      isValid,
      timestamp: new Date(),
    });

    // 7️⃣ 🚨 MOTEUR D'ALERTES - EXÉCUTÉ AUTOMATIQUEMENT
    const alert = await checkAndCreateAlert(reading, polluant);

    // 8️⃣ RÉPONSE
    return res.status(201).json({
      success: true,
      message: "Reading ingérée avec succès",
      data: {
        reading,
        alert: alert || null, // null si aucun seuil dépassé
      },
    });
  } catch (error) {
    console.error("[ERROR] ingestReading:", error);
    next(createError(500, error_messages.server_error));
  }
};

// ============================================================
// 3. MOTEUR D'ALERTES (FONCTION CRITIQUE)
// ============================================================

const checkAndCreateAlert = async (reading, polluant) => {
  try {
    const readingValue = reading.value;

    // 🎯 LOGIQUE DE GRAVITÉ
    let severity = null;

    // CRITICAL: Dépassement > 150% du seuil réglementaire
    if (readingValue > polluant.regulatoryLimit * 1.5) {
      severity = "Critical";
    }
    // HIGH: Dépassement du seuil réglementaire ANPE
    else if (readingValue > polluant.regulatoryLimit) {
      severity = "High";
    }
    // WARNING: Dépassement du seuil d'avertissement
    else if (readingValue > polluant.warningThreshold) {
      severity = "Warning";
    }

    // Si aucun seuil dépassé → pas d'alerte
    if (!severity) {
      return null;
    }

    // 📊 CALCUL DU POURCENTAGE DE DÉPASSEMENT
    const exceedancePercentage = (
      ((readingValue - polluant.regulatoryLimit) / polluant.regulatoryLimit) *
      100
    ).toFixed(2);

    // 📌 CRÉER L'ALERTE AUTOMATIQUEMENT
    const alert = await Alert.create({
      PolluantId: reading.PolluantId,
      SensorId: reading.sensorId,
      ReadingId: reading._id, // 👈 LIAISON CRITIQUE
      severity,
      type: "Threshold", // Type automatique pour dépassement seuil
      value: reading.value,
      threshold: polluant.regulatoryLimit,
      message: `${polluant.name} dépasse le seuil réglementaire ANPE (NT 106.04) — Dépassement : +${exceedancePercentage}%`,
      timestamp: reading.timestamp,
      isAcknowledged: false,
    });

    console.log(
      `[INFO] Alerte ${severity} créée — ${polluant.name}: ${reading.value} ${reading.unit}`,
    );

    return alert;
  } catch (error) {
    console.error("[ERROR] checkAndCreateAlert:", error);
    return null; // Fail silently pour ne pas bloquer l'ingestion
  }
};

// ============================================================
// 4. GET AVEC RBAC + ZONE RESTRICTION
// ============================================================

const getReadings = async (req, res, next) => {
  try {
    // 👤 Récupérer infos utilisateur (injecté par verifyToken)
    const { userId, role, zone } = req.user;

    // 📋 Récupérer les filtres de la requête
    const { sensorId, dateFrom, dateTo, limit = 50, page = 1 } = req.query;

    // ✅ Validation limite (MAX 100 résultats par page)
    const maxLimit = Math.min(parseInt(limit) || 50, 100);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * maxLimit;

    // 🔨 CONSTRUCTION DU FILTRE
    let filter = {};

    // Ajouter les filtres demandés
    if (sensorId) filter.sensorId = new mongoose.Types.ObjectId(sensorId);
    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
      if (dateTo) filter.timestamp.$lte = new Date(dateTo);
    }

    // 🛑 RESTRICTION PAR ZONE (si OPERATOR)
    if (role === "OPERATOR") {
      if (!zone) {
        return next(
          createError(
            403,
            "Opérateur sans zone assignée — contactez votre superviseur",
          ),
        );
      }
      // Trouver tous les nœuds de sa zone
      const nodesInZone = await SensorNode.find({ zone, Status: "Active" });
      const nodeIds = nodesInZone.map((n) => n._id);
      filter.nodeId = { $in: nodeIds };
    }

    // 📊 EXÉCUTER LA REQUÊTE
    const readings = await Reading.find(filter)
      .populate("sensorId", "type model")
      .populate("PolluantId", "name formula unit")
      .populate("nodeId", "nom zone")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(maxLimit)
      .lean();

    // 📈 COMPTER LE TOTAL
    const total = await Reading.countDocuments(filter);

    // ✅ RÉPONSE
    return res.json({
      success: true,
      data: readings,
      pagination: {
        page: pageNum,
        limit: maxLimit,
        total,
        pages: Math.ceil(total / maxLimit),
      },
    });
  } catch (error) {
    next(createError(500, error_messages.server_error));
  }
};

// ============================================================
// 5. ACKNOWLEDGE ALERT (Acquittement d'alerte)
// ============================================================

const acknowledgeAlert = async (req, res, next) => {
  try {
    const { id: alertId } = req.params;
    const { userId } = req.user; // Injecté par verifyToken

    // Vérifier que l'alerte existe
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return next(createError(404, "Alerte non trouvée"));
    }

    // Vérifier que l'alerte n'est pas déjà acquittée
    if (alert.isAcknowledged) {
      return res.status(400).json({
        success: false,
        message: "Alerte déjà acquittée",
      });
    }

    // Acquitter l'alerte
    alert.isAcknowledged = true;
    alert.acknowledgedby = userId;
    alert.acknowledgedAt = new Date();

    await alert.save();

    return res.json({
      success: true,
      message: "Alerte acquittée avec succès",
      data: alert,
    });
  } catch (error) {
    next(createError(500, error_messages.server_error));
  }
};

// ============================================================
// 6. CREATE AVEC RBAC
// ============================================================

const createPolluant = async (req, res, next) => {
  try {
    // req.user est injecté par verifyToken
    // checkRole("SUPER_ADMIN") middleware a déjà vérifié le rôle

    const {
      name,
      formula,
      unit,
      regulatoryLimit,
      warningThreshold,
      description,
    } = req.body;

    // Validation
    if (!name || !formula || !unit) {
      return next(createError(400, "Champs requis: name, formula, unit"));
    }

    if (warningThreshold >= regulatoryLimit) {
      return next(
        createError(400, "warningThreshold doit être < regulatoryLimit"),
      );
    }

    // Vérifier pas de doublon
    const existing = await Polluant.findOne({ name });
    if (existing) {
      return next(createError(400, error_messages.duplicate));
    }

    // Créer
    const polluant = await Polluant.create({
      name,
      formula,
      unit,
      regulatoryLimit,
      warningThreshold,
      description,
      conversionFactor: 1,
    });

    return res.status(201).json({
      success: true,
      message: success_messages.created,
      data: polluant,
    });
  } catch (error) {
    next(createError(500, error_messages.server_error));
  }
};

// ============================================================
// 7. MIDDLEWARE: VÉRIFIER TOKEN
// ============================================================

//const verifyToken = (req, res, next) => {
try {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Accès refusé — Token manquant",
    });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      message: "Format token invalide — Utiliser : Bearer <token>",
    });
  }

  const token = parts[1];
  const decoded = verifyAccessToken(token); // De config/jwt.js

  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    zone: decoded.zone,
  };

  next();
} catch (error) {
  if (error.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expiré — Veuillez vous reconnecter",
      expired: true,
    });
  }

  return res.status(401).json({
    success: false,
    message: "Token invalide",
  });
}

// ============================================================
// 8. MIDDLEWARE: VÉRIFIER RÔLE (RBAC)
// ============================================================

return (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentification requise",
    });
  }

  const userRole = req.user.role;

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: `Accès refusé — Rôle requis : ${allowedRoles.join(" ou ")}`,
      yourRole: userRole,
    });
  }

  next();
};

// ============================================================
// 9. ROUTE AVEC MIDDLEWARE COMPLET
// ============================================================

// routes/readingRoutes.js
const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");
const {
  ingestReading,
  getReadings,
  getReadingStats,
} = require("../controllers/readingController");

// Public endpoint (no auth needed) - mais validation stricte
router.post("/ingest", ingestReading);

// Protégés par JWT + RBAC
router.get("/", verifyToken, getReadings);

router.get("/stats", verifyToken, getReadingStats);

module.exports = router;

// ============================================================
// 10. ERROR HANDLER MIDDLEWARE
// ============================================================

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Erreur serveur";

  console.error(`[ERROR] ${status}: ${message}`);

  return res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = { createError, errorHandler };

// ============================================================
// 11. VALIDATION HELPER
// ============================================================

const validateReading = (reading) => {
  const errors = [];

  if (!reading.sensorId) errors.push("sensorId manquant");
  if (!reading.polluantId) errors.push("polluantId manquant");
  if (!reading.nodeId) errors.push("nodeId manquant");
  if (!reading.value && reading.value !== 0) errors.push("value manquante");
  if (!reading.unit) errors.push("unit manquante");

  // Vérifier que c'est un ObjectId valide
  if (reading.sensorId && !reading.sensorId.match(/^[0-9a-f]{24}$/i)) {
    errors.push("sensorId ObjectId invalide");
  }

  // Vérifier que value est dans la plage
  if (!(reading.value >= 0 && reading.value <= 1000)) {
    errors.push("value doit être entre 0 et 1000");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ============================================================
// 12. PAGINATION HELPER
// ============================================================

const getPaginationParams = (req, maxLimit = 100) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, maxLimit);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  return { limit, page, skip };
};

// ============================================================
// 13. POPULATE HELPER (pour éviter N+1 queries)
// ============================================================

const findReadingsWithDetails = async (filter = {}, pagination = {}) => {
  const { limit = 50, skip = 0 } = pagination;

  return Reading.find(filter)
    .populate("sensorId", "type model PolluantId") // Inclure PolluantId du capteur
    .populate(
      "PolluantId",
      "name formula unit regulatoryLimit warningThreshold",
    ) // Seuils
    .populate("nodeId", "nom zone localisation") // Localisation
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// ============================================================
// 14. EXPORT/IMPORT HELPER
// ============================================================

const exportReadingsToCSV = (readings) => {
  const csv = [
    "Timestamp,Capteur,Polluant,Valeur,Unité,Zone,Valid",
    ...readings.map(
      (r) =>
        `${r.timestamp.toISOString()},${r.sensorId.model},${r.PolluantId.name},${r.value},${r.unit},${r.nodeId.zone},${r.isValid}`,
    ),
  ].join("\n");

  return csv;
};

// ============================================================
// 15. ALERT STATISTICS
// ============================================================

const getAlertStats = async (dateFrom, dateTo) => {
  const stats = await Alert.aggregate([
    {
      $match: {
        timestamp: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
      },
    },
    {
      $group: {
        _id: "$severity",
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    Critical: stats.find((s) => s._id === "Critical")?.count || 0,
    High: stats.find((s) => s._id === "High")?.count || 0,
    Warning: stats.find((s) => s._id === "Warning")?.count || 0,
  };
};

// ============================================================
// 16. ZONE VALIDATION HELPER
// ============================================================

const checkZoneAccess = async (req, res, next) => {
  const { role, zone } = req.user;

  // Si pas OPERATOR → accès global
  if (role !== "OPERATOR") {
    return next();
  }

  // OPERATOR SANS ZONE ASSIGNÉE
  if (!zone) {
    return res.status(403).json({
      success: false,
      message: "Opérateur sans zone assignée — contactez votre superviseur",
    });
  }

  next();
};

// ============================================================
// 17. USAGE EXAMPLE: ROUTE FILE
// ============================================================

// routes/sensorNodeRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");
const checkZone = require("../middleware/checkZone");
const {
  getSensorNodes,
  createSensorNode,
  updateSensorNodeStatus,
  deleteSensorNode,
} = require("../controllers/sensorNodeController");

// Lecture: Tous (mais OPERATOR filtré par zone)
router.get("/", verifyToken, checkZone, getSensorNodes);

// Création: SITE_SUPERVISOR et plus
router.post(
  "/",
  verifyToken,
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  createSensorNode,
);

// Modification: SITE_SUPERVISOR et plus
router.put(
  "/:id",
  verifyToken,
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"),
  updateSensorNodeStatus,
);

// Suppression: HEAD_SUPERVISOR et plus
router.delete(
  "/:id",
  verifyToken,
  checkRole("SUPER_ADMIN", "HEAD_SUPERVISOR"),
  deleteSensorNode,
);

module.exports = router;

// ============================================================
// 18. GEOSPATIAL QUERY EXAMPLE
// ============================================================

const findSensorNodesNearby = async (
  longitude,
  latitude,
  maxDistanceKm = 5,
) => {
  const maxDistanceMeters = maxDistanceKm * 1000;

  return SensorNode.find({
    localisation: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistanceMeters,
      },
    },
  });
};

// ============================================================
// 19. AGGREGATION EXAMPLE
// ============================================================

const getAveragePollutionByZone = async (pollutantId, dateFrom, dateTo) => {
  return Reading.aggregate([
    {
      $match: {
        PolluantId: new mongoose.Types.ObjectId(pollutantId),
        timestamp: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
      },
    },
    {
      $lookup: {
        from: "sensornodes",
        localField: "nodeId",
        foreignField: "_id",
        as: "node",
      },
    },
    {
      $unwind: "$node",
    },
    {
      $group: {
        _id: "$node.zone",
        avgValue: { $avg: "$value" },
        maxValue: { $max: "$value" },
        minValue: { $min: "$value" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { avgValue: -1 },
    },
  ]);
};

// ============================================================
// 20. BATCH OPERATIONS
// ============================================================

const bulkCreateReadings = async (readingsData) => {
  const insertedReadings = [];
  const alerts = [];

  for (const data of readingsData) {
    try {
      const reading = await Reading.create(data);
      const polluant = await Polluant.findById(data.polluantId);
      const alert = await checkAndCreateAlert(reading, polluant);

      insertedReadings.push(reading);
      if (alert) alerts.push(alert);
    } catch (error) {
      console.error(`[ERROR] Batch creation failed for reading:`, error);
    }
  }

  return { insertedReadings, alerts };
};

// ============================================================
// EXPORT ALL PATTERNS
// ============================================================

module.exports = {
  // Controllers
  ingestReading,
  getReadings,
  acknowledgeAlert,
  createPolluant,
  checkAndCreateAlert,

  // Middleware
  verifyToken,
  checkRole,
  checkZoneAccess,

  // Helpers
  validateReading,
  getPaginationParams,
  findReadingsWithDetails,
  exportReadingsToCSV,
  getAlertStats,
  findSensorNodesNearby,
  getAveragePollutionByZone,
  bulkCreateReadings,
};
