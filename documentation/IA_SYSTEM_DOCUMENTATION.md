# 📋 DOCUMENTATION SYSTÈME IoT - POLLUTION MONITORING

## Pour Développement du Modèle IA

**Version:** 3.0  
**Date:** Avril 2026  
**Statut:** Production avec MQTT, JWT + RBAC

---

## 🎯 RÉSUMÉ EXÉCUTIF

Système de **surveillance de la pollution atmosphérique en temps réel** pour les zones industrielles tunisiennes, avec:

- **Capteurs IoT** (ESP32) collectant CO₂, SO₂, NOₓ, PM2.5, PM10, COV, température/humidité
- **Moteur d'alertes** automatique comparant aux seuils ANPE (NT 106.04)
- **RBAC complet** (5 rôles: SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR, OPERATOR, AUDITOR)
- **Authentification JWT** avec refresh tokens
- **Rapports réglementaires** exportables en PDF/CSV
- **Protocole MQTT** pour ingestion temps réel

---

## 🏗️ STACK TECHNIQUE

### Backend

```json
{
  "framework": "Express.js 5.2.1",
  "runtime": "Node.js",
  "database": "MongoDB 4.0+",
  "messaging": "MQTT 5.15.1",
  "auth": "JWT (jsonwebtoken 9.0.3)",
  "hashing": "bcryptjs 3.0.3",
  "rate_limiting": "express-rate-limit 8.3.1",
  "validation": "Middleware personnalisé"
}
```

### IoT

```json
{
  "device": "ESP32",
  "protocol": "MQTT",
  "sensors": ["CO2", "SO2", "NOX", "PM2.5", "PM10", "COV", "Temp/Humidity"],
  "communication": "Publish/Subscribe MQTT"
}
```

---

## 📊 MODÈLES DE DONNÉES MONGODB

### 1. **User** (Utilisateurs)

```javascript
{
  _id: ObjectId,
  username: String (unique, required),
  email: String (unique, lowercase, required),
  password: String (bcrypted, minLength: 6),
  role: Enum [
    "SUPER_ADMIN",        // Accès total + config seuils
    "HEAD_SUPERVISOR",    // Gestion sites/nœuds
    "SITE_SUPERVISOR",    // Gestion opérateurs de son site
    "OPERATOR",           // Consultation données de sa zone
    "AUDITOR"             // Génération rapports
  ],
  zone: String | null,      // Zone assignée (OPERATOR only)
  site: String | null,      // Site assigné (SITE_SUPERVISOR)
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Hiérarchie des rôles (du plus au moins privilégié):**

```
SUPER_ADMIN (niveau 5)
  ↓
HEAD_SUPERVISOR (niveau 4)
  ↓
SITE_SUPERVISOR (niveau 3)
  ↓
OPERATOR / AUDITOR (niveaux 1-2)
```

---

### 2. **Industrie** (Sites industriels)

```javascript
{
  _id: ObjectId,
  name: String (required, unique),
  licenseNumber: String (unique),
  sector: String,           // Ex: "Cimenterie", "Raffinerie"
  coordinates: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  zonesCount: Number,       // Nombre de zones
  status: Enum ["Active", "Suspended", "Closed"],
  contactPerson: String,
  phone: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3. **SensorNode** (Nœuds ESP32)

```javascript
{
  _id: ObjectId,
  nom: String (required),
  IndustrieId: ObjectId → Industrie (required),
  localisation: {
    type: "Point",
    coordinates: [longitude, latitude]  // GeoJSON
  },
  zone: String,             // Zone-A, Zone-B, Zone-C (required)
  Status: Enum ["Active", "Inactive"],
  IPAddress: String,
  macAddress: String (unique),
  createdAt: Date,
  updatedAt: Date,

  // Indexes
  "localisation: 2dsphere",  // Recherche géospatiale
  "IndustrieId: 1"
}
```

---

### 4. **Sensor** (Capteurs physiques)

```javascript
{
  _id: ObjectId,
  sensorNodeId: ObjectId → SensorNode (required),
  PolluantId: ObjectId → Polluant (required),
  type: Enum [
    "CO2", "SO2", "NOX", "PM25", "PM10", "COV",
    "TEMPERATURE", "HUMIDITY"
  ],
  model: String (required),  // Ex: "MQ-135", "SDS011", "BME680"
  unit: String (required),   // Ex: "ppm", "µg/m³", "°C", "%"
  calibrationDate: Date,
  driftThreshold: Number,    // Seuil de dérive acceptable
  createdAt: Date,
  updatedAt: Date,

  // Indexes
  "sensorNodeId: 1",
  "polluantId: 1"
}
```

---

### 5. **Polluant** (Polluants/Éléments chimiques)

```javascript
{
  _id: ObjectId,
  name: String (required, unique),     // "Dioxyde d'azote"
  formula: String (required),          // "NO₂"
  unit: String (required),             // "µg/m³"
  regulatoryLimit: Number,             // Seuil réglementaire ANPE
  warningThreshold: Number,            // Seuil d'avertissement (< regulatory)
  description: String,                 // Description scientifique
  conversionFactor: Number (default: 1), // Facteur de conversion capteur
  createdAt: Date,
  updatedAt: Date
}
```

---

### 6. **Reading** (Mesures temps réel) ⭐ MODÈLE CRITIQUE

```javascript
{
  _id: ObjectId,
  sensorId: ObjectId → Sensor (required),
  PolluantId: ObjectId → Polluant (required),
  nodeId: ObjectId → SensorNode (required),
  value: Number (required),            // Valeur convertie (en unité cible)
  unit: String (required),             // Unité finale
  isValid: Boolean (default: false),   // Validation qualité (>= 0 et <= 1000)
  rawValue: Number,                    // Valeur brute avant conversion
  timestamp: Date (default: now),
  createdAt: Date,
  updatedAt: Date,

  // Indexes (CRITIQUES pour performance temps réel)
  "timestamp: -1",                     // Plus récent au plus ancien
  "sensorId: 1, timestamp: -1",       // Filtrer par capteur + date
  "PolluantId: 1, timestamp: -1",     // Filtrer par polluant + date
  "nodeId: 1, timestamp: -1"          // Filtrer par nœud + date
}
```

**Logique de validation:**

```javascript
// Une mesure est valide si:
isValid = value >= 0 && value <= 1000; // Élimine les aberrations
// Valeur négative → erreur capteur
// Valeur > 1000 → saturation capteur probable
```

---

### 7. **Alert** (Alertes automatiques) ⭐ MOTEUR D'ALERTES

```javascript
{
  _id: ObjectId,
  PolluantId: ObjectId → Polluant (required),
  SensorId: ObjectId → Sensor (required),
  ReadingId: ObjectId → Reading (required),
  severity: Enum [
    "Warning",    // Dépassement warningThreshold
    "High",       // Dépassement regulatoryLimit
    "Critical"    // Dépassement regulatoryLimit × 1.5
  ],
  type: Enum [
    "Threshold",   // Dépassement seuil ANPE
    "SensorFault", // Panne ou dérive capteur
    "Anomaly"      // Anomalie statistique détectée
  ],
  value: Number,               // Valeur mesurée
  threshold: Number,           // Seuil déclenché
  message: String,             // Message détaillé (ex: "+23% de dépassement")
  timestamp: Date,
  isAcknowledged: Boolean (default: false),
  acknowledgedby: ObjectId → User,
  acknowledgedAt: Date,
  createdAt: Date,
  updatedAt: Date,

  // Indexes
  "isAcknowledged: 1, severity: 1",   // Alertes non acquittées par gravité
  "timestamp: -1",                     // Chronologie
  "PolluantId: 1, timestamp: -1"       // Alertes par polluant
}
```

---

### 8. **Report** (Rapports réglementaires)

```javascript
{
  _id: ObjectId,
  title: String (required),
  industrie: ObjectId → Industrie (required),
  period: {
    startDate: Date,
    endDate: Date
  },
  pollutants: [
    {
      pollutantId: ObjectId,
      readings: Number,           // Nombre de mesures
      avgValue: Number,           // Moyenne
      maxValue: Number,           // Maximum
      exceedanceCount: Number,    // Jours de dépassement
      exceedancePercentage: Number
    }
  ],
  status: Enum ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
  generatedBy: ObjectId → User,
  generatedAt: Date,
  submittedAt: Date,
  approvedBy: ObjectId → User,
  approvedAt: Date,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 9. **RefreshToken** (Tokens de refresh)

```javascript
{
  _id: ObjectId,
  userId: ObjectId → User (required),
  token: String (required, unique),
  expiresAt: Date (required),
  isRevoked: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔐 SYSTÈME D'AUTHENTIFICATION JWT

### Configuration JWT

**Fichier:** `config/jwt.js`

```javascript
// Tokens JWT
ACCESS_TOKEN_EXPIRY: "15m"        // Courte durée
REFRESH_TOKEN_EXPIRY: "7d"        // Longue durée

// Payload du JWT
{
  userId: ObjectId,
  email: String,
  role: String,
  zone: String | null,  // Pour OPERATOR
  iat: Timestamp,
  exp: Timestamp
}
```

### Flux d'authentification

```
1. LOGIN (email + password)
   ↓
   ├─ Vérifier utilisateur existe
   ├─ Comparer password (bcrypt)
   └─ Générer tokens (access + refresh)

2. ACCÈS AUX ENDPOINTS
   ├─ Middleware verifyToken
   ├─ Extraire token du header: "Authorization: Bearer <token>"
   ├─ Valider signature JWT
   ├─ Ajouter req.user avec données décodées
   └─ Middleware checkRole (RBAC)

3. REFRESH (si token expiré)
   ├─ Envoyer refresh token
   ├─ Valider et créer nouveau access token
   └─ Redémarrer session

4. LOGOUT
   └─ Révoquer refresh token
```

---

## 👥 SYSTÈME D'AUTORISATIONS (RBAC)

### Matrice de permissions par rôle

| Permission              | SUPER_ADMIN | HEAD_SUP | SITE_SUP | OPERATOR | AUDITOR |
| ----------------------- | :---------: | :------: | :------: | :------: | :-----: |
| Gérer industries        |     ✅      |    ✅    |    ❌    |    ❌    |   ❌    |
| Gérer nœuds/capteurs    |     ✅      |    ✅    |    ✅    |    ❌    |   ❌    |
| Gérer opérateurs        |     ✅      |    ✅    |    ✅    |    ❌    |   ❌    |
| Gérer rôles/permissions |     ✅      |    ✅    |    ❌    |    ❌    |   ❌    |
| Config seuils ANPE      |     ✅      |    ❌    |    ❌    |    ❌    |   ❌    |
| Voir données temps réel |     ✅      |    ✅    |    ✅    |    ✅    |   ❌    |
| Voir historique         |     ✅      |    ✅    |    ✅    |    ✅    |   ✅    |
| Acquitter alertes       |     ✅      |    ✅    |    ✅    |    ✅    |   ❌    |
| Générer rapports        |     ✅      |    ✅    |    ✅    |    ❌    |   ✅    |
| Exporter PDF/CSV        |     ✅      |    ✅    |    ✅    |    ❌    |   ✅    |
| Calibrer capteurs       |     ✅      |    ✅    |    ✅    |    ✅    |   ❌    |

### Restrictions par zone (OPERATOR only)

```javascript
// OPERATOR avec zone = "Zone-A"
// → Peut voir UNIQUEMENT readings de Zone-A
// → Autres rôles (zone = null) → accès global
```

---

## 🚨 MOTEUR D'ALERTES (CŒUR DU SYSTÈME)

### Déclenchement automatique des alertes

**Appelé automatiquement après CHAQUE nouvelle Reading reçue via MQTT**

```
Nouvelle lecture reçue (ex: NO₂ = 150 µg/m³)
       ↓
Récupérer seuils du polluant (ANPE NT 106.04)
   - warningThreshold: 100 µg/m³
   - regulatoryLimit: 120 µg/m³
       ↓
Comparer valeur aux seuils:

   SI value > regulatoryLimit × 1.5 (180)
   └─ CRÉER ALERTE "Critical"
      Message: "+50% de dépassement"

   SINON SI value > regulatoryLimit (120)
   └─ CRÉER ALERTE "High"
      Message: "+25% de dépassement"

   SINON SI value > warningThreshold (100)
   └─ CRÉER ALERTE "Warning"
      Message: "+17% d'avertissement"

   SINON
   └─ AUCUNE ALERTE
```

### Calcul du pourcentage de dépassement

```javascript
exceedancePercentage =
  ((readingValue - regulatoryLimit) / regulatoryLimit) * 100;

// Exemple: NO₂ = 150, limite = 120
// (150 - 120) / 120 × 100 = 25%
```

### Acquittement des alertes

```javascript
// Endpoint: PUT /api/alerts/{alertId}/acknowledge
{
  isAcknowledged: true,
  acknowledgedby: userId,
  acknowledgedAt: Date.now()
}
// Permissions: SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR, OPERATOR
```

---

## 📡 PROTOCOLE MQTT

### Configuration

```javascript
// Broker MQTT
HOST: "localhost" ou IP serveur
PORT: 1883 (standard) ou 8883 (TLS)

// Topics de publication (ESP32 → Backend)
sensors/+/readings   // Données capteurs
sensors/+/status     // Statut nœud
sensors/+/error      // Erreurs capteurs

// Format d'ingestion
POST /api/readings/ingest
{
  sensorId: ObjectId,
  polluantId: ObjectId,
  nodeId: ObjectId,
  value: Number,          // Valeur convertie
  unit: String,           // Unité finale
  rawValue: Number        // Valeur brute (optionnel)
}
```

---

## 🌐 ARCHITECTURE ENDPOINTS

### 1. Authentification (`/api/auth`)

```
POST   /auth/register           → Créer compte
POST   /auth/login              → Connexion JWT
POST   /auth/refresh            → Renouveler token
POST   /auth/logout             → Déconnexion (révoquer refresh)
GET    /auth/me                 → Profil utilisateur (verifyToken)
```

### 2. Utilisateurs (RBAC)

**Middleware requis:** `verifyToken + checkRole`

```
GET    /users                   → Liste (SUPER_ADMIN, HEAD_SUPERVISOR)
GET    /users/{id}              → Détail
POST   /users                   → Créer
PUT    /users/{id}              → Modifier
DELETE /users/{id}              → Supprimer
PUT    /users/{id}/role         → Changer rôle (SUPER_ADMIN only)
```

### 3. Industries (`/api/industries`)

```
GET    /industries              → Toutes (avec filtrage géospatial)
GET    /industries/{id}         → Détail + nœuds associés
POST   /industries              → Créer (HEAD_SUPERVISOR+)
PUT    /industries/{id}         → Modifier
DELETE /industries/{id}         → Supprimer
```

### 4. Nœuds Capteurs (`/api/sensor-nodes`)

```
GET    /sensor-nodes            → Tous (filtré par zone si OPERATOR)
GET    /sensor-nodes/{id}       → Détail + capteurs
POST   /sensor-nodes            → Créer (SITE_SUPERVISOR+)
PUT    /sensor-nodes/{id}       → Modifier (activation/désactivation)
DELETE /sensor-nodes/{id}       → Supprimer
GET    /sensor-nodes/{id}/status → Statut temps réel
```

### 5. Capteurs (`/api/sensors`)

```
GET    /sensors                 → Tous
GET    /sensors/{id}            → Détail
POST   /sensors                 → Créer (SITE_SUPERVISOR+)
PUT    /sensors/{id}            → Modifier (calibration date)
DELETE /sensors/{id}            → Supprimer
PUT    /sensors/{id}/calibrate  → Calibrer (OPERATOR+)
```

### 6. Polluants (`/api/polluants`)

```
GET    /polluants               → Tous
GET    /polluants/{id}          → Détail
POST   /polluants               → Créer (SUPER_ADMIN only)
PUT    /polluants/{id}          → Modifier seuils (SUPER_ADMIN)
DELETE /polluants/{id}          → Supprimer
```

### 7. Mesures (`/api/readings`) ⭐ CRITIQUE

```
GET    /readings                → Historique (filtré: capteur, date, zone)
GET    /readings/{id}           → Détail
POST   /readings/ingest         → Ingestion MQTT (ESP32→Backend)
GET    /readings/stream         → WebSocket temps réel (futur)
GET    /readings/export         → Export CSV/JSON
GET    /readings/stats          → Statistiques (moyenne, min, max, écart-type)
```

### 8. Alertes (`/api/alerts`) ⭐ CRITIQUE

```
GET    /alerts                  → Toutes (critères: gravité, statut)
GET    /alerts/active           → Alertes non acquittées
GET    /alerts/{id}             → Détail
PUT    /alerts/{id}/acknowledge → Acquitter alerte
DELETE /alerts/{id}             → Supprimer (SUPER_ADMIN)
GET    /alerts/export           → Export PDF/CSV
```

### 9. Rapports (`/api/reports`)

```
GET    /reports                 → Tous rapports (AUDITOR+)
GET    /reports/{id}            → Détail rapport
POST   /reports                 → Créer (AUDITOR+)
PUT    /reports/{id}            → Soumettre/Approuver
DELETE /reports/{id}            → Supprimer (SUPER_ADMIN)
POST   /reports/{id}/export     → Export PDF ANPE
```

---

## 📝 CONVENTIONS DE CODAGE

### Structure des fichiers

```
backend/
├── config/              # Configuration app
│   ├── db.js           # Connexion MongoDB
│   └── jwt.js          # Configuration JWT
├── controllers/        # Logique métier
│   ├── authController.js
│   ├── readingController.js      ← ⭐ Moteur d'alertes
│   ├── alertController.js
│   └── ...
├── models/             # Schemas MongoDB
│   ├── User.js
│   ├── Reading.js
│   ├── Alert.js
│   └── ...
├── routes/             # Routes Express
├── middleware/         # Middlewares (auth, validation)
├── services/           # Services (MQTT, email, etc.)
├── utils/              # Utilitaires et constantes
└── tests/              # Tests unitaires
```

### Naming conventions

```javascript
// Modèles: PascalCase
const User = require("../models/User");
const Reading = require("../models/Reading");

// Controllers: camelCase + Suffix "Controller"
const readingController = require("../controllers/readingController");
const alertController = require("../controllers/alertController");

// Routes: kebab-case dans URLs
Router.post("/api/readings/ingest", controller);
Router.get("/api/sensor-nodes", controller);

// Constantes: UPPER_SNAKE_CASE
const MAX_READINGS_PER_REQUEST = 1000;
const MONGO_URI = process.env.MONGO_URI;

// Variables: camelCase
const sensorData = {};
const isValid = true;
```

### Structure des réponses API

**Succès (200-201):**

```javascript
{
  success: true,
  message: "Alerte créée avec succès",
  data: {
    _id: "...",
    // ... objet complet
  }
}
```

**Erreur (4xx-5xx):**

```javascript
{
  success: false,
  message: "Message d'erreur détaillé",
  error: "error_code" // optionnel
}
```

### Validation des données

**Fichier:** `middleware/validators.js`

```javascript
// Validation Login
{
  email: String (required, email format),
  password: String (required, minLength: 6)
}

// Validation Reading
{
  sensorId: ObjectId (required),
  polluantId: ObjectId (required),
  nodeId: ObjectId (required),
  value: Number (required, >= 0, <= 1000),
  unit: String (required),
  rawValue: Number (optional)
}

// Validation Alert Acknowledge
{
  // Aucun body requis, utilise req.user.userId
}
```

---

## 🔄 FLUX DE DONNÉES TEMPS RÉEL

### Cycle complet d'ingestion d'une mesure

```
1. ESP32 mesure NO₂ = 145 µg/m³
   ↓
2. Publie via MQTT:
   Topic: sensors/node-123/readings
   Payload: {
     sensorId: "xxx",
     polluantId: "yyy",
     nodeId: "zzz",
     value: 145,
     unit: "µg/m³",
     rawValue: 12450
   }
   ↓
3. Backend reçoit (MQTT Service)
   ↓
4. POST /api/readings/ingest
   ├─ Valide capteur actif ✓
   ├─ Valide polluant existe ✓
   ├─ Valide mesure (0 <= 145 <= 1000) ✓
   ├─ Crée Reading en MongoDB
   └─ isValid = true
   ↓
5. Moteur d'alertes s'exécute AUTOMATIQUEMENT
   ├─ Compare 145 vs warningThreshold=100
   ├─ Compare 145 vs regulatoryLimit=120
   ├─ Compare 145 vs critical=(120 × 1.5=180)
   ├─ 145 > 120 (regulatory) → ALERTE "High"
   ├─ Calcule exceedance = +20.83%
   └─ Crée Alert en MongoDB
   ↓
6. Réponse API
   {
     success: true,
     reading: { _id: "...", value: 145, ... },
     alert: { _id: "...", severity: "High", ... }
   }
   ↓
7. Frontend notifie utilisateur
   ├─ Alerte visuelle (son/notification)
   ├─ Affiche détail alerte
   └─ Permet acquittement
```

---

## ⚙️ PATTERNS ET BONNES PRATIQUES

### 1. Error Handling

```javascript
// Pattern générique avec createError
const { createError } = require("../middleware/errorHandler");

// Utilisation
if (!user) {
  return next(createError(404, "Utilisateur non trouvé"));
}
if (!hasPermission) {
  return next(createError(403, "Accès refusé"));
}

// Les erreurs sont capturées par le middleware errorHandler
app.use(errorHandler); // En dernier
```

### 2. Middleware Stack

```javascript
// Ordre CORRECT:
Router.post(
  "/endpoint",
  verifyToken, // 1. Auth JWT
  checkRole("SUPER_ADMIN"), // 2. RBAC
  checkZone(req), // 3. Zone (OPERATOR)
  validateRequest, // 4. Validation métier
  controller, // 5. Logique
);
```

### 3. Transactions MongoDB (pour multi-documents)

```javascript
// Si besoin de garantir cohérence (Alert + Reading ensemble)
const session = await mongoose.startSession();
session.startTransaction();

try {
  await Reading.create([{ ... }], { session });
  await Alert.create([{ ... }], { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 4. Pagination

```javascript
// Endpoint: GET /readings?page=2&limit=50&sortBy=timestamp&sort=-1
const page = req.query.page || 1;
const limit = req.query.limit || 50;
const skip = (page - 1) * limit;

const results = await Reading.find()
  .skip(skip)
  .limit(limit)
  .sort({ timestamp: -1 });

return {
  data: results,
  pagination: {
    page,
    limit,
    total: await Reading.countDocuments(),
    pages: Math.ceil(total / limit),
  },
};
```

### 5. Rate Limiting

```javascript
// Global: 100 requêtes par 15 min
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Trop de requêtes" },
});

// Par endpoint (plus strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentatives de login
  skipSuccessfulRequests: true,
});
```

### 6. Logging Recommandé

```javascript
// Pour chaque opération critique:
console.log(
  `[INFO] Alerte ${severity} créée — ${polluant.name}: ${value} ${unit}`,
);
console.log(`[DEBUG] Reading # ${readingId} validée et stockée`);
console.error(`[ERROR] Erreur MQTT: ${error.message}`);
console.warn(`[WARN] Capteur ${sensorId} : Dérive détectée`);
```

---

## 🧪 PATTERNS DE TEST

### Structure recommandée pour tester le moteur d'alertes

```javascript
// test-alert-engine.js
const testAlertCreation = async () => {
  // 1. Créer polluant avec seuils ANPE
  // 2. Créer capteur
  // 3. Créer nœud
  // 4. Ingérer mesure dépassant regulatory limit
  // 5. Vérifier alerte créée avec severity="High"
  // 6. Vérifier message contient %exceedance
  // 7. Vérifier relation Reading ↔ Alert
};
```

---

## 🎯 RÈGLES MÉTIER CRITIQUES

### 1. Une Reading = Au maximum 1 Alert

- Après création Reading, l'alerte est créée **automatiquement**
- Pas de duplication d'alertes pour même Reading
- L'alert est lié par ReadingId

### 2. Validation des valeurs

```javascript
// Valide: 0 <= value <= 1000
// Invalide: value < 0 ou value > 1000
// Impact: isValid = false bloque usage statistique
```

### 3. Hiérarchie des seuils

```javascript
warningThreshold < regulatoryLimit < (regulatoryLimit × 1.5)
// Exemple pour NO₂:
100 µg/m³ (warning) < 120 µg/m³ (regulatory) < 180 µg/m³ (critical)
```

### 4. Restriction d'accès OPERATOR

- OPERATOR avec zone="Zone-A"
- Ne peut voir/modifier/vérifier que Zone-A
- Les autres rôles voient tout (zone=null)

### 5. Acquittement d'alerte

- Irréversible (pas de retour en "non-acknowledged")
- Trace qui a acquitté et quand
- Alerte reste en DB pour historique

### 6. Calibration de capteurs

- Date de calibration requise pour analyses de qualité
- Seuil de dérive mesure l'écart acceptable vs étalon
- Si drift > driftThreshold → flaguer en anomalie

---

## 📈 PERFORMANCE & SCALABILITÉ

### Indexes critiques (DÉJÀ CRÉÉS)

```javascript
// Reading (haute volume)
Reading.index({ timestamp: -1 });
Reading.index({ sensorId: 1, timestamp: -1 });
Reading.index({ PolluantId: 1, timestamp: -1 });
Reading.index({ nodeId: 1, timestamp: -1 });

// Alert
Alert.index({ isAcknowledged: 1, severity: 1 });
Alert.index({ timestamp: -1 });
Alert.index({ PolluantId: 1, timestamp: -1 });

// Geospatial
SensorNode.index({ localisation: "2dsphere" });

// Recherches
Sensor.index({ sensorNodeId: 1 });
Sensor.index({ polluantId: 1 });
SensorNode.index({ IndustrieId: 1 });
```

### Recommandations pour IA

1. **Éviter N+1 queries:**

   ```javascript
   // ❌ Mauvais
   const readings = await Reading.find().populate('sensorId');
   readings.forEach(r => {
     const polluant = await Polluant.findById(r.PolluantId); // N queries!
   });

   // ✅ Bon
   const readings = await Reading.find()
     .populate('sensorId')
     .populate('PolluantId')
     .exec();
   ```

2. **Utiliser .lean() pour données en lecture seule:**

   ```javascript
   // Plus rapide, moins de mémoire
   const readings = await Reading.find().lean();
   ```

3. **Limitation des résultats:**
   ```javascript
   // Par défaut max 100 résultats, sinon erreur
   const limit = Math.min(req.query.limit || 50, 100);
   ```

---

## 🔧 VARIABLES D'ENVIRONNEMENT REQUISES

```env
# Database
MONGO_URI=mongodb://localhost:27017/pollution-monitoring

# JWT
JWT_SECRET=votre_secret_tres_securise_min_32_chars
JWT_REFRESH_SECRET=votre_refresh_secret_min_32_chars
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Server
PORT=5000
NODE_ENV=production

# MQTT
MQTT_BROKER_URL=mqtt://localhost
MQTT_PORT=1883
MQTT_USERNAME=optional
MQTT_PASSWORD=optional

# Email (si rapports par email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

---

## 🚀 DÉMARRAGE & INITIALISATION

```bash
# Installation
npm install

# Initialisation (créer super-admin + polluants ANPE)
npm run init:simulator

# Démarrage serveur
npm start

# Tests
npm test

# Tests intégration
npm run test:integration
```

---

## 📌 POINTS CLÉS POUR LE MODÈLE IA

### ✅ À RESPECTER ABSOLUMENT

1. **Chaque nouvelle Reading triggered automatiquement le moteur d'alertes**
   - Pas d'endpoint séparé pour créer Alert
   - L'Alert est générée dans le controller de Reading

2. **RBAC strict:**
   - Toujours mettre `verifyToken` en premier
   - Puis `checkRole` ou `checkMinRole`
   - Puis `checkZone` pour OPERATOR

3. **Validation de la valeur:**

   ```javascript
   value >= 0 && value <= 1000; // Toujours!
   ```

4. **Références ObjectId complètes:**

   ```javascript
   // ❌ JAMAIS
   const userId = "xxx";

   // ✅ TOUJOURS
   const userId = new mongoose.Schema.Types.ObjectId("xxx");
   ```

5. **Messages d'erreur cohérents:**
   - Utiliser les constantes `error_messages` et `success_messages`
   - Structure uniforme: `{ success, message, data }`

6. **Conventions de nommage:**
   - Routes: kebab-case (`/sensor-nodes`)
   - Variables: camelCase (`sensorNodeId`)
   - Modèles: PascalCase (`Reading`)
   - Constantes: UPPER_SNAKE_CASE (`MAX_READINGS`)

7. **Timestamps toujours:**
   - Chaque modèle a `createdAt` et `updatedAt`
   - Utiliser `{ timestamps: true }` dans schemas

8. **Indexes pour performance:**
   - Sur champs fréquemment queryés
   - Surtout pour Reading (volume élevé)

### ❌ À ÉVITER ABSOLUMENT

- Créer d'autres tables/collections sans accord
- Modifier les enums sans discussion
- Bypasser l'authentification JWT
- Queries sans indexes sur gros volumes
- Réponses API non conformes au format
- Hardcoder les seuils ANPE (viennent de DB Polluant)
- Alertes créées manuellement (seulement automatiques)

---

## 🎓 EXEMPLES DE CONTROLLERS À GÉNÉRER

### Exemple 1: GET alertes non acquittées

```javascript
// GET /api/alerts/active?severity=High
const severity = req.query.severity || null;

let query = { isAcknowledged: false };
if (severity) query.severity = severity;

const alerts = await Alert.find(query)
  .populate("PolluantId", "name formula unit")
  .populate("SensorId", "type model")
  .populate("ReadingId", "value timestamp")
  .sort({ timestamp: -1 })
  .limit(50);

return {
  success: true,
  data: alerts,
  count: alerts.length,
};
```

### Exemple 2: POST nouvelle industrie (HEAD_SUPERVISOR+)

```javascript
// POST /api/industries
const { name, sector, coordinates } = req.body;

// Validation
if (!name || !sector) {
  return next(createError(400, "Champs requis: name, sector"));
}

const industrie = await Industrie.create({
  name,
  sector,
  coordinates: {
    type: "Point",
    coordinates: [coordinates.longitude, coordinates.latitude],
  },
});

return {
  success: true,
  message: success_messages.created,
  data: industrie,
};
```

---

## 📞 SUPPORT IA

**Si le modèle IA rencontre une situation ambiguë:**

1. Vérifier la matrice de permissions (section RBAC)
2. Consulter le flux d'alertes (section Moteur d'alertes)
3. Vérifier les indexes MongoDB (section Performance)
4. Valider le format des réponses (section Conventions)

---

**Dernière mise à jour:** Avril 2026  
**Version système:** 3.0 (JWT + RBAC + MQTT + Alertes automatiques)  
**Statut:** Production avec tous les modules actifs
