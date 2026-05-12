// ============================================================
// MIDDLEWARE : VERIFY TOKEN
// Vérifie le JWT à chaque requête protégée
//
// Fonctionnement :
// 1. Extraire le token du header Authorization
// 2. Vérifier la signature et l'expiration
// 3. Ajouter req.user avec les données décodées
// 4. Passer au middleware suivant (checkRole ou controller)
//
// Si token invalide → 401 Unauthorized
// Si token expiré  → 401 avec message spécifique
// ============================================================

const { verifyAccessToken } = require("../config/jwt");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  try {
    console.log(`[VERIFY TOKEN] ${req.method} ${req.path}`);

    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      console.log(`[VERIFY TOKEN] ❌ No auth header for ${req.path}`);
      return res.status(401).json({ success: false, message: "Accès refusé — Token manquant" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      console.log(`[VERIFY TOKEN] ❌ Invalid token format for ${req.path}`);
      return res.status(401).json({ success: false, message: "Format token invalide — Utiliser : Bearer <token>" });
    }

    const decoded = verifyAccessToken(parts[1]);
    console.log(`[VERIFY TOKEN] ✅ Token valid for user ${decoded.role}`);

    // Fetch full user from DB to get industryId, sitesManaging, zonesAssigned
    // These fields are not in the JWT and can change without re-login
    const dbUser = await User.findById(decoded.userId)
      .select("role industryId sitesManaging zonesAssigned isActive")
      .lean();

    if (!dbUser || dbUser.isActive === false) {
      return res.status(401).json({ success: false, message: "Utilisateur introuvable ou inactif" });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      zone: decoded.zone,
      // Enriched from DB
      industryId: dbUser.industryId ? dbUser.industryId.toString() : null,
      sitesManaging: dbUser.sitesManaging || [],
      zonesAssigned: dbUser.zonesAssigned || [],
    };

    console.log(`[VERIFY TOKEN] ✅ Proceeding — role=${decoded.role} industryId=${req.user.industryId}`);
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.log(`[VERIFY TOKEN] ❌ Token expired for ${req.path}`);
      return res.status(401).json({ success: false, message: "Token expiré — Veuillez vous reconnecter", expired: true });
    }
    console.log(`[VERIFY TOKEN] ❌ Invalid token for ${req.path}: ${error.message}`);
    return res.status(401).json({ success: false, message: "Token invalide" });
  }
};

module.exports = verifyToken;
