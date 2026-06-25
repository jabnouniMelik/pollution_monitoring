# Guide de Test Complet — EmissionsIQ

> Système de monitoring des émissions industrielles (Décret tunisien Décret 2018-928)

**Dernière mise à jour :** Mai 2026  
**Durée estimée :** 30 min (flux rapide) · 2–4 h (test complet)

---

## Table des matières

1. [Architecture & flux de données](#1-architecture--flux-de-données)
2. [Prérequis](#2-prérequis)
3. [Étape 0 — Nettoyage de la base de données](#3-étape-0--nettoyage-de-la-base-de-données)
4. [Étape 1 — Initialisation complète](#4-étape-1--initialisation-complète)
5. [Étape 2 — Lancement du backend](#5-étape-2--lancement-du-backend)
6. [Étape 3 — Lancement du simulateur IoT](#6-étape-3--lancement-du-simulateur-iot)
7. [Étape 4 — Lancement du frontend](#7-étape-4--lancement-du-frontend)
8. [Étape 5 — Vérification du flux end-to-end](#8-étape-5--vérification-du-flux-end-to-end)
9. [Tests fonctionnels par module](#9-tests-fonctionnels-par-module)
10. [Comptes de test & rôles](#10-comptes-de-test--rôles)
11. [Problèmes connus & solutions](#11-problèmes-connus--solutions)
12. [Référence rapide — toutes les commandes](#12-référence-rapide--toutes-les-commandes)

---

## 1. Architecture & flux de données

```
┌────────────────┐  MQTT (emissions/#)  ┌──────────────┐  WebSocket /ws  ┌──────────────┐
│  iot/          │ ───────────────────▶ │  backend     │ ──────────────▶ │  frontend    │
│  simulator     │      :1883           │  :5000       │                 │  :3000       │
└────────────────┘                      │              │  REST /api/*    │              │
                                        │  MongoDB     │ ◀────────────── │              │
                                        │  :27017      │                 │              │
                                        └──────────────┘                 └──────────────┘
```

**Flux complet d'une mesure :**

```
1. Simulateur publie JSON sur emissions/Zone-A/CO2
2. Backend (mqttService) reçoit le message
3. ReadingService valide et sauvegarde le Reading en MongoDB
4. AlertService compare la valeur aux seuils → crée une Alert si dépassement
5. WebSocket broadcast l'alerte + mise à jour KPI au frontend
6. Frontend affiche la notification et rafraîchit le dashboard
```

---

## 2. Prérequis

| Outil | Version minimale | Vérification |
|-------|-----------------|--------------|
| Node.js | 20+ | `node -v` |
| npm | 9+ | `npm -v` |
| MongoDB | 6+ sur `localhost:27017` | doit être démarré |
| Mosquitto MQTT | 2+ sur `localhost:1883` | doit être démarré |

**Vérifier que MongoDB et Mosquitto écoutent :**

```powershell
netstat -ano | Select-String ":27017|:1883"
```

Vous devez voir **deux lignes LISTENING**. Si ce n'est pas le cas, démarrez les services avant de continuer.

**Démarrer MongoDB et Mosquitto (Windows) :**

```powershell
# Si installés comme services Windows
Start-Service -Name "MongoDB"
Start-Service -Name "mosquitto"

# Ou manuellement
mongod --dbpath "C:\data\db"
mosquitto -v
```

---

## 3. Étape 0 — Nettoyage de la base de données

> Effectuez cette étape pour repartir d'un état propre. Elle supprime les readings et les alertes, mais conserve les polluants et les capteurs.

```powershell
cd backend
node clean-db.js
```

**Sortie attendue :**

```
🔄 Nettoyage de la base de données...
📋 Polluants actuels en DB: [liste des polluants]
✅ Cleared X readings
✅ Cleared X alerts
✨ Database is now clean and ready for new simulator data!
```

**Nettoyage complet (y compris les utilisateurs) :**

```powershell
# Supprimer les utilisateurs de démo
node cleanup-users.js

# Supprimer TOUTES les collections (readings, alerts, sensors, polluants, etc.)
# ⚠️ Irréversible — à utiliser uniquement pour une réinitialisation totale
node clean-db.js
```

---

## 4. Étape 1 — Initialisation complète

> À exécuter **une seule fois** par machine, ou après un nettoyage complet.

### 4.1 Installer les dépendances

```powershell
# Backend
cd backend
npm install

# IoT Simulator
cd ../iot
npm install

# Frontend
cd ../frontend
npm install
```

### 4.2 Configurer les variables d'environnement

**Backend** — le fichier `backend/.env` est déjà présent avec les valeurs par défaut :

```env
MONGO_URI=mongodb://localhost:27017/pollution_db
PORT=5000
MQTT_BROKER=mqtt://localhost:1883
JWT_ACCESS_SECRET=pollution_access_secret_key_2026
JWT_REFRESH_SECRET=pollution_refresh_secret_key_2026
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
NODE_ENV=development
```

**Frontend** — créer `.env.local` depuis le template :

```powershell
cd frontend
Copy-Item .env.example .env.local
```

Contenu minimal de `frontend/.env.local` :

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000/ws
VITE_ENABLE_DEVTOOLS=true
```

### 4.3 Initialiser la base de données

Depuis le dossier `backend/`, exécutez les scripts dans cet ordre :

```powershell
cd backend

# 1. Crée l'industrie, le nœud capteur, les 7 polluants et les 7 capteurs
npm run init:simulator

# 2. Crée les 5 utilisateurs de démo (idempotent — réinitialise les mots de passe)
npm run init:users

# 3. Charge les seuils légaux (Décret Décret 2018-928)
npm run init:thresholds

# 4. Configure les paramètres KPI (débit d'air, poids des polluants, objectifs)
npm run init:kpi
```

Ou en une seule commande (équivalent aux 4 scripts ci-dessus) :

```powershell
npm run init && npm run init:kpi
```

**Ce qui est créé :**

| Élément | Détail |
|---------|--------|
| Industrie | `Station-Sfax-01` (Sfax, Tunisie) |
| Nœud capteur | `Zone-A` |
| Polluants | CO2, NOX, SO2, COV, PM25, TEMPERATURE, HUMIDITY |
| Capteurs | 7 capteurs correspondants |
| Utilisateurs | 5 comptes de démo (voir §10) |
| ThresholdConfig | Seuils légaux par polluant |
| SiteConfig | Débit d'air 2.0 Nm³/s, poids KPI |

---

## 5. Étape 2 — Lancement du backend

```powershell
cd backend
npm start
```

**Sortie attendue (dans l'ordre) :**

```
MongoDB connected
✅ [MQTT Service] Connecté au broker: mqtt://localhost:1883
📡 [MQTT Service] Abonné au topic: emissions/#
WebSocket activé — écoute sur /ws
KPI Broadcaster activé
Schedulers KPI activés
Serveur démarré sur le port 5000
```

> Si l'un de ces messages est absent, consultez la section §11 Problèmes connus.

**Vérification rapide (dans un autre terminal) :**

```powershell
# Route publique
Invoke-RestMethod http://localhost:5000/

# Login admin
$body = @{ email = "admin@example.com"; password = "admin123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri http://localhost:5000/api/auth/login `
  -Method POST -Body $body -ContentType "application/json"
$token = $login.data.accessToken
Write-Host "Token OK:" $token.Substring(0,30)"..."
```

---

## 6. Étape 3 — Lancement du simulateur IoT

> Le backend doit être démarré et connecté au broker MQTT avant de lancer le simulateur.

```powershell
cd iot
npm start
```

**Sortie attendue :**

```
╔══════════════════════════════════════════════════╗
║     SIMULATEUR IoT — Émissions Industrielles     ║
║     Système : Station-Sfax-01                    ║
║     Zone    : Zone-A                             ║
║     Scénario: RANDOM                             ║
╚══════════════════════════════════════════════════╝

✅ Connecté au broker MQTT : mqtt://localhost:1883

┌──────────────┬──────────────────────┬───────────┐
│ Type         │ Model                │ Frequency │
├──────────────┼──────────────────────┼───────────┤
│ CO2          │ MH-Z19B              │ 10s       │
│ NOX          │ ME4-NO2              │ 30s       │
│ SO2          │ ME4-SO2              │ 30s       │
│ PM25         │ SDS011               │ 15s       │
│ COV          │ SGP30                │ 30s       │
│ TEMPERATURE  │ DHT22                │ 10s       │
│ HUMIDITY     │ DHT22                │ 10s       │
└──────────────┴──────────────────────┴───────────┘
```

Suivi d'un flux de mesures : `🟢 CO2 : 584 ppm`, `🟡 NOX : 98 mg/Nm³`, etc.

**Scénarios disponibles :**

| Commande | Effet | Alertes générées |
|----------|-------|-----------------|
| `npm start` ou `node simulator.js random` | 65% normal, 15% warning, 12% high, 8% critical | Mixte |
| `node simulator.js normal` | Valeurs dans la plage normale | Aucune |
| `node simulator.js warning` | Valeurs approchant les seuils | Warning (jaune) |
| `node simulator.js high` | Valeurs dépassant les seuils | High (orange) |
| `node simulator.js critical` | Dépassement sévère | Critical (rouge) |

**Vérifier que le backend ingère les données :**

Dans le terminal du backend, vous devez voir :

```
📥 [MQTT] Reçu — Topic: emissions/Zone-A/CO2
📥 [READING] Ingesting reading ...
[ALERT] Vérification des seuils pour CO2 ...
```

---

## 7. Étape 4 — Lancement du frontend

```powershell
cd frontend
npm run dev
```

**Sortie attendue :**

```
VITE v5.x.x  ready in Xms
➜  Local:   http://localhost:3000/
```

Ouvrez http://localhost:3000 dans votre navigateur. Vous devez être redirigé vers `/login`.

---

## 8. Étape 5 — Vérification du flux end-to-end

Ouvrez **4 terminaux** et lancez dans cet ordre :

```powershell
# Terminal 1 — Backend
cd backend ; npm start

# Terminal 2 — Simulateur IoT (après que le backend affiche "MQTT connecté")
cd iot ; node simulator.js critical

# Terminal 3 — Frontend
cd frontend ; npm run dev

# Terminal 4 — Vérification API (optionnel)
cd backend
$body = @{ email="admin@example.com"; password="admin123" } | ConvertTo-Json
$t = (Invoke-RestMethod http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json").data.accessToken
$h = @{ Authorization = "Bearer $t" }

"=== Readings ===" ; (Invoke-RestMethod "http://localhost:5000/api/readings?limit=5" -Headers $h).data
"=== Alerts ===" ; (Invoke-RestMethod "http://localhost:5000/api/alerts" -Headers $h).data | Select-Object severity, value, createdAt
"=== WS Stats ===" ; (Invoke-RestMethod http://localhost:5000/api/ws/stats).websocket
```

**Checklist de validation :**

- [ ] Backend affiche `📥 [MQTT] Reçu` toutes les 10–30 s
- [ ] Backend affiche `📥 [READING] Ingesting reading` sans erreur
- [ ] Backend affiche `[ALERT]` pour le scénario `critical`
- [ ] `GET /api/readings?limit=5` retourne les dernières mesures du simulateur
- [ ] `GET /api/alerts` retourne une liste non vide après ~1 min en mode `critical`
- [ ] Frontend `/login` → connexion avec `admin@example.com` / `admin123`
- [ ] Dashboard affiche les KPI cards (TD, EMJ, IPE, RCO2)
- [ ] Indicateur LiveIndicator (barre supérieure) est **vert**
- [ ] Le timestamp "dernière mise à jour" se rafraîchit toutes les ~5 s
- [ ] Page `/alerts` affiche les alertes et se met à jour en temps réel
- [ ] Arrêter le simulateur → les lectures s'arrêtent mais l'UI reste en ligne

---

## 9. Tests fonctionnels par module

### 9.1 Authentification & RBAC

**Login avec chaque rôle :**

```powershell
# Exemple avec l'opérateur
$body = @{ email = "operator@example.com"; password = "operator123" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/auth/login `
  -Method POST -Body $body -ContentType "application/json"
```

**Vérifier les permissions :**

```powershell
# Token opérateur — doit retourner 403 sur les routes admin
$body = @{ email = "operator@example.com"; password = "operator123" } | ConvertTo-Json
$t = (Invoke-RestMethod http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json").data.accessToken
$h = @{ Authorization = "Bearer $t" }

# Doit retourner 403
Invoke-RestMethod http://localhost:5000/api/users -Headers $h

# Token admin — doit retourner 200
$body = @{ email = "admin@example.com"; password = "admin123" } | ConvertTo-Json
$t = (Invoke-RestMethod http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json").data.accessToken
$h = @{ Authorization = "Bearer $t" }
Invoke-RestMethod http://localhost:5000/api/users -Headers $h
```

**Dans le navigateur :**

1. Aller sur http://localhost:3000 sans être connecté → redirigé vers `/login`
2. Se connecter avec `auditor@example.com` / `audit123`
3. Tenter d'accéder à `/config` → redirigé vers `/unauthorized`
4. Se déconnecter → redirigé vers `/login`

### 9.2 Données en temps réel (WebSocket)

1. Ouvrir les DevTools du navigateur (F12) → onglet **Network** → filtre **WS**
2. Se connecter au frontend
3. Vérifier la connexion WebSocket vers `ws://localhost:5000/ws`
4. Observer les messages :
   - `connected` → `authenticate` → `authenticated`
   - `subscribe` → `subscribed`
   - `kpi_update` toutes les ~5 s

### 9.3 Alertes

**Générer une alerte critique manuellement (sans simulateur) :**

```powershell
# Publier une valeur critique de CO2 via MQTT
node -e "require('mqtt').connect('mqtt://localhost:1883').on('connect',c=>{c.publish('emissions/Zone-A/CO2',JSON.stringify({sensorType:'CO2',model:'MH-Z19B',zone:'Zone-A',nodeName:'Station-Sfax-01',value:1500,rawValue:1500,unit:'ppm',level:'critical',timestamp:new Date().toISOString(),isValid:true,rssi:-60,battery:null}),{qos:1},()=>process.exit(0));});"
```

**Vérifier l'alerte via l'API :**

```powershell
Invoke-RestMethod "http://localhost:5000/api/alerts?severity=critical&limit=3" `
  -Headers @{ Authorization = "Bearer $token" }
```

**Dans le navigateur :**

1. Aller sur `/alerts`
2. Vérifier que l'alerte apparaît avec la bonne sévérité (rouge)
3. Cliquer "Acquitter" → le statut doit passer à "Acquittée"

### 9.4 KPIs

```powershell
# Résumé KPI
Invoke-RestMethod http://localhost:5000/api/kpi/summary -Headers $h

# KPI horaire
Invoke-RestMethod http://localhost:5000/api/kpi/hourly -Headers $h

# Stats WebSocket
Invoke-RestMethod http://localhost:5000/api/ws/stats
```

**Dans le navigateur :**

1. Dashboard → vérifier que les 4 cartes KPI (TD, EMJ, IPE, RCO2) affichent des valeurs
2. Page Compliance → vérifier le tableau des polluants et la jauge IPE
3. Lancer le simulateur en mode `critical` pendant 2 min → TD doit augmenter, IPE doit baisser

### 9.5 Rapports

1. Se connecter en tant qu'admin
2. Aller sur `/reports`
3. Remplir le formulaire (période, site)
4. Cliquer "Générer"
5. Vérifier l'aperçu et le téléchargement PDF

### 9.6 Tests unitaires backend

```powershell
cd backend

# Test d'intégration DB (seed + vérification)
npm test

# Tests des services (logique métier, sans HTTP)
npm run test:services

# Tests des erreurs HTTP (nécessite le serveur démarré)
npm run test:errors

# Test des calculs KPI
node test-kpi.js

# Inspection de l'état de la DB
node diagnose-sensors.js
node check-alerts.js
```

### 9.7 Tests unitaires frontend

```powershell
cd frontend

# Vérification TypeScript
npm run typecheck

# Lint
npm run lint

# Tests unitaires (exécution unique)
npm run test -- --run

# Tests unitaires avec couverture
npm run test:coverage

# Tests E2E Playwright (frontend doit être démarré)
npm run test:e2e
```

---

## 10. Comptes de test & rôles

| Email | Mot de passe | Rôle | Accès |
|-------|-------------|------|-------|
| `admin@example.com` | `admin123` | `SUPER_ADMIN` | Tout |
| `head@example.com` | `head123` | `HEAD_SUPERVISOR` | Multi-sites, gestion superviseurs |
| `site@example.com` | `site123` | `SITE_SUPERVISOR` | Site assigné, rapports |
| `operator@example.com` | `operator123` | `OPERATOR` | Monitoring zone assignée, acquittement alertes |
| `auditor@example.com` | `audit123` | `AUDITOR` | Lecture seule, rapports |

**Seuils des polluants (Décret Décret 2018-928, Annexe 1 — valeurs générales) :**

| Polluant | Unité | VLE (seuil légal) | Warning (80%) | Critical (120%) |
|----------|-------|-------------|---------|----------|
| CO2 | ppm | 800 | 640 | 960 |
| NOX | mg/Nm³ | 500 | 400 | 600 |
| SO2 | mg/Nm³ | 300 | 240 | 360 |
| COV | mg/Nm³ | 110 | 88 | 132 |
| PM25 | mg/m³ | 40 | 32 | 48 |
| TEMPERATURE | °C | — | — | — |
| HUMIDITY | % | — | — | — |

---

## 11. Problèmes connus & solutions

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `connect ECONNREFUSED :27017` | MongoDB non démarré | `Start-Service MongoDB` ou `mongod` |
| `[MQTT Service]` n'affiche pas "Connecté" | Mosquitto non démarré ou `MQTT_BROKER` incorrect | `Start-Service mosquitto` ou `mosquitto -v` |
| Backend démarré mais aucune lecture sauvegardée | Polluants/capteurs absents en DB | `npm run init:simulator` |
| Login retourne 500 | DB inaccessible ou utilisateurs non créés | `npm run init:users` |
| Login retourne 401 | Mauvais mot de passe | `node cleanup-users.js` puis `npm run init:users` |
| Frontend affiche "Erreur réseau" au login | `VITE_API_URL` incorrect ou CORS | Vérifier `.env.local` et `FRONTEND_URL` dans `backend/.env` |
| `/ws` ne se connecte pas | `VITE_WS_URL` incorrect ou backend sans WebSocket | Vérifier que le backend affiche "WebSocket activé" |
| Port 5000 ou 3000 déjà utilisé | Processus précédent encore actif | `netstat -ano \| findstr :5000` puis `taskkill /PID <pid> /F` |
| `EADDRINUSE :::5000` au démarrage | Ancien `node server.js` en arrière-plan | `netstat -ano \| Select-String ":5000.*LISTENING"` puis `taskkill /PID <pid> /F` |
| Login très lent (10–20 s) | Coût bcrypt élevé + charge MQTT | Déjà corrigé (coût 10). Relancer `npm run init:users` pour rehacher les comptes |
| Heap memory crash après ~15 min | Logs verbeux sous forte charge | Déjà corrigé (`--max-old-space-size=4096`). Activer les logs debug : `$env:DEBUG_MQTT="true"; npm start` |
| Dashboard crash `Cannot read properties of undefined` | `GET /api/kpi/config` retourne 404 | Exécuter `npm run init:kpi` pour créer la SiteConfig |
| Routes `/api/sites`, `/api/zones` retournent 404 | Routes non montées dans `server.js` | Comportement connu — ces routes sont du code mort |

**Réinitialisation rapide (garde les utilisateurs) :**

```powershell
cd backend
node clean-db.js          # Supprime readings + alerts
npm run init:simulator    # Recrée polluants/capteurs
```

**Réinitialisation totale :**

```powershell
cd backend
node clean-db.js
node cleanup-users.js
npm run init
npm run init:kpi
```

---

## 12. Référence rapide — toutes les commandes

### Backend

```powershell
cd backend

npm install                          # Installer les dépendances (1 fois)
node clean-db.js                     # Nettoyer readings + alerts
npm run init:simulator               # Créer industrie/capteurs/polluants
npm run init:users                   # Créer utilisateurs de démo
npm run init:thresholds              # Charger seuils légaux
npm run init:kpi                     # Configurer paramètres KPI
npm run init && npm run init:kpi     # Tout initialiser d'un coup
npm start                            # Démarrer le serveur (:5000)
npm test                             # Tests d'intégration DB
npm run test:services                # Tests services (sans HTTP)
npm run test:errors                  # Tests erreurs HTTP (serveur requis)
node test-kpi.js                     # Test calculs KPI
node diagnose-sensors.js             # Inspection état DB
node check-alerts.js                 # Statistiques alertes
node check-system-ready.js           # Vérification système prêt
```

### IoT Simulator

```powershell
cd iot

npm install                          # Installer les dépendances (1 fois)
npm start                            # Scénario random (défaut)
node simulator.js normal             # Valeurs normales (pas d'alertes)
node simulator.js warning            # Approche des seuils (alertes jaunes)
node simulator.js high               # Dépasse les seuils (alertes orange)
node simulator.js critical           # Dépassement sévère (alertes rouges)
npm test                             # Test fréquence d'envoi (2 min)
npm run test:frequency               # Listener seul (simulateur séparé)
```

### Frontend

```powershell
cd frontend

npm install                          # Installer les dépendances (1 fois)
Copy-Item .env.example .env.local    # Créer config (1 fois)
npm run dev                          # Serveur de développement (:3000)
npm run typecheck                    # Vérification TypeScript
npm run lint                         # ESLint
npm run format                       # Prettier
npm run test -- --run                # Tests unitaires (exécution unique)
npm run test:coverage                # Tests + rapport de couverture
npm run test:e2e                     # Tests E2E Playwright (headless)
npm run test:e2e:ui                  # Tests E2E Playwright (interface)
npm run build                        # Build production
npm run preview                      # Prévisualiser le build
```

### Arrêt des services

```powershell
# Dans chaque terminal : Ctrl+C

# Si un processus persiste
netstat -ano | findstr ":5000 :3000 :1883"
taskkill /PID <pid> /F

# Arrêter les services Windows
Stop-Service -Name "MongoDB","mosquitto" -ErrorAction SilentlyContinue
```

---

*Ce guide couvre le flux complet du système EmissionsIQ : nettoyage DB → initialisation → backend → simulateur IoT → frontend → validation end-to-end.*
