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

const verifyToken = (req, res, next) => {
  try {
    // ── Étape 1 : Extraire le token ───────────────────────────
    console.log(`[VERIFY TOKEN] ${req.method} ${req.path}`);
    
    // Le token arrive dans le header : Authorization: Bearer <token>
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      console.log(`[VERIFY TOKEN] ❌ No auth header for ${req.path}`);
      return res.status(401).json({
        success: false,
        message: "Accès refusé — Token manquant",
      });
    }

    // Le header a le format "Bearer <token>"
    // On split par espace et on prend la 2ème partie
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      console.log(`[VERIFY TOKEN] ❌ Invalid token format for ${req.path}`);
      return res.status(401).json({
        success: false,
        message: "Format token invalide — Utiliser : Bearer <token>",
      });
    }

    const token = parts[1];

    // ── Étape 2 : Vérifier le token ───────────────────────────
    // jwt.verify() lance une erreur si :
    // - La signature ne correspond pas (token falsifié)
    // - Le token est expiré
    // - Le token est malformé
    const decoded = verifyAccessToken(token);
    console.log(`[VERIFY TOKEN] ✅ Token valid for user ${decoded.role}`);

    // ── Étape 3 : Ajouter req.user ────────────────────────────
    // Les controllers accèdent à req.user.userId, req.user.role, etc.
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      zone: decoded.zone,
    };

    // ── Étape 4 : Passer au suivant ───────────────────────────
    console.log(`[VERIFY TOKEN] ✅ Proceeding to next middleware/controller for ${req.path}`);
    next();
  } catch (error) {
    // Token expiré → message spécifique pour que le frontend
    // sache qu'il doit utiliser le refresh token
    if (error.name === "TokenExpiredError") {
      console.log(`[VERIFY TOKEN] ❌ Token expired for ${req.path}`);
      return res.status(401).json({
        success: false,
        message: "Token expiré — Veuillez vous reconnecter",
        expired: true, // flag pour le frontend
      });
    }

    // Token invalide (falsifié, malformé...)
    console.log(`[VERIFY TOKEN] ❌ Invalid token for ${req.path}: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: "Token invalide",
    });
  }
};

module.exports = verifyToken;
