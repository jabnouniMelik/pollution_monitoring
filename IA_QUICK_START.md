# 🚀 GUIDE RAPIDE POUR MODÈLE IA

## Pollution Monitoring System v3.0

**Lire ce fichier EN PREMIER avant de générer du code.**

---

## 📌 CE QUE VOUS DEVEZ SAVOIR (2 minutes)

### Le projet en 30 secondes

Système de **surveillance de pollution atmosphérique** avec:

- **Capteurs IoT** (ESP32) qui envoient des mesures en temps réel via MQTT
- **Backend Express + MongoDB** qui les reçoit et les analyse
- **Moteur d'alertes automatique** qui compare aux seuils ANPE
- **Système d'utilisateurs** avec 5 rôles et permissions
- **JWT + RBAC** pour authentification et autorisation

### Tech stack (Ce qu'il faut retenir)

```javascript
{
  "framework": "Express.js",
  "database": "MongoDB",
  "auth": "JWT (15m tokens)",
  "protocol": "MQTT (temps réel)",
  "hashing": "bcryptjs"
}
```

### Les 3 éléments CRITIQUES

1. **Moteur d'alertes** → Créé AUTOMATIQUEMENT après chaque Reading
2. **RBAC** → Système de rôles stricts (5 niveaux)
3. **Validation** → Value: 0 ≤ value ≤ 1000 (critère de qualité)

---

## 🗂️ LES FICHIERS DE RÉFÉRENCE POUR VOUS

| Fichier                          | Quand l'utiliser                                  |
| -------------------------------- | ------------------------------------------------- |
| **IA_SYSTEM_DOCUMENTATION.md**   | Besoin de compréhension complète du système       |
| **IA_REFERENCE.json**            | Besoin de lookup rapide (modèles, endpoints, etc) |
| **IA_CODE_PATTERNS.js**          | Besoin d'exemples de code à copier/adapter        |
| **IA_CHECKLIST_AND_PITFALLS.md** | Avant de soumettre du code (validation)           |

---

## 🎯 5 CONCEPTS FONDAMENTAUX

### 1️⃣ Reading (Mesure)

**Qu'est-ce?** Une mesure d'un capteur (ex: NO₂ = 145 µg/m³)  
**Créé par:** ESP32 via MQTT → `/api/readings/ingest`  
**Important:** Génère AUTOMATIQUEMENT 0 ou 1 Alert

```javascript
{
  sensorId, polluantId, nodeId,
  value: 145,         // STRICT: 0 ≤ value ≤ 1000
  unit: "µg/m³",
  rawValue: 12450,    // Avant conversion
  isValid: true       // false si valeur aberrante
}
```

### 2️⃣ Alert (Alerte)

**Qu'est-ce?** Une alerte créée si mesure dépasse seuil  
**Créé par:** checkAndCreateAlert() (AUTOMATIQUE)  
**Jamais créé manuellement!**

```javascript
{
  severity: "High",               // Warning / High / Critical
  type: "Threshold",              // Type automatique
  value: 145,
  threshold: 120,                 // Seuil ANPE régulateur
  message: "+ 20.83% dépassement",// Avec % calculé
  isAcknowledged: false,          // IRRÉVERSIBLE si true
  acknowledgedby: userId,         // Qui a acquitté?
  acknowledgedAt: Date            // Quand?
}
```

### 3️⃣ Polluant (Substance chimique)

**Qu'est-ce?** NO₂, SO₂, PM2.5, etc avec seuils ANPE  
**Important:** C'es LA source de vérité des seuils (pas en dur!)

```javascript
{
  name: "Dioxyde d'azote",
  formula: "NO₂",
  unit: "µg/m³",
  regulatoryLimit: 120,           // Seuil ANPE
  warningThreshold: 100           // < regulatory
}
```

### 4️⃣ Utilisateur & Rôles (RBAC)

**5 rôles (du plus au moins puissant):**

- **SUPER_ADMIN** (niveau 5) → Tout accès + config seuils
- **HEAD_SUPERVISOR** (4) → Gestion industries/sites
- **SITE_SUPERVISOR** (3) → Gestion opérateurs du site
- **OPERATOR** (1) → Lecture données de sa zone
- **AUDITOR** (2) → Génération rapports

**RÈGLE CRITIQUE:** OPERATOR resteint par `zone` assignée

### 5️⃣ Endpoint Ingest (L'entrée du système)

**POST /api/readings/ingest**

```javascript
// INPUT
{
  sensorId: ObjectId,
  polluantId: ObjectId,
  nodeId: ObjectId,
  value: 145,
  unit: "µg/m³",
  rawValue: 12450
}

// OUTPUT
{
  success: true,
  data: {
    reading: { ... },
    alert: { ... }  // null si pas d'alerte
  }
}
```

---

## 🛑 PIÈGES À ÉVITER ABSOLUMENT

```javascript
// ❌ PIÈGE 1: Créer une Alert manuellement
Alert.create(req.body); // NON! Elles sont AUTOMATIQUES

// ✅ BON
// Les alerts sont créées par checkAndCreateAlert()
// Appelé automatiquement dans ingestReading()

// ❌ PIÈGE 2: Hardcoder seuils
if (value > 120) { ... }  // Le 120 est en dur!

// ✅ BON
if (value > polluant.regulatoryLimit) { ... }  // De la DB

// ❌ PIÈGE 3: Oublier checkZone pour OPERATOR
router.get('/readings', verifyToken, getReadings);

// ✅ BON
router.get('/readings', verifyToken, checkZone, getReadings);

// ❌ PIÈGE 4: Validation insuffisante
isValid = value >= 0;  // Et si value = 5000?

// ✅ BON
isValid = value >= 0 && value <= 1000;

// ❌ PIÈGE 5: Mauvais format réponse
res.json({ data: result });  // Pas de success/message!

// ✅ BON
res.json({
  success: true,
  message: "Success",
  data: result
});
```

---

## 📋 AVANT DE GÉNÉRER DU CODE

**Répondez rapidement à ces questions:**

1. **Quel type de controller?**
   - Ingest reading? → Append `checkAndCreateAlert()`
   - Récupérer readings? → Append `checkZone` pour OPERATOR
   - Créer ressource? → Append le rôle correct

2. **Quel rôle minimum?**
   - Chercher dans la matrice (fichier IA_REFERENCE.json)
   - Ajouter ALL rôles autorisés dans `checkRole()`

3. **Besoin de boucler?**
   - Oui → Utiliser `.populate()` pour éviter N+1
   - Oui → Ajouter `.lean()` pour perf
   - Si gros volume → Ajouter `.limit(100)`

4. **C'est une ressource liée?**
   - Reading? → Ajouter PolluantId, sensorId, nodeId
   - Alert? → Ajouter ReadingId, SensorId, PolluantId
   - Toujours alimenter les références

5. **Besoin de validation?**
   - OUI, toujours
   - Value? → 0 ≤ value ≤ 1000
   - Role? → Vérifier dans ROLE_HIERARCHY
   - ObjectId? → Convertir avec mongoose.Types.ObjectId

---

## 🎬 WORKFLOW TYPIQUE

### Scenario 1: Ingest une Reading

```
1. ESP32 mesure pollution
   ↓
2. Publie sur MQTT
   ↓
3. POST /api/readings/ingest reçoit
   ↓
4. Crée Reading
   ↓
5. 🚨 Appelle checkAndCreateAlert() automatiquement
   ↓
6. Si seuil dépassé → Crée Alert
   ↓
7. Retourne { reading, alert }
```

### Scenario 2: Utilisateur voit alertes

```
1. Utilisateur login (JWT)
   ↓
2. GET /api/alerts/active
   ↓
3. Middleware: verifyToken (ok?)
   ↓
4. Middleware: checkRole (OPERATOR+?)
   ↓
5. Controller retourne alertes non acquittées
   ↓
6. Utilisateur acquitte alerte
   ↓
7. PUT /api/alerts/:id/acknowledge
   ↓
8. isAcknowledged = true (irréversible!)
```

---

## 🎓 FORMULES IMPORTANTES

### Calcul du % de dépassement

```javascript
// FORMULE:
percentage = ((value - limit) / limit) * 100

// EXEMPLE: NO₂ = 150, limit = 120
percentage = ((150 - 120) / 120) * 100 = 25%

// MESSAGE:
`Dépassement: +${percentage.toFixed(2)}%`
```

### Sévérité d'alerte

```javascript
if (value > limit × 1.5)      → Critical
else if (value > limit)        → High
else if (value > warning)      → Warning
else                           → null (no alert)

// EXEMPLE (NO₂):
if (value > 180 (120×1.5))    → Critical
else if (value > 120)         → High
else if (value > 100)         → Warning
else                          → null
```

---

## 📞 STRUCTURE REQUÊTE/RÉPONSE

### Response Success

```javascript
{
  success: true,
  message: "Description courtc de l'action",
  data: {
    // L'objet créé/modifié/récupéré
  }
}
```

### Response Error

```javascript
{
  success: false,
  message: "Error message"
}
```

### Status HTTP

- **200** → GET succès
- **201** → POST création
- **400** → Validation échouée (votre faute)
- **401** → Token absent/expiré
- **403** → Rôle insuffisant (vous n'avez pas le droit)
- **404** → Resource n'existe pas
- **500** → Erreur serveur (notre faute)

---

## 🔐 AUTHENTIFICATION SIMPLIFIÉE

### JWT Flow

```
1. POST /auth/login (email + password)
   ↓
2. Retourne: { accessToken, refreshToken }
   ↓
3. Client stoque dans localStorage
   ↓
4. À chaque requête: Header: Authorization: Bearer ${accessToken}
   ↓
5. Si expiré (TokenExpiredError) → POST /auth/refresh
   ↓
6. Retourne nouveau accessToken
```

### Middleware de vérification

```javascript
// ORDRE CRITIQUE:
1. verifyToken      → extrait JWT, ajoute req.user
2. checkRole        → vérifie rôle
3. checkZone        → vérifie zone (si OPERATOR)
4. controller       → exécute logique
```

---

## 🗃️ MODÈLES CLÉS (Format rapide)

### Reading

```javascript
{
  sensorId: ObjectId,          ✓ required
  PolluantId: ObjectId,        ✓ required
  nodeId: ObjectId,            ✓ required
  value: Number,               ✓ required, 0-1000
  unit: String,                ✓ required
  isValid: Boolean,            default: false
  rawValue: Number,            optional
  timestamp: Date,             default: now
  createdAt/updatedAt: auto
}
```

### Alert

```javascript
{
  PolluantId: ObjectId,        ✓ required
  SensorId: ObjectId,          ✓ required
  ReadingId: ObjectId,         ✓ required (lien)
  severity: Enum,              ✓ Warning|High|Critical
  type: Enum,                  ✓ Threshold|anomaly|SensorFault
  value: Number,               ✓ reading value
  threshold: Number,           ✓ seuil ANPE
  message: String,             ✓ avec %
  isAcknowledged: Boolean,     default: false (irréversible)
  acknowledgedby: ObjectId,    null ou userId
  acknowledgedAt: Date,        null ou Date
  createdAt/updatedAt: auto
}
```

### User

```javascript
{
  username: String,            ✓ unique
  email: String,               ✓ unique
  password: String,            ✓ bcrypted
  role: Enum,                  ✓ 5 choices
  zone: String|null,           for OPERATOR
  isActive: Boolean
  createdAt/updatedAt: auto
}
```

---

## 🚀 PREMIÈRE TÂCHE: GÉNÉRER UN ENDPOINT

### Étapes

1. Ouvrir **IA_CODE_PATTERNS.js**
2. Chercher pattern similaire
3. Copier/adapter
4. Ajouter middleware appropriés
5. Valider avec **IA_CHECKLIST_AND_PITFALLS.md**

### Exemple: Créer GET /api/alerts/critical

```javascript
// STEP 1: Chercher pattern dans IA_CODE_PATTERNS.js
// Section "getReadings avec RBAC + zone restriction"

// STEP 2: Adapter
const getCriticalAlerts = async (req, res, next) => {
  try {
    const alerts = await Alert.find({
      isAcknowledged: false,
      severity: 'Critical'
    })
      .populate('PolluantId', 'name')
      .sort({ timestamp: -1 })
      .limit(50);

    return res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    next(createError(500, error_messages.server_error));
  }
};

// STEP 3: Ajouter route
router.get('/critical',
  verifyToken,                                      // Auth
  checkRole('SUPER_ADMIN', 'HEAD_SUPERVISOR', 'SITE_SUPERVISOR', 'OPERATOR'),  // RBAC
  getCriticalAlerts                                 // Controller
);

// STEP 4: Valider checklist
✓ Try-catch présent
✓ createError utilisé
✓ Middleware dans bon ordre
✓ Roles corrects
✓ Format réponse standard
✓ .populate() utilisé
✓ .lean()? Non besoin ici car peu de résultats
```

---

## ⚡ COMMANDES RAPIDES

```bash
# Démarrer le serveur
npm start

# Initialiser la DB (créer super-admin + polluants)
npm run init:simulator

# Tests
npm test

# Tests intégration
npm run test:integration
```

---

## 📚 OÙ TROUVER L'INFO

| Question                                | Solution                                         |
| --------------------------------------- | ------------------------------------------------ |
| "Quels champs a le modèle Topic?"       | IA_REFERENCE.json → models.Topic                 |
| "Qui peut créer une industrie?"         | IA_REFERENCE.json → endpoints → POST /industries |
| "Comment calculer le % de dépassement?" | IA_CHECKLIST_AND_PITFALLS.md → Section 12        |
| "Quelle formule pour severity?"         | CE FICHIER → "Formules importantes"              |
| "Comment faire un controller?"          | IA_CODE_PATTERNS.js → Section 7                  |
| "Exemple complet d'ingest?"             | IA_CODE_PATTERNS.js → Section 2                  |
| "Pièges courants?"                      | IA_CHECKLIST_AND_PITFALLS.md → Section 2         |

---

## 🎖️ RÉSUMÉ ULTRA-COURT

```
PROJECT: Real-time pollution monitoring
AUTH: JWT + 5 roles (RBAC)
DB: MongoDB
KEY: Alert Engine (auto-triggered after Reading)

FLOW:
ESP32 → MQTT → POST /readings/ingest
  → Reading created
  → Alert auto-generated if threshold exceeded

CRITICAL:
1. Alerts NEVER created manually
2. Value MUST be 0 ≤ value ≤ 1000
3. OPERATOR restricted by zone
4. Seuils come from DB (not hardcoded)
5. Response format: { success, message, data }
```

---

## ✅ CHECKLIST AVANT CODAGE

- [ ] Ai-je lu ce fichier?
- [ ] Je comprends les 5 concepts fondamentaux?
- [ ] Je connais les 5 pièges à éviter?
- [ ] J'ai le dossier IA_REFERENCE.json à portée?
- [ ] J'ai les exemples IA_CODE_PATTERNS.js?
- [ ] Je vais valider avec IA_CHECKLIST_AND_PITFALLS.md?
- [ ] Je commence par copier un pattern existant?

---

**Vous êtes prêt? Commencez par consulter IA_CODE_PATTERNS.js pour votre premier endpoint!**

**Questions? Retournez à IA_SYSTEM_DOCUMENTATION.md pour plus de détails.**
