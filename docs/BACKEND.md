# Backend — Documentation
### Node.js/Express server on port 5000

---

## Startup Sequence

```
1. Load .env
2. Connect MongoDB
3. Register all routes
4. server.listen(5000)
5. startMQTTService()   → subscribes to emissions/#
6. initializeWebSocket() → opens /ws
7. startKPIBroadcaster() → pushes KPI every 5s
8. kpiScheduler.start()  → hourly/daily/monthly aggregations
```

---

## Folder Structure

```
backend/
├── server.js              ← Entry point
├── simulator.js           ← Real-time IoT simulator (MQTT publisher)
├── init-fresh.js          ← Wipe DB + seed complete demo data
│
├── config/
│   ├── db.js              ← MongoDB connection (pool size 200)
│   └── jwt.js             ← Token generation/verification
│
├── routes/                ← Express routers (14 files)
├── controllers/           ← HTTP handlers (thin, delegate to services)
├── services/              ← Business logic
├── repositories/          ← MongoDB query layer
├── models/                ← Mongoose schemas (14 collections)
├── middleware/            ← verifyToken, checkRole, errorHandler
└── schedulers/            ← KPI aggregation cron jobs
```

---

## Key Services

### ReadingService
Ingests sensor readings from MQTT:
1. Validates sensor exists and is active
2. Validates pollutant exists
3. Saves Reading to MongoDB
4. Calls `checkAndCreateAlert()`

### Alert Engine (ReadingService.checkAndCreateAlert)

**One active alert per (sensorId × polluantId).** No duplicates.

```
value > warningThreshold?
  NO  → autoResolve() if open alert exists
  YES → No open alert → create new
        Open alert exists:
          severity escalated → update immediately
          30s window expired → update value/timestamp
          otherwise → skip
```

**Severity levels:**
- `Warning` — value > warningThreshold but ≤ regulatoryLimit
- `High` — value > regulatoryLimit
- `Critical` — value > regulatoryLimit × 1.5

**Message format:**
- Warning: `"NOX approche le seuil — Risque de dépassement : -12.50%"` (negative = still below limit)
- High/Critical: `"NOX dépasse le seuil — Dépassement : +18.30%"` (positive = above limit)

**Auto-resolve:** Sets `resolvedAt`, `resolvedBy=null`. Does NOT set `isAcknowledged`.

**Cache warm-up:** On server start, loads all open alerts into `_activeAlerts` Map so state survives restarts.

**Config:** `ALERT_UPDATE_WINDOW_MS=30000` (30 seconds, configurable via env)

### AlertRepository

| Method | Description |
|--------|-------------|
| `acknowledge(id, userId)` | Sets `isAcknowledged=true`, `acknowledgedAt`, `acknowledgedBy` only |
| `resolve(id, userId, note)` | Sets `resolvedAt`, `resolvedBy`, `resolutionNote` only |
| `autoResolve(id, note)` | Sets `resolvedAt`, `resolvedBy=null` — system resolution |
| `updateActive(id, {...})` | Updates value/severity/message in place — no new document |

**Important:** `acknowledge` and `resolve` are independent. Resolving does NOT force-acknowledge.

### Alert Filtering (AlertRepository._buildScopedFilter)

Alerts have no direct `zoneId`/`siteId` field. Filtering goes through:
```
Zone._id → Zone.code → SensorNode.zone (string, case-insensitive) → Sensor.sensorNodeId → Alert.SensorId
```

Uses `$or` with `$regex` (NOT `$in` with RegExp — MongoDB doesn't support that).

Backend RBAC scoping in `alertController`:
- `SITE_SUPERVISOR` → `_siteIds` from `req.user.sitesManaging`
- `HEAD_SUPERVISOR` → `_industryId` from `req.user.industryId`

### SiteManagementService

**createSite:** Auto-creates initial zone. Both site and zone get `approvalStatus: "PENDING"`.

**assignSites:** When assigning sites to SITE_SUPERVISOR, automatically derives and sets `industryId` from the first site's `industrieId`.

**approveSite:** Also activates the initial zone via `Zone.updateMany()`.

### ZoneManagementService

All ID comparisons use `(obj.field?._id || obj.field)?.toString()` to handle both populated objects and raw ObjectIds (repositories use `.populate()`).

`req.user.userId` (not `req.user._id`) is used for all user ID comparisons.

---

## Site/Zone Approval Workflow

```
POST /api/sites  (HEAD_SUPERVISOR)
  → approvalStatus: "PENDING", actif: false
  → initial zone also created with PENDING

GET /api/sites/pending  (SUPER_ADMIN)
  → returns PENDING + PREPARING sites
  → includes initialZone data (pollutants, code, nom)
  → zones belonging to pending sites are EXCLUDED from /api/zones/pending

PATCH /api/sites/:id/prepare  (SUPER_ADMIN)
  → approvalStatus: "PREPARING"
  → stores sensorNodeNote

POST /api/sites/:id/approve  (SUPER_ADMIN)
  → approvalStatus: "APPROVED", actif: true
  → also activates all PENDING/PREPARING zones of this site

GET /api/sites/my-requests  (any authenticated user)
  → returns all site/zone requests made by req.user
  → includes initialZone data for site requests
```

---

## MQTT / Simulator

**Topic format:** `emissions/<zoneCode>/<pollutantCode>`

**Payload:**
```json
{
  "sensorType": "NOX",
  "model": "MiCS-6814",
  "value": 87.3,
  "unit": "mg/Nm³",
  "zone": "Zone-Four",
  "nodeId": "...",
  "sensorId": "...",
  "timestamp": "2026-05-11T14:30:00.000Z",
  "isValid": true
}
```

**Simulator modes:**
```bash
node simulator.js            # normal (some alerts)
node simulator.js warning    # 40% above baseline (more alerts)
node simulator.js critical   # 90% above baseline (many Critical)
node simulator.js random     # random 0.5×–2.0×
```

Simulator reads SensorNodes from DB on startup — always matches the seeded data.

---

## verifyToken Middleware

Fetches from DB on every request (not from JWT):
```js
req.user = {
  userId, email, role, zone,
  industryId: dbUser.industryId?.toString() || null,
  sitesManaging: dbUser.sitesManaging || [],
  zonesAssigned: dbUser.zonesAssigned || [],
}
```

This ensures `industryId`/`sitesManaging` are always current even if changed without re-login.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017/pollution_db` | MongoDB connection |
| `PORT` | `5000` | HTTP server port |
| `MQTT_BROKER` | `mqtt://localhost:1883` | MQTT broker URL |
| `JWT_ACCESS_SECRET` | — | Access token signing key |
| `JWT_REFRESH_SECRET` | — | Refresh token signing key |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh token lifetime |
| `ALERT_UPDATE_WINDOW_MS` | `30000` | Alert update window (30s) |
| `SIM_INTERVAL_MS` | `10000` | Simulator publish interval (10s) |
| `DEBUG_INGEST` | `false` | Verbose reading/alert logs |
| `NODE_ENV` | `development` | Environment mode |

---

## Database Collections

| Collection | Purpose |
|-----------|---------|
| `readings` | Sensor measurements (172k+ per 30 days) |
| `alerts` | Active/resolved threshold breaches |
| `users` | All user accounts with role + assignments |
| `industries` | Industrial companies |
| `sites` | Factory sites (with approval workflow) |
| `zones` | Monitoring zones (with approval workflow) |
| `sensornodes` | Physical ESP32 devices |
| `sensors` | Individual sensors per node |
| `polluants` | Pollutant catalog with thresholds |
| `siteconfigs` | KPI parameters (airflow, weights, targets) |
| `thresholdconfigs` | Regulatory limits per pollutant |
| `refreshtokens` | Active refresh tokens |
| `aggregatedatas` | Pre-computed hourly/daily/monthly KPI summaries |
| `reports` | Generated report metadata |

---

## API Routes Summary

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/login` | Login → access token + refresh cookie |
| `POST /api/auth/refresh` | Refresh access token |
| `GET /api/auth/me` | Current user profile (populated zones/industry) |
| `GET /api/users` | List users (RBAC-scoped) |
| `GET /api/sites/pending` | Pending site approvals (SUPER_ADMIN) |
| `GET /api/sites/my-requests` | My pending requests (supervisors) |
| `PATCH /api/sites/:id/prepare` | Mark site as preparing |
| `POST /api/sites/:id/approve` | Approve site + initial zone |
| `GET /api/zones/pending` | Pending zone approvals (excludes initial zones of pending sites) |
| `PATCH /api/zones/:id/prepare` | Mark zone as preparing |
| `GET /api/alerts` | Alerts (RBAC-scoped by role) |
| `POST /api/alerts/:id/acknowledge` | Acknowledge (isAcknowledged only) |
| `POST /api/alerts/:id/resolve` | Resolve (resolvedAt only) |
| `GET /api/kpi/summary` | KPI summary for current period |
| `GET /api/readings/latest` | Latest reading per sensor |
