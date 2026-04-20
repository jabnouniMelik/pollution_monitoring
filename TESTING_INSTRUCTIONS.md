# 🧪 Comprehensive Testing Guide — Pollution Monitoring System

**Last Updated:** April 15, 2026  
**Coverage:** Database • Backend (3-Tier) • Frontend (React) • All Functionalities • 120+ Test Cases  
**Status:** Ready for Phase 6 Testing & Validation

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Architecture Overview](#-architecture-overview)
3. [Database Tests](#-database-tests)
4. [Backend API Tests](#-backend-api-tests)
5. [Frontend Component Tests](#-frontend-component-tests)
6. [User Role-Based Tests](#-user-role-based-tests)
7. [Integration Tests](#-integration-tests)
8. [Performance & Security Tests](#-performance--security-tests)
9. [Data Validation Tests](#-data-validation-tests)
10. [Test Checklist](#-test-checklist)
11. [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### Initialize Everything (First Time Only)

```powershell
# Terminal 1: Backend setup
cd backend
npm run init:simulator    # Create initial data
npm test                  # Test DB connection

# Terminal 2: Start backend (keep running)
node server.js

# Terminal 3: Start IoT simulator
cd ../iot
node simulator.js critical  # Test with alerts

# Terminal 4: Run tests (in another shell)
npm run test:all
```

---

## 🏗️ Architecture Overview

### 3-Tier Backend Architecture

```
┌─────────────────────────────────────────┐
│         FRONTEND (React)                 │
│  Dashboard • LiveMonitor • Theme System  │
│  User Roles: Admin / Inspector / Operator
└──────────────────┬──────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────────┐
│      BACKEND (Node.js + Express)        │
│  ┌─────────────────────────────────┐    │
│  │    CONTROLLER LAYER             │    │
│  │ (HTTP requests/responses only)  │    │
│  │ 8 Controllers: Auth, Reading,   │    │
│  │ Alert, Report, etc.             │    │
│  └──────────────┬──────────────────┘    │
│                 │                        │
│  ┌──────────────▼──────────────────┐    │
│  │    SERVICE LAYER                │    │
│  │ (Business logic, validation)    │    │
│  │ • ReadingService                │    │
│  │ • AlertService                  │    │
│  │ • ReportService (KPI/IPE)       │    │
│  │ • AuthService + 4 more          │    │
│  └──────────────┬──────────────────┘    │
│                 │                        │
│  ┌──────────────▼──────────────────┐    │
│  │    REPOSITORY LAYER             │    │
│  │ (MongoDB CRUD operations)       │    │
│  │ 9 Repositories per collection   │    │
│  └──────────────┬──────────────────┘    │
└──────────────────┼──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         DATABASE (MongoDB)              │
│  8+ Collections: readings, alerts,      │
│  reports, users, sensors, etc.          │
└─────────────────────────────────────────┘
```

### Data Flow: MQTT → Services → DB

```
IoT Simulator (MQTT)
    ↓ emissions/industrie1/node1/co2 = 584 ppm
MQTT Broker
    ↓
Backend MQTT Service (subscribers)
    ↓
ReadingService.ingestReading()  ← Validates
    ↓
ReadingRepository.create()      ← Persists
    ↓
ReadingService.checkAndCreateAlert() ← Checks thresholds
    ↓
AlertRepository.create()        ← If needed
    ↓
MongoDB (readings & alerts)
```

---

## 🗄️ Database Tests

### Test Suite 1: Database Connection & Collections

**Commands:**

```powershell
npm run test:db -- connection.test.js
npm run test:db -- collections.test.js
npm run test:db -- schema.test.js
```

**Test Coverage:**

- ✅ MongoDB connection (readyState === 1)
- ✅ All models registered (User, Industrie, Sensor, Reading, Alert, Report, etc.)
- ✅ Collections exist and have proper indexes
- ✅ Schema validation (required fields, field types)
- ✅ Database timestamps auto-generated

**Expected Results:**

```
✅ MongoDB connection successful
✅ All models are registered
✅ Collections have correct indexes
✅ Schema validation working
PASS: All 12 tests
```

---

### Test Suite 2: Repository CRUD Operations

**Test Files:**

- `backend/tests/repositories/reading.crud.test.js`
- `backend/tests/repositories/alert.crud.test.js`
- `backend/tests/repositories/report.crud.test.js`
- `backend/tests/repositories/user.crud.test.js`

**Read**ingRepository Tests:\*\*

- ✅ Create reading with values
- ✅ Read reading by ID
- ✅ Find readings by sensor/node/date
- ✅ Update reading
- ✅ Delete reading
- ✅ Pagination and sorting

**AlertRepository Tests:**

- ✅ Create alert with severity
- ✅ Find alerts by severity (Warning/High/Critical)
- ✅ Find unacknowledged alerts
- ✅ Acknowledge alert
- ✅ Count by status

**ReportRepository Tests:**

- ✅ Create report with IPE score
- ✅ Find by date range
- ✅ Calculate statistics

**Commands:**

```powershell
npm run test:db -- repositories.test.js
npm run test:db:coverage  # Include coverage report
```

---

### Test Suite 3: Data Constraints & Validation

**Test Focus:**

- ❌ Reject negative reading values
- ❌ Reject invalid alert severity
- ❌ Enforce email uniqueness
- ❌ Validate IPE score (0-1 range)
- ✅ Auto-generate timestamps
- ✅ Enforce required fields

**Example Validations:**

```
Reading value must be positive
Email must be unique
User password must be hashed
IPE score must be between 0 and 1
Timestamps must be auto-generated
```

---

## 🔌 Backend API Tests

### Test Suite 4: Authentication & Authorization

**File:** `backend/tests/api/auth.test.js`

**Endpoints Tested:**

- `POST /api/auth/register` - Create user
- `POST /api/auth/login` - Authenticate
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Invalidate token

**Test Cases:**

```javascript
✅ Register new user with valid data
✅ Login with correct credentials
❌ Login with wrong password (401)
❌ Missing required fields (400)
✅ JWT token validation working
✅ Token expiration enforcement
❌ Expired token returns 401
❌ Invalid token format returns 401
✅ RBAC enforcement (only admins → /api/users)
```

**Expected Results:**

```
✅ POST /api/auth/register → 201 Created
✅ POST /api/auth/login → 200 OK
❌ POST /api/auth/login (bad pwd) → 401 Unauthorized
✅ Bearer token required for protected routes
```

---

### Test Suite 5: Readings API & Service

**File:** `backend/tests/api/readings.test.js`

**Endpoints Tested:**

- `GET /api/readings?page=1&limit=20` - List readings
- `GET /api/readings?sensorId=sensor-1` - Filter by sensor
- `GET /api/readings?startDate=X&endDate=Y` - Filter by date
- `POST /api/readings` - Manual entry (admin only)

**ReadingService Tests:**

```javascript
✅ ingestReading() validates and stores
✅ Reading automatically triggers alert check
✅ checkAndCreateAlert() calculates severity
  - WARNING: value > limit × 0.75
  - HIGH: value > limit × 1.2
  - CRITICAL: value > limit × 1.5
✅ Threshold comparisons correct
```

**Test Data Flow:**

```
MQTT: value=1050 ppm, limit=800, critical_threshold=1200
    ↓
ReadingService.ingestReading() validates
    ↓
checkAndCreateAlert() evaluates: 1050 < 1200 → HIGH severity
    ↓
AlertRepository.create() stores alert
    ↓
API /api/alerts returns alert with severity=High
```

---

### Test Suite 6: Alerts API & Service

**File:** `backend/tests/api/alerts.test.js`

**Endpoints Tested:**

- `GET /api/alerts?page=1&limit=20` - List alerts
- `GET /api/alerts?severity=Critical` - Filter
- `GET /api/alerts?acknowledged=false` - Unacknowledged only
- `PATCH /api/alerts/:id/acknowledge` - Inspector action
- `GET /api/alerts/stats` - Alert summary

**AlertService Tests:**

```javascript
✅ escalateAlert() increases severity
  Warning → High → Critical
✅ acknowledgeAlert() records inspector ID
✅ getUnacknowledgedCount() returns count
✅ Alert statistics aggregation
```

**Expected Results:**

```
✅ GET /api/alerts → 200 OK with array
✅ PATCH /api/alerts/123/acknowledge → 200 OK
  { isAcknowledged: true, acknowledgedBy: inspectorId }
✅ GET /api/alerts/stats → { total: 45, critical: 12, high: 25, ... }
```

---

### Test Suite 7: Reports, KPIs, and IPE

**File:** `backend/tests/api/reports.test.js`

**Endpoints Tested:**

- `GET /api/reports?page=1&limit=10` - List reports
- `GET /api/reports?industrieId=xyz` - Filter by industrie
- `POST /api/reports/generate` - Generate monthly/quarterly report
- `GET /api/kpi/dashboard` - KPI summary
- `GET /api/kpi/industrie/:id` - Industrie KPIs

**ReportService - IPE Calculation:**

**IPE Formula:**

```
IPE = max(0, 1 - Σ(weight × (value - limit) / limit))

Weights:
- NOx: 0.3
- SO2: 0.25
- PM2.5: 0.25
- COV: 0.15
- CO2: 0.05

Result: 0 (worst) to 1 (perfect compliance)
```

**Test Cases:**

```javascript
✅ calculateIPE() returns 0-1 range
✅ IPE = 1 when all readings normal
✅ IPE = 0 when all exceed 150% of limit
✅ Monthly report generation
✅ Quarterly report generation
❌ Non-inspector cannot generate reports (403)
```

---

## 🎨 Frontend Component Tests

### Test Suite 8: React Components

**File:** `frontend/src/__tests__/Dashboard.test.jsx`

**Components Under Test:**

```javascript
✅ Dashboard component renders
✅ KPI cards (Readings, Alerts, IPE Score)
✅ Tabs (Overview, Sensors, Compliance)
✅ Tab switching works
✅ Data loading states
✅ Error messaging
```

**Commands:**

```powershell
npm run test:frontend
npm run test:frontend -- --watch
npm run test:frontend -- --coverage
```

---

### Test Suite 9: Theme System (Phase 5)

**File:** `frontend/src/__tests__/theme/Theme.test.jsx`

**Theme Features Tested:**

```javascript
✅ ThemeSwitcher renders and toggles
✅ Theme persists in localStorage
✅ ThemeManager displays all available themes
✅ Custom theme creation via ThemeCustomizer
✅ Theme import/export JSON functionality
✅ High-contrast mode WCAG AAA compliant
✅ CSS variables bound correctly
✅ Transitions smooth (0.3s)
```

**Test Cases:**

```
✅ Click toggle → theme switches dark ↔ light
✅ Refresh page → theme persists from localStorage
✅ Select custom theme → applies in real-time
✅ Export theme as JSON → valid format
✅ Import JSON → creates custom theme
✅ High-contrast text passes a11y audit
```

---

### Test Suite 10: User Type Views

**File:** `frontend/src/__tests__/views/UserViews.test.jsx`

**Admin View (account@enim.tn → admin@enim.tn):**

```javascript
✅ See user management interface
✅ Can create/delete users
✅ Can generate reports
✅ Access all data (no filters)
✅ See system settings
✅ View database statistics
```

**Inspector View (permission to acknowledge alerts):**

```javascript
✅ See readings & alerts
✅ Can acknowledge alerts
✅ Can generate reports
✅ Limited to assigned industries/zones
❌ Cannot delete users
❌ Cannot modify system settings
``` 

**Operator View (monitoring only):**

```javascript
✅ See monitoring dashboard
✅ View historical data
✅ Live sensor feed
❌ Cannot create reports
❌ Cannot acknowledge alerts
❌ Cannot modify any data
```

---

## 🔗 Integration Tests

### Test Suite 11: End-to-End Flows

**File:** `backend/tests/integration/e2e.test.js`

**Complete Flow Test: MQTT → Alert → API**

```javascript
Step 1: Start MQTT simulator
  simulator.start('critical')
  ↓
Step 2: Wait for data
  sleep 5000ms
  ↓
Step 3: Verify reading created
  ReadingRepository.find() → readings.length > 0
  ↓
Step 4: Verify alert created
  AlertRepository.findByReading(reading._id) → alerts[0].severity = 'Critical'
  ↓
Step 5: Verify API returns alert
  GET /api/alerts/[id] → 200 OK
  → response.data.severity = 'Critical'
```

**Expected Flow Timing:**

```
T+0s: Simulator sends MQTT: CO2=1050ppm
T+0.1s: MQTT Service receives
T+0.2s: ReadingService.ingestReading() validates
T+0.3s: ReadingRepository.create() persists
T+0.4s: checkAndCreateAlert() evaluates
T+0.5s: AlertRepository.create() stores alert
T+1s: API returns alert via GET /api/alerts
```

---

### Test Suite 12: Alert Escalation Workflow

**Scenario: User discovers equipment issue → Alert acknowledgment**

```javascript
Step 1: MQTT sends WARNING data (600 ppm)
  → ReadingService creates Warning alert
  → API: GET /api/alerts → severity='Warning'

Step 2: MQTT escalates to HIGH (850 ppm)
  → New Reading created
  → NEW Alert created with severity='High'
  → API: GET /api/alerts → [Warning, High]

Step 3: Inspector acknowledges in UI
  → PATCH /api/alerts/[id]/acknowledge
  → Backend records: acknowledgedBy, acknowledgedAt
  → API: GET /api/alerts → isAcknowledged=true
```

---

### Test Suite 13: Report Generation with Real Data

```javascript
Step 1: Simulator runs for 30 seconds (various scenarios)
  Normal → Warning → High → Critical

Step 2: Post /api/reports/generate
  Input: { industrieId, period: 'daily', startDate, endDate }

Step 3: ReportService.calculateIPE()
  - Fetches all readings for period
  - Calculates weight × excess for each pollutant
  - IPE = max(0, 1 - total_excess)
  - Stores in DB

Step 4: Verify via API
  GET /api/reports/[id]
  → ipeScore = 0.65 (example)
  → status = 'generated'
  → timestamp = current
```

---

## 🔒 Performance & Security Tests

### Test Suite 14: Performance

**File:** `backend/tests/performance.test.js`

```javascript
✅ Reading ingestion < 50ms per item
   100 readings → ~40ms average

✅ Fetch 1000 readings < 500ms
   MongoDB indexed query

✅ Alert filtering < 100ms
   Query: { severity: 'Critical', isAcknowledged: false }

✅ API response time < 200ms
   Includes network round-trip

✅ Handle 100 concurrent requests
   All complete without timeout or error
```

**Load Test Commands:**

```powershell
npm run test:performance
npm run test:load -- --concurrent=100 --duration=60s
```

---

### Test Suite 15: Security

**File:** `backend/tests/security.test.js`

```javascript
❌ SQL Injection protection
   Input: "'; DROP TABLE readings; --"
   Result: Treated as literal string, ignored

✅ Password hashing
   plaintext !== stored hash
   comparePassword('plain') → true
   comparePassword('wrong') → false

❌ JWT token expiration
   Expired token: 401 Unauthorized
   Invalid token: 401 Unauthorized

✅ CORS configured
   Allowed origins: [process.env.FRONTEND_URL]
   Other domains: Rejected

❌ Rate limiting (auth endpoints)
   20 failed attempts → 429 Too Many Requests

❌ XSS protection
   Input: '<script>alert("XSS")</script>'
   Stored: HTML-escaped, not executable

❌ CSRF token validation
   Request without token: 403 Forbidden
```

---

## 🔍 Data Validation Tests

### Test Suite 16: Input Validation

**File:** `backend/tests/validation.test.js`

**Reading Validation:**

```javascript
✅ Accept: { sensorId, value: 584.5, unit: 'ppm' }
❌ Reject: value = -100 (negative)
❌ Reject: missing sensorId
❌ Reject: invalid unit
❌ Reject: value > 999999999 (overflow)
```

**User Validation:**

```javascript
❌ Reject: email = 'not-an-email'
❌ Reject: password = '123' (too weak)
❌ Reject: role = 'superuser' (invalid)
✅ Require: password ≥ 8 chars with uppercase/number
```

**Alert Validation:**

```javascript
❌ Reject: severity = 'Unknown'
✅ Accept: severity ∈ ['Warning', 'High', 'Critical']
✅ Auto-calculate severity from reading value
```

---

## ✅ Test Checklist

### Quick Checklist Before Deployment

**Database Layer (8 tests)**

- [ ] MongoDB connection working
- [ ] All models registered
- [ ] Collections initialized
- [ ] Indexes created
- [ ] CRUD operations working
- [ ] Constraints enforced
- [ ] Timestamps auto-generated
- [ ] Validation working

**Repository Layer (9 tests)**

- [ ] ReadingRepository CRUD
- [ ] AlertRepository CRUD
- [ ] ReportRepository CRUD
- [ ] UserRepository CRUD
- [ ] Query filters working
- [ ] Pagination working
- [ ] Sorting working
- [ ] Error handling

**Service Layer (8 tests)**

- [ ] ReadingService.ingestReading()
- [ ] ReadingService.checkAndCreateAlert()
- [ ] AlertService.escalateAlert()
- [ ] AlertService.acknowledgeAlert()
- [ ] ReportService.calculateIPE()
- [ ] AuthService.register/login
- [ ] KPI calculations
- [ ] Error handling

**Controller Layer (8 tests)**

- [ ] All HTTP methods working
- [ ] Authentication enforced
- [ ] Authorization enforced
- [ ] Input validation triggered
- [ ] Responses formatted correctly
- [ ] Error messages clear
- [ ] Status codes correct
- [ ] Rate limiting working

**Frontend (15+ tests)**

- [ ] Components render
- [ ] User routes working
- [ ] Theme switching
- [ ] Form validation
- [ ] Error handling
- [ ] Loading states
- [ ] User type views
- [ ] Responsive design

**Integration (10+ tests)**

- [ ] MQTT → Reading flow
- [ ] Reading → Alert flow
- [ ] Alert → API flow
- [ ] Report generation
- [ ] KPI calculations
- [ ] User authentication
- [ ] Role-based access
- [ ] Data persistence

**Security (8 tests)**

- [ ] SQL injection protection
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Password hashing
- [ ] JWT validation
- [ ] CORS configured
- [ ] Rate limiting
- [ ] Input sanitization

**Performance (5 tests)**

- [ ] Reading ingestion < 50ms
- [ ] Query < 500ms
- [ ] API response < 200ms
- [ ] Concurrent requests handled
- [ ] Memory usage acceptable

**Total: 80+ core tests + 40+ scenario tests = 120+ comprehensive tests**

---

## Run All Tests

```powershell
# Everything
npm run test:all

# By category
npm run test:db
npm run test:api
npm run test:frontend
npm run test:integration
npm run test:security
npm run test:performance

# With coverage
npm run test:coverage

# Watch mode (auto-rerun on changes)
npm run test:watch
```

---

## 🐛 Troubleshooting

### Database Tests Fail

```
Cause: MongoDB not running
Solution:
  # Start MongoDB
  mongod

  # Or use Docker
  docker run -d -p 27017:27017 mongo

  # Verify
  mongo --eval "db.version()"
```

### API Tests Fail

```
Cause: Backend not running
Solution:
  cd backend
  npm run init:simulator   # First time setup
  node server.js          # Start backend

  # In another terminal
  npm run test:api
```

### Frontend Tests Fail

```
Cause: Missing dependencies
Solution:
  cd frontend (or root)
  npm install
  npm run test:frontend
```

### MQTT Tests Fail

```
Cause: Mosquitto not running
Solution:
  # Install
  sudo apt-get install mosquitto     # Linux
  brew install mosquitto              # macOS
  choco install mosquitto             # Windows

  # Start
  mosquitto -v

  # Verify
  mosquitto_pub -h localhost -t test -m "hello"
```

---

## 📊 Test Results Template

**After running all tests, verify:**

```
Database Tests: 15/15 ✅
API Tests: 40/40 ✅
Frontend Tests: 25/25 ✅
Integration Tests: 15/15 ✅
Security Tests: 8/8 ✅
Performance Tests: 5/5 ✅
Validation Tests: 20/20 ✅

Total: 128/128 tests passing ✅

Coverage:
- Statements: 85%+
- Branches: 80%+
- Functions: 85%+
- Lines: 85%+

Ready for Production ✅
```

---

**Last Updated:** April 15, 2026  
**Test Framework:** Jest + React Testing Library  
**Coverage Target:** 85%+  
**Status:** Phase 6 - Comprehensive Testing (ACTIVE)

### ❌ Erreur: "EndpointNotFound" quand vous testez une alerte

```
Cause: Un endpoint API utilise l'ancien chemin vers le modèle directement
Debug:
  1. Vérifiez que le route file importe le bon Controller
  2. Vérifiez que le Controller délègue au Service
  3. Vérifiez que le Service utilise le Repository

Exemple (readingRoute.js doit avoir):
  const readingController = require('../controllers/readingController');

Et readingController doit avoir:
  const readingService = require('../services/readingService');
  const reading = await readingService.ingestReading(data);
```

### ⚠️ Pas d'alertes créées — Checklist complète

1. ✅ Backend démarre sans erreur → Tous les Services/Repositories chargés?
2. ✅ MQTT se connecte → Logs affichent "[MQTT Service] Connecté au broker"?
3. ✅ npm run init:simulator exécuté → Polluants/Sensors créés?
4. ✅ Simulateur envoie des données → Logs affichent "[14:36:32] CO2 : 584 ppm"?
5. ✅ Backend reçoit MQTT → Logs affichent "[MQTT] Message reçu"?
6. ✅ ReadingService valide → Pas d'erreurs Service?
7. ✅ Seuils dépassés → Valeur > regulatoryLimit?
8. ✅ AlertRepository sauvegarde → Checks logs pour "Alert created"?
9. ✅ MongoDB mémorise → Vérifiez collection `alerts` dans MongoDB Compass

Si aucune alerte, vérifiez chaque couche de l'architecture:

```
Simulator → MQTT Service → ReadingService → ReadingRepository → MongoDB
                              ↓
                    checkAndCreateAlert() → AlertRepository → MongoDB
```

---

## 📊 Résumé des commandes

### Backend (3-Tier Architecture)

| Action         | Commande                                    | Dossier    | Couche         |
| -------------- | ------------------------------------------- | ---------- | -------------- |
| Init DB        | `npm test`                                  | `backend/` | Repositories   |
| Init Simulator | `npm run init:simulator`                    | `backend/` | Services/Repos |
| Start Backend  | `node server.js`                            | `backend/` | All layers     |
| Syntax check   | `node -c controllers/readingController.js`  | `backend/` | Controllers    |
| Syntax check   | `node -c services/readingService.js`        | `backend/` | Services       |
| Syntax check   | `node -c repositories/readingRepository.js` | `backend/` | Repositories   |

### IoT Simulator

| Action              | Commande                     | Dossier |
| ------------------- | ---------------------------- | ------- |
| Test IoT auto       | `npm test`                   | `iot/`  |
| Test fréquence seul | `npm run test:frequency`     | `iot/`  |
| Test NORMAL         | `node simulator.js normal`   | `iot/`  |
| Test WARNING        | `node simulator.js warning`  | `iot/`  |
| Test HIGH           | `node simulator.js high`     | `iot/`  |
| Test CRITICAL       | `node simulator.js critical` | `iot/`  |
| Test RANDOM         | `node simulator.js random`   | `iot/`  |

### API Verification

| Action       | Commande                                             | Destination |
| ------------ | ---------------------------------------------------- | ----------- |
| Get Alerts   | `Invoke-WebRequest http://localhost:5000/api/alerts` | All layers  |
| Get Readings | `curl http://localhost:5000/api/readings`            | Services    |
| Get Reports  | `curl http://localhost:5000/api/reports`             | Services    |

---

## 🎯 Ordre de lancement recommandé

### Architecture Setup

**Terminal 1 — Initialisation backend (UNE SEULE FOIS)**

```powershell
cd C:\Users\melik\Desktop\pollution_monitoring\backend
npm test  # Teste la couche Repository + MongoDB connection
```

**Terminal 2 — Backend Server (3-tier layers active)**

```powershell
cd C:\Users\melik\Desktop\pollution_monitoring\backend
node server.js
# Attendez: "✅ Serveur démarré sur le port 5000"
# Cela charges: Controllers, Services, Repositories, MQTT Service
```

**Terminal 3 — Simulator Init (une fois backend lancé)**

```powershell
cd C:\Users\melik\Desktop\pollution_monitoring\backend
npm run init:simulator
# Crée: Industrie, SensorNode, Polluants, Capteurs
```

**Terminal 4 — IoT Simulator (teste la chaîne MQTT → Services)**

```powershell
cd C:\Users\melik\Desktop\pollution_monitoring\iot

# Option 1: Test progressif (recommandé pour comprendre la progression)
node simulator.js normal      # 2 min
node simulator.js warning     # 2 min
node simulator.js high        # 2 min
node simulator.js critical    # 2-5 min

# Option 2: Test continu
node simulator.js random      # Continu — Ctrl+C pour arrêter
```

**Terminal 5 — API Verification (vérifie les Services, Repos, DB)**

```powershell
# Vérifier que les alertes ont été créées par les Services
curl http://localhost:5000/api/alerts \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# Ou via PowerShell
$token = (Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -Body (@{email="admin@enim.tn";password="Admin1234"} | ConvertTo-Json) `
  -ContentType "application/json").data.accessToken

Invoke-RestMethod http://localhost:5000/api/alerts `
  -Headers @{Authorization="Bearer $token"} | Select-Object -ExpandProperty data
```

### Flux de données complet (3-Tier)

```
IoT Simulator
    ↓ (MQTT publish)
MQTT Broker (localhost:1883)
    ↓ (message reçu)
Backend: MQTT Service
    ↓
Backend: ReadingController → ReadingService → ReadingRepository
    ↓
MongoDB: Collection `readings` (created)
    ↓
Backend: ReadingService.checkAndCreateAlert()
    ↓
Backend: AlertController → AlertService → AlertRepository
    ↓
MongoDB: Collection `alerts` (created if threshold exceeded)
    ↓
API Response: /api/alerts (fetched by AlertController from AlertService)
```

---

## 📝 Notes importantes

1. **Ne fermez pas** la fenêtre du backend — elle doit rester active
2. **Changez de scénario** en arrêtant le simulateur (Ctrl+C) et en relançant avec un nouveau scénario
3. **Surveillez les logs** du backend pour diagnostiquer les problèmes à chaque couche:
   - Controller layer → Route logs
   - Service layer → Business logic logs
   - Repository layer → DB operation logs
4. **Les alertes s'accumulent** — elles ne sont pas supprimées automatiquement
5. **Chaque capteur a sa fréquence propre:**
   - CO2, TEMPERATURE, HUMIDITY: toutes les 10s
   - NOX, SO2, COV: toutes les 30s
   - PM25: toutes les 15s

### Architecture 3-Tier Recap

La majorité de la logique métier est maintenant dans **Services**:

- **ReadingService** → `ingestReading()`, `checkAndCreateAlert()`
- **AlertService** → `acknowledge()`, `escalate()`, stats
- **ReportService** → `calculateIPE()` (scoring environnemental)
- **AuthService** → `register()`, `login()`, `refresh()`

Les **Controllers** se concentrent uniquement sur:

- Parsing les requêtes HTTP
- Appeler les Services appropriés
- Formater les réponses HTTP

Les **Repositories** ne font que:

- CRUD opérations MongoDB
- Requêtes spécialisées (findByNodeId, etc.)
- Zéro logique métier

**Avantage:** Tests de logique métier peuvent cibler les Services directement, sans passer par HTTP.

---

## 🎯 Tests avancés (Services layer)

### Tester ReadingService directement

```javascript
// Dans backend/tests/readingService.test.js (si créé)
const ReadingService = require("../services/readingService");

// Test: la fonction checkAndCreateAlert() crée bien une alerte
const reading = await ReadingService.ingestReading({
  sensorId: "sensor123",
  value: 950, // Dépasse le seuil de 800
  unit: "ppm",
});

// Vérifier qu'une alerte a été créée
const alerts = await AlertRepository.findAll({ reading: reading._id });
assert(alerts.length > 0, "Alert should be created");
assert(alerts[0].severity === "High", "Severity should be High");
```

### Tester ReportService (IPE calculation)

```javascript
// Test: ReportService.calculateIPE() calcule correctement
const ipe = await ReportService.calculateIPE(periodStart, periodEnd);

// IPE formule: max(0, 1 - (value - VLE) / VLE) si dépassement
// Weights: NOx 0.3, SO2 0.25, PM2.5 0.25, COV 0.15, CO2 0.05
```

---

## 🎓 Ressources

### Architecture & Design

- [3-Tier Architecture Pattern](https://en.wikipedia.org/wiki/Multitier_architecture)
- [Repository Pattern](https://www.martinfowler.com/eaaCatalog/repository.html)
- [Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)

### Technologies utilisées

- [MongoDB Documentation](https://docs.mongodb.com/manual/)
- [Mongoose ODM](https://mongoosejs.com/docs/)
- [Express.js](https://expressjs.com/)
- [MQTT Documentation](https://mqtt.org/)
- [Node.js MQTT Client](https://github.com/mqttjs/MQTT.js)
- [JWT Authentication](https://jwt.io/)

### Backend Organization

- Collection `industries` → IndustrieRepository
- Collection `sensors` → SensorRepository
- Collection `sensor_nodes` → SensorNodeRepository
- Collection `readings` → ReadingRepository (via ReadingService)
- Collection `alerts` → AlertRepository (via AlertService, triggered by ReadingService)
- Collection `reports` → ReportRepository (via ReportService)
- Collection `users` → UserRepository (via AuthService)

---

**Dernière mise à jour:** 07/04/2026 (Architecture 3-Tier)
**Version:** 2.0 (Includes Service & Repository layers)
