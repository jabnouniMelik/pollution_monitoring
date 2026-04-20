// MIDDLEWARE : CHECK ROLE (RBAC)
// Vérifie que l'utilisateur a le rôle requis
// S'utilise APRÈS verifyToken
//
// Usage dans les routes :
// router.get('/endpoint',
//   verifyToken,                          // 1. vérifier JWT
//   checkRole('SUPER_ADMIN', 'HEAD_SUPERVISOR'), // 2. vérifier rôle
//   controller                            // 3. exécuter
// )
//
// Hiérarchie des rôles (du plus au moins privilégié) :
// SUPER_ADMIN > HEAD_SUPERVISOR > SITE_SUPERVISOR > OPERATOR/AUDITOR

// ── Hiérarchie des rôles ──────────────────────────────────────
// Utilisée pour vérifier si un rôle "inclut" les niveaux inférieurs
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 5, // niveau le plus élevé
  HEAD_SUPERVISOR: 4,
  SITE_SUPERVISOR: 3,
  AUDITOR: 2,
  OPERATOR: 1, // niveau le plus bas
};

// ── Permissions par fonctionnalité ───────────────────────────
// Définit quels rôles peuvent faire quoi
// Basé sur le diagramme des cas d'utilisation
const PERMISSIONS = {
  // Gestion des industries et sites
  manage_industries: ["SUPER_ADMIN", "HEAD_SUPERVISOR"],
  // Gestion des nœuds et capteurs
  manage_nodes: ["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"],
  // Gestion des opérateurs
  manage_operators: ["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR"],
  // Gestion des rôles et permissions
  manage_roles: ["SUPER_ADMIN", "HEAD_SUPERVISOR"],
  // Configuration des seuils réglementaires
  configure_thresholds: ["SUPER_ADMIN"],
  // Consultation données temps réel
  view_live_data: [
    "SUPER_ADMIN",
    "HEAD_SUPERVISOR",
    "SITE_SUPERVISOR",
    "OPERATOR",
  ],
  // Consultation historique
  view_history: [
    "SUPER_ADMIN",
    "HEAD_SUPERVISOR",
    "SITE_SUPERVISOR",
    "OPERATOR",
    "AUDITOR",
  ],
  // Acquittement des alertes
  acknowledge_alerts: [
    "SUPER_ADMIN",
    "HEAD_SUPERVISOR",
    "SITE_SUPERVISOR",
    "OPERATOR",
  ],
  // Génération de rapports
  generate_reports: [
    "SUPER_ADMIN",
    "HEAD_SUPERVISOR",
    "SITE_SUPERVISOR",
    "AUDITOR",
  ],
  // Export PDF/CSV
  export_data: ["SUPER_ADMIN", "HEAD_SUPERVISOR", "SITE_SUPERVISOR", "AUDITOR"],
  // Calibration des capteurs
  calibrate_sensors: [
    "SUPER_ADMIN",
    "HEAD_SUPERVISOR",
    "SITE_SUPERVISOR",
    "OPERATOR",
  ],
};

// ── Middleware : Vérifier le rôle ─────────────────────────────
// Accepte un ou plusieurs rôles autorisés
// Exemple : checkRole('SUPER_ADMIN', 'HEAD_SUPERVISOR')
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    console.log(`[CHECK ROLE] ${req.method} ${req.path} - Allowed: ${allowedRoles.join(",")}`);
    
    // req.user est défini par verifyToken
    if (!req.user) {
      console.log(`[CHECK ROLE] ❌ No req.user for ${req.path}`);
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    const userRole = req.user.role;
    console.log(`[CHECK ROLE] User role: ${userRole}`);

    // Vérifier si le rôle de l'utilisateur est dans la liste
    if (!allowedRoles.includes(userRole)) {
      console.log(`[CHECK ROLE] ❌ Access denied: ${userRole} not in [${allowedRoles.join(",")}]`);
      return res.status(403).json({
        success: false,
        message: `Accès refusé — Rôle requis : ${allowedRoles.join(" ou ")}`,
        yourRole: userRole,
      });
    }

    console.log(`[CHECK ROLE] ✅ Access granted for ${userRole}`);
    next();
  };
};

// ── Middleware : Vérifier par niveau hiérarchique ─────────────
// Autorise tous les rôles >= au niveau minimum requis
// Exemple : checkMinRole('SITE_SUPERVISOR')
// → autorise SITE_SUPERVISOR, HEAD_SUPERVISOR, SUPER_ADMIN
const checkMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const minLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < minLevel) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé — Niveau minimum requis : ${minRole}`,
      });
    }

    next();
  };
};

// ── Middleware : Vérifier la zone (OPERATOR) ──────────────────
// Un OPERATOR ne peut accéder qu'aux données de sa zone
// Les autres rôles ont accès à tout (zone = null)
const checkZone = (req, res, next) => {
  const { role, zone } = req.user;

  // Si pas OPERATOR → accès global, pas de restriction
  if (role !== "OPERATOR") return next();

  // OPERATOR sans zone assignée → accès refusé
  if (!zone) {
    return res.status(403).json({
      success: false,
      message: "Opérateur sans zone assignée — contactez votre superviseur",
    });
  }

  // Ajouter le filtre de zone dans la requête
  // Les controllers l'utiliseront pour filtrer les données
  req.zoneFilter = zone;
  next();
};

// ── Middleware : Vérifier une permission spécifique ───────────
// Basé sur la table PERMISSIONS définie plus haut
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    const allowedRoles = PERMISSIONS[permission] || [];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Permission refusée : ${permission}`,
        yourRole: req.user.role,
      });
    }

    next();
  };
};

module.exports = {
  checkRole,
  checkMinRole,
  checkZone,
  checkPermission,
  PERMISSIONS,
  ROLE_HIERARCHY,
};
