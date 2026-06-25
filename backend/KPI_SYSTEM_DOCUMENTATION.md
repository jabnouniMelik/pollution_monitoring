# 📊 SYSTÈME KPI ENVIRONNEMENTAUX

Documentation complète du système de calcul des KPIs environnementaux selon la norme Décret 2018-928 (Tunisie).

---

## 📋 VUE D'ENSEMBLE

Le système calcule automatiquement 4 KPIs réglementaires pour le monitoring environnemental industriel :

1. **TD** - Taux de Dépassement (%)
2. **EMJ** - Émission Moyenne par Jour (kg/jour)
3. **IPE** - Indice de Performance Environnementale (/100)
4. **RCO2** - Réduction Estimée CO2 (%)

### Architecture 3-tiers

```
Controllers (HTTP) → Services (Logique métier) → Repositories (DB)
     ↓                      ↓                           ↓
kpiController.js      KPIService.js          AggregateDataRepository.js
                      AggregationService.js   SiteConfigRepository.js
```

---

## 🔢 FORMULES KPI

### KPI 1 : TAUX DE DÉPASSEMENT (TD)

**Formule :**
```
TD = (N_breach / N_total) × 100
```

**Où :**
- `N_breach` = Nombre de mesures > VLE (Valeur Limite d'Émission)
- `N_total` = Nombre total de mesures valides

**Objectif réglementaire :** ≤ 2% / mois

**Exemple :**
- 1000 mesures sur le mois
- 15 dépassements de la VLE
- TD = (15 / 1000) × 100 = 1.5% ✅ Conforme

---

### KPI 2 : ÉMISSION MOYENNE PAR JOUR (EMJ)

**Formule :**
```
EMJ = C_moy × Q_air × 86400 × 10⁻⁶  (kg/jour)
```

**Où :**
- `C_moy` = Concentration moyenne (mg/Nm³)
- `Q_air` = Débit volumique d'air (Nm³/s) - configurable
- `86400` = Secondes par jour
- `10⁻⁶` = Conversion mg → kg

**Objectif réglementaire :** -10% / trimestre

**Exemple :**
- C_moy = 150 mg/Nm³
- Q_air = 2.0 Nm³/s
- EMJ = 150 × 2.0 × 86400 × 10⁻⁶ = 25.92 kg/jour

---

### KPI 3 : INDICE DE PERFORMANCE ENVIRONNEMENTALE (IPE)

**Formule :**
```
IPE = 100 × Σ(w_p × Score(p)) / P
```

**Où :**
- `w_p` = Poids réglementaire du polluant p
- `Score(p)` = Score de conformité du polluant
- `P` = Nombre de polluants

**Score de conformité :**
```
Score(p) = 1                           si C_moy ≤ VLE
Score(p) = max(0, 1 - (C_moy - VLE) / VLE)  si C_moy > VLE
```

**Poids réglementaires (Décret 2018-928) :**
- NOx : 30%
- SO2 : 25%
- PM2.5 : 25%
- COV : 15%
- CO2 : 5%

**Objectif réglementaire :** ≥ 95 / mois

**Exemple :**
- NOx : C_moy = 180 mg/Nm³, VLE = 200 → Score = 1.0 (100%)
- SO2 : C_moy = 330 mg/Nm³, VLE = 300 → Score = 0.9 (90%)
- IPE = 100 × (0.30×1.0 + 0.25×0.9 + ...) = 96.5 ✅ Conforme

---

### KPI 4 : RÉDUCTION ESTIMÉE CO2 (RCO2)

**Formule :**
```
RCO2 = [(EMJ(T) - EMJ(T0)) / EMJ(T0)] × 100
```

**Où :**
- `EMJ(T)` = Émission période actuelle
- `EMJ(T0)` = Émission période référence

**Objectif réglementaire :** ≤ -5% / trimestre (réduction)

**Exemple :**
- EMJ(T0) = 30 kg/jour (trimestre précédent)
- EMJ(T) = 27 kg/jour (trimestre actuel)
- RCO2 = [(27 - 30) / 30] × 100 = -10% ✅ Conforme

---

## 🗄️ MODÈLES DE DONNÉES

### AggregateData

Stocke les données agrégées et KPIs calculés.

```javascript
{
  polluantId: ObjectId,        // Référence Polluant
  sensorNodeId: ObjectId,       // null = agrégation globale
  period: "HOURLY|DAILY|WEEKLY|MONTHLY",
  periodStart: Date,
  periodEnd: Date,
  
  // Statistiques brutes
  minValue: Number,
  maxValue: Number,
  avgValue: Number,
  stdDeviation: Number,
  sampleCount: Number,
  
  // KPIs
  breachCount: Number,          // Pour TD
  tauxDepassement: Number,      // KPI 1 (%)
  emissionKgDay: Number,        // KPI 2 (kg/jour)
  score: Number,                // Score conformité [0-1]
  overallScore: Number,         // KPI 3 IPE (/100)
  reductionPct: Number,         // KPI 4 (%)
  reductionAbsolute: Number,    // kg/jour
  
  // Métadonnées
  calculatedAt: Date,
  calculationDuration: Number,  // ms
  dataQuality: "EXCELLENT|GOOD|FAIR|POOR"
}
```

### SiteConfig

Configuration globale du site.

```javascript
{
  siteName: String,
  airflow: Number,              // Q_air (Nm³/s)
  thermalPower: Number,         // kW (optionnel)
  
  polluantWeights: Map {        // Poids pour IPE
    "NOx": 0.30,
    "SO2": 0.25,
    "PM2.5": 0.25,
    "COV": 0.15,
    "CO2": 0.05
  },
  
  targets: {                    // Objectifs KPI
    tauxDepassement: 2.0,       // %
    ipe: 95,                    // /100
    reductionCO2: -5.0          // %
  },
  
  location: {
    type: "Point",
    coordinates: [lon, lat]
  },
  
  isActive: Boolean,
  lastModifiedBy: ObjectId
}
```

---

## 🔌 API ENDPOINTS

### Calcul KPIs

#### GET /api/kpi/td/:polluantId
Calcule le Taux de Dépassement.

**Query params :**
- `periodStart` (ISO 8601)
- `periodEnd` (ISO 8601)

**Réponse :**
```json
{
  "success": true,
  "kpi": "TD",
  "polluantId": "...",
  "data": {
    "tauxDepassement": 1.5,
    "breachCount": 15,
    "totalCount": 1000
  }
}
```

#### GET /api/kpi/emj/:polluantId
Calcule l'Émission Moyenne par Jour.

**Query params :**
- `periodStart` (ISO 8601)
- `periodEnd` (ISO 8601)
- `qAir` (optionnel, Nm³/s)

**Réponse :**
```json
{
  "success": true,
  "kpi": "EMJ",
  "data": {
    "emissionKgDay": 25.92,
    "avgConcentration": 150,
    "qAir": 2.0
  }
}
```

#### GET /api/kpi/ipe
Calcule l'Indice de Performance Environnementale.

**Query params :**
- `periodStart` (ISO 8601)
- `periodEnd` (ISO 8601)

**Réponse :**
```json
{
  "success": true,
  "kpi": "IPE",
  "data": {
    "ipe": 96.5,
    "polluantScores": {
      "NOx": { "score": 100, "avgConcentration": 180, "vle": 200, "weight": 0.3 },
      "SO2": { "score": 90, "avgConcentration": 330, "vle": 300, "weight": 0.25 }
    },
    "weights": { "NOx": 0.3, "SO2": 0.25, ... }
  }
}
```

#### GET /api/kpi/rco2/:polluantId
Calcule la Réduction CO2.

**Query params :**
- `currentPeriodStart` (ISO 8601)
- `currentPeriodEnd` (ISO 8601)
- `referencePeriodStart` (ISO 8601)
- `referencePeriodEnd` (ISO 8601)

**Réponse :**
```json
{
  "success": true,
  "kpi": "RCO2",
  "data": {
    "reductionPct": -10.0,
    "currentEmission": 27.0,
    "referenceEmission": 30.0,
    "reductionAbsolute": 3.0
  }
}
```

### Agrégation

#### POST /api/kpi/aggregate
Déclenche l'agrégation manuelle (admin).

**Body :**
```json
{
  "period": "DAILY",
  "periodStart": "2026-04-06T00:00:00Z",
  "periodEnd": "2026-04-07T00:00:00Z"
}
```

#### GET /api/kpi/summary
Récupère le résumé KPIs d'une période.

**Query params :**
- `period` (HOURLY|DAILY|WEEKLY|MONTHLY)
- `periodStart` (ISO 8601)
- `periodEnd` (ISO 8601)

#### GET /api/kpi/history/:polluantId
Récupère l'historique des agrégations.

**Query params :**
- `period` (HOURLY|DAILY|WEEKLY|MONTHLY)
- `limit` (défaut: 30)

### Configuration

#### GET /api/kpi/config
Récupère la configuration du site.

#### PUT /api/kpi/config/airflow (admin)
Met à jour le débit d'air.

**Body :**
```json
{
  "airflow": 2.5
}
```

#### PUT /api/kpi/config/weights (admin)
Met à jour les poids des polluants.

**Body :**
```json
{
  "weights": {
    "NOx": 0.30,
    "SO2": 0.25,
    "PM2.5": 0.25,
    "COV": 0.15,
    "CO2": 0.05
  }
}
```

#### PUT /api/kpi/config/targets (admin)
Met à jour les objectifs KPI.

**Body :**
```json
{
  "targets": {
    "tauxDepassement": 2.0,
    "ipe": 95,
    "reductionCO2": -5.0
  }
}
```

---

## ⏰ SCHEDULERS AUTOMATIQUES

Les agrégations sont calculées automatiquement via node-cron :

| Période | Fréquence | Horaire | Description |
|---------|-----------|---------|-------------|
| HOURLY | Toutes les heures | H:05 | Heure précédente complète |
| DAILY | Tous les jours | 00:10 | Jour précédent |
| WEEKLY | Tous les lundis | 00:20 | Semaine précédente |
| MONTHLY | Le 1er du mois | 00:30 | Mois précédent |
| CLEANUP | Tous les dimanches | 03:00 | Supprime données > 1 an |

**Démarrage automatique :** Les schedulers démarrent avec le serveur.

---

## 🚀 INSTALLATION & UTILISATION

### 1. Installation des dépendances

```bash
cd backend
npm install
```

Cela installera `node-cron` automatiquement.

### 2. Initialisation de la configuration

```bash
npm run init:kpi
```

Crée la configuration par défaut :
- Q_air = 2.0 Nm³/s
- Poids réglementaires Décret 2018-928
- Objectifs KPI standards
- Localisation Sfax, Tunisie

### 3. Démarrage du serveur

```bash
npm start
```

Le serveur démarre avec :
- ✅ Routes KPI actives
- ✅ Schedulers automatiques lancés
- ✅ Service MQTT actif

### 4. Test manuel d'agrégation

```bash
curl -X POST http://localhost:5000/api/kpi/aggregate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "period": "DAILY",
    "periodStart": "2026-04-06T00:00:00Z",
    "periodEnd": "2026-04-07T00:00:00Z"
  }'
```

### 5. Consultation des KPIs

```bash
# IPE global
curl "http://localhost:5000/api/kpi/ipe?periodStart=2026-04-01T00:00:00Z&periodEnd=2026-04-07T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Historique d'un polluant
curl "http://localhost:5000/api/kpi/history/POLLUANT_ID?period=DAILY&limit=7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 QUALITÉ DES DONNÉES

Le système évalue automatiquement la qualité des données :

| Qualité | Complétude | Description |
|---------|------------|-------------|
| EXCELLENT | ≥ 95% | Données très fiables |
| GOOD | 85-95% | Données fiables |
| FAIR | 70-85% | Données acceptables |
| POOR | < 70% | Données insuffisantes |

**Calcul de complétude :**
```
Complétude = Mesures reçues / Mesures attendues
Mesures attendues = Heures × 120 (1 mesure / 30s)
```

---

## 🔧 CONFIGURATION AVANCÉE

### Modifier le débit d'air (Q_air)

```bash
curl -X PUT http://localhost:5000/api/kpi/config/airflow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{ "airflow": 2.5 }'
```

### Ajuster les poids réglementaires

```bash
curl -X PUT http://localhost:5000/api/kpi/config/weights \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "weights": {
      "NOx": 0.35,
      "SO2": 0.25,
      "PM2.5": 0.20,
      "COV": 0.15,
      "CO2": 0.05
    }
  }'
```

**⚠️ Important :** La somme des poids doit être 1.0 (100%).

---

## 📁 STRUCTURE DES FICHIERS

```
backend/
├── models/
│   ├── AggregateData.js       # Modèle données agrégées + KPIs
│   ├── SiteConfig.js          # Modèle configuration site
│   └── Polluant.js            # Modèle polluant (+ weight)
├── repositories/
│   ├── AggregateDataRepository.js
│   └── SiteConfigRepository.js
├── services/
│   ├── KPIService.js          # Calculs 4 KPIs
│   └── AggregationService.js  # Orchestration agrégations
├── controllers/
│   └── kpiController.js       # Handlers HTTP
├── routes/
│   └── kpiRoutes.js           # Endpoints API
├── schedulers/
│   └── kpiScheduler.js        # Cron jobs automatiques
├── init-kpi-config.js         # Script initialisation
└── server.js                  # Enregistrement routes + schedulers
```

---

## 🧪 TESTS

### Test calcul TD

```javascript
const kpiService = require('./services/KPIService');

const result = await kpiService.calculateTD(
  polluantId,
  new Date('2026-04-01'),
  new Date('2026-04-07')
);

console.log(result);
// { tauxDepassement: 1.5, breachCount: 15, totalCount: 1000 }
```

### Test agrégation complète

```javascript
const aggregationService = require('./services/AggregationService');

const results = await aggregationService.aggregateAllPolluants(
  'DAILY',
  new Date('2026-04-06T00:00:00Z'),
  new Date('2026-04-07T00:00:00Z')
);

console.log(`${results.length} polluants agrégés`);
```

---

## 📈 MONITORING & LOGS

Le système log automatiquement :

```
✓ Agrégation DAILY pour NOx: TD=1.5%, EMJ=25.92 kg/j
✓ Agrégation DAILY pour SO2: TD=2.1%, EMJ=18.45 kg/j
✓ IPE global DAILY: 96.5/100
✓ RCO2 calculé: -10.0% (3.0 kg/j)
```

**Performance :** Le champ `calculationDuration` (ms) permet de monitorer les temps de calcul.

---

## 🔒 SÉCURITÉ

- Routes lecture : Authentification JWT requise
- Routes modification config : Rôle `admin` requis
- Rate limiting : 100 requêtes / 15 min
- Validation des entrées : Toutes les dates et valeurs sont validées

---

## 📚 RÉFÉRENCES RÉGLEMENTAIRES

- **Décret 2018-928** : Norme tunisienne sur les émissions atmosphériques
- **ISO 14064-1** : Gaz à effet de serre - Quantification et déclaration
- **ANPE** : Agence Nationale de Protection de l'Environnement (Tunisie)

---

## 💡 BONNES PRATIQUES

1. **Initialiser la config avant utilisation :** `npm run init:kpi`
2. **Vérifier Q_air régulièrement :** Paramètre critique pour EMJ
3. **Monitorer la qualité des données :** Viser EXCELLENT ou GOOD
4. **Archiver les rapports mensuels :** Pour conformité réglementaire
5. **Ajuster les poids si réglementation change :** Via API admin

---

## 🐛 DÉPANNAGE

### Les schedulers ne démarrent pas

Vérifier les logs au démarrage du serveur :
```
✓ Schedulers KPI activés — agrégations automatiques
```

Si absent, vérifier que `node-cron` est installé :
```bash
npm install node-cron
```

### Agrégation retourne 0 résultats

Vérifier qu'il y a des mesures dans la période :
```javascript
const readings = await Reading.find({
  timestamp: { $gte: periodStart, $lte: periodEnd }
});
console.log(`${readings.length} mesures trouvées`);
```

### IPE = 0

Vérifier que :
1. Les polluants ont des `regulatoryLimit` définis
2. La configuration existe : `GET /api/kpi/config`
3. Les poids sont corrects (somme = 1.0)

---

## ✅ CHECKLIST DÉPLOIEMENT

- [ ] `npm install` exécuté
- [ ] `npm run init:kpi` exécuté
- [ ] Configuration vérifiée : `GET /api/kpi/config`
- [ ] Serveur démarré : `npm start`
- [ ] Schedulers actifs (logs)
- [ ] Test agrégation manuelle réussi
- [ ] Endpoints KPI accessibles
- [ ] Authentification JWT fonctionnelle

---

**Version :** 1.0.0  
**Date :** 2026-04-07  
**Auteur :** Système de monitoring environnemental




╔══════════════════════════════════════════════════════════════════════════════════╗
║                    PIPELINE DE CALCUL DES KPIs ENVIRONNEMENTAUX                 ║
╚══════════════════════════════════════════════════════════════════════════════════╝

 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         SOURCES DE DONNÉES                                  │
 │                                                                             │
 │  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────────────┐ │
 │  │   readings   │    │    polluants     │    │       siteconfigs         │ │
 │  │              │    │                 │    │                           │ │
 │  │ • value      │    │ • regulatoryLim │    │ • airflow  (Nm³/s)        │ │
 │  │ • timestamp  │    │ • warningThresh │    │ • polluantWeights         │ │
 │  │ • isValid    │    │ • weight        │    │   NOx:0.30  SO₂:0.25      │ │
 │  │ • sensorId   │    │ • name / code   │    │   PM25:0.25 COV:0.15      │ │
 │  │ • nodeId     │    │                 │    │   CO₂:0.05                │ │
 │  │ • PolluantId │    │                 │    │ • targets (TD≤2%, IPE≥95) │ │
 │  └──────┬───────┘    └────────┬────────┘    └─────────────┬─────────────┘ │
 └─────────┼────────────────────┼─────────────────────────────┼───────────────┘
           │                    │                             │
           ▼                    ▼                             ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                     KPIScheduler  (node-cron)                               │
 │                                                                             │
 │   ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌─────────┐ │
 │   │ HOURLY  H:05    │  │ DAILY  00:10    │  │WEEKLY 00:20  │  │MONTHLY  │ │
 │   │ période [H-1,H) │  │ période [J-1,J) │  │période [S-1) │  │00:30    │ │
 │   └────────┬────────┘  └────────┬────────┘  └──────┬───────┘  └────┬────┘ │
 └────────────┼────────────────────┼──────────────────┼───────────────┼──────┘
              │                    │                  │               │
              └────────────────────┴────────┬─────────┘               │
                                            │                         │
                                            ▼                         │
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │             AggregationService.aggregateAllPolluants(period, siteId)        │
 │                                                                             │
 │         
 └────────────┬────────────────────────────────────────────────────────────────┘
              │
              │  ─────────────────────────────────────────────────────────────
              │
 
              │
              ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │              ÉVALUATION DE LA QUALITÉ DES DONNÉES                           │
 │                                                                             │
 │      │
 └────────────┬────────────────────────────────────────────────────────────────┘
              │
              ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                   DOCUMENT AggregateData PERSISTÉ                           │
 │                                                                             │
 │  {                                                                          │
 │    siteId, zoneId, polluantId,                                              │
 │    period: "HOURLY|DAILY|WEEKLY|MONTHLY",                                   │
 │    periodStart, periodEnd,                                                  │
 │                                                                             │
 │    avgValue,  minValue,  maxValue,  stdDeviation,   ◄── stats brutes        │
 │    sampleCount,                                                             │
 │                                                                             │
 │    tauxDepassement,   breachCount,  warningCount,   ◄── KPI 1 (TD)         │
 │    emissionKgDay,                                   ◄── KPI 2 (EMJ)        │
 │    overallScore,      score,                        ◄── KPI 3 (IPE)        │
 │    reductionPct,      reductionAbsolute,            ◄── KPI 4 (RCO₂)       │
 │                                                                             │
 │    dataQuality,       calculationDuration           ◄── métadonnées         │
 │  }                                                                          │
 └────────────┬────────────────────────────────────────────────────────────────┘
              │
              ├
              ▼                                                  
 ┌────────────────────────────┐                  
 │      API REST              │                  
 │                            │                  
 │  GET /api/kpis/summary     │                  
 │  GET /api/kpis/td/:id      │                 
 │  GET /api/kpis/emj/:id     │                  
 │  GET /api/kpis/ipe         │                  
 │  GET /api/kpis/rco2/:id    │                  
 └────────────┬───────────────┘                  
              │
              ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                     FRONTEND (TanStack Query)                               │
 │                                                                             │
 │  staleTime = 30 s  →  évite les requêtes répétitives                        │
 │                                                                             │
 │  WebSocket kpi_update  →  invalidateQueries(['kpi','summary'])              │
 │                        →  refetch automatique → re-render                  │
 │                                                                             │
 │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────────────┐  │
 │  │KPIGauge  │  │ TD Chart │  │EMJ Trend │  │  IPE / RCO₂ Dashboard    │  │
 │  │ IPE/100  │  │  %       │  │  kg/j    │  │  overallScore + badges    │  │
 │  └──────────┘  └──────────┘  └──────────┘  └───────────────────────────┘  │
 └─────────────────────────────────────────────────────────────────────────────┘
