# API Reference
### Complete list of all server endpoints

---

## What is an API?

An **API** (Application Programming Interface) is the set of "doors" through which the frontend website communicates with the backend server. Each door has a specific address (URL), accepts specific inputs, and returns specific outputs.

Think of it like a restaurant menu — each item on the menu (endpoint) has a name, a description of what you get, and what you need to provide to order it.

All endpoints start with `/api` and the server runs on port 5000.

**How to read this document:**
- `GET` = "Give me data" (read-only)
- `POST` = "Create something new"
- `PUT` = "Update something existing"
- `DELETE` = "Remove something"
- 🔒 = Requires login (JWT token in Authorization header)
- `(ROLE)` = Only users with that role can use this endpoint

---

## Authentication Endpoints (`/api/auth`)

### POST /api/auth/login
**What it does:** Logs a user in and returns a security token.

**Send:**
```json
{
  "email": "operator@enim.tn",
  "password": "MyPassword123"
}
```

**Receive on success (200):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "...",
    "username": "operator",
    "email": "operator@enim.tn",
    "role": "OPERATOR"
  }
}
```
Also sets a `refreshToken` HttpOnly cookie.

**Rate limited:** Maximum 10 attempts per 15 minutes (production).

---

### POST /api/auth/register
**What it does:** Creates a new user account.

**Send:** `{ username, email, password, role }`

**Receive:** `{ success, user }`

---

### POST /api/auth/refresh
**What it does:** Gets a new access token using the refresh token cookie (called automatically by the frontend when the access token expires).

**Receive:** `{ success, accessToken }`

---

### POST /api/auth/logout
**What it does:** Logs the user out and invalidates their refresh token.

**Receive:** `{ success }`

---

### GET /api/auth/me 🔒
**What it does:** Returns the profile of the currently logged-in user.

**Receive:** `{ success, user }`

---

## KPI Endpoints (`/api/kpi`)

### GET /api/kpi/summary 🔒
**What it does:** Returns all 4 KPI values for a given period. This is the main endpoint used by the Overview dashboard.

**Optional filters:** `?siteId=...&zoneId=...&period=day` (period can be: day, week, month)

**Receive:**
```json
{
  "td": {
    "tauxDepassement": 1.5,
    "breachCount": 3,
    "totalCount": 200
  },
  "ipe": {
    "ipe": 92.5,
    "polluantScores": {
      "NOX": { "score": 88.0, "avgConcentration": 105.2, "vle": 120 }
    }
  },
  "emj": {
    "emissionKgDay": 0.0234,
    "avgConcentration": 45.2,
    "qAir": 2.0
  },
  "rco2": {
    "reductionPct": -3.2,
    "currentEmission": 0.021,
    "referenceEmission": 0.0217
  }
}
```

---

### GET /api/kpi/td/:polluantId 🔒
**What it does:** Calculates the Taux de Dépassement (exceedance rate) for one specific pollutant.

**Example:** `GET /api/kpi/td/64abc123...`

**Receive:** `{ tauxDepassement: 1.5, breachCount: 3, totalCount: 200 }`

---

### GET /api/kpi/emj/:polluantId 🔒
**What it does:** Calculates the average daily emission in kg/day for one pollutant.

**Receive:** `{ emissionKgDay: 0.0234, avgConcentration: 45.2, qAir: 2.0 }`

---

### GET /api/kpi/ipe 🔒
**What it does:** Calculates the overall Environmental Performance Index score (0–100).

**Receive:** `{ ipe: 92.5, polluantScores: {...}, weights: {...} }`

---

### GET /api/kpi/rco2/:polluantId 🔒
**What it does:** Calculates the CO₂ reduction percentage compared to a reference period.

**Receive:** `{ reductionPct: -3.2, currentEmission: 0.021, referenceEmission: 0.0217, reductionAbsolute: 0.0007 }`

---

### GET /api/kpi/history/:polluantId 🔒
**What it does:** Returns pre-computed historical KPI data for charts. Much faster than recalculating from raw readings.

**Filters:** `?period=DAILY&siteId=...&zoneId=...`

**Receive:**
```json
{
  "data": [
    { "avgValue": 45.2, "periodStart": "2026-05-01T00:00:00Z", "periodEnd": "2026-05-01T23:59:59Z", "count": 2880 },
    { "avgValue": 48.7, "periodStart": "2026-05-02T00:00:00Z", ... }
  ]
}
```

---

### GET /api/kpi/config 🔒
**What it does:** Returns the KPI configuration (air flow rate, pollutant weights, targets).

---

### POST /api/kpi/aggregate 🔒 (SUPER_ADMIN only)
**What it does:** Manually triggers the KPI aggregation process (normally runs automatically on a schedule).

---

### PUT /api/kpi/config/airflow 🔒 (SUPER_ADMIN only)
**What it does:** Updates the air flow rate (Q_air) used in the EMJ formula.

**Send:** `{ "airflow": 2.5 }`

---

### PUT /api/kpi/config/weights 🔒 (SUPER_ADMIN only)
**What it does:** Updates the pollutant weights used in the IPE formula.

**Send:** `{ "NOx": 0.3, "SO2": 0.25, "PM25": 0.25, "COV": 0.15, "CO2": 0.05 }`

---

### PUT /api/kpi/config/targets 🔒 (SUPER_ADMIN only)
**What it does:** Updates the KPI target values (e.g., TD target = 2%).

---

## Readings Endpoints (`/api/readings`)

### GET /api/readings/latest 🔒
**What it does:** Returns the most recent measurement from each sensor. Used by the pollutant cards on the dashboard.

**Filters:** `?siteId=...&zoneId=...&nodeId=...`

**Receive:** `{ "items": [ { "value": 135.7, "unit": "mg/Nm³", "timestamp": "...", "sensorType": "NOX" }, ... ] }`

---

### GET /api/readings 🔒
**What it does:** Returns historical readings with pagination. Used by the History page.

**Filters:** `?siteId=...&zoneId=...&polluantId=...&from=2026-05-01&to=2026-05-04&limit=100&offset=0`

**Receive:** `{ "items": [ Reading, ... ], "total": 5420 }`

---

## Alerts Endpoints (`/api/alerts`)

### GET /api/alerts 🔒
**What it does:** Returns a paginated list of alerts with optional filters.

**Filters:** `?status=open&severity=Critical&polluantId=...&from=...&to=...&page=1&pageSize=20`

**Receive:**
```json
{
  "items": [
    {
      "id": "...",
      "severity": "High",
      "type": "Threshold",
      "value": 135.7,
      "threshold": 120,
      "message": "NOX exceeded limit: 135.7 mg/Nm³ > 120 mg/Nm³",
      "timestamp": "2026-05-04T14:30:00Z",
      "isAcknowledged": false,
      "polluant": { "name": "NOX" },
      "sensor": { "model": "MQ-135" }
    }
  ],
  "total": 1038,
  "page": 1,
  "pageSize": 20
}
```

---

### GET /api/alerts/:id 🔒
**What it does:** Returns the full details of one specific alert.

---

### POST /api/alerts/:id/acknowledge 🔒
**What it does:** Marks an alert as acknowledged (the operator has seen it and is handling it). Records who acknowledged it and when.

**Roles allowed:** SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR, OPERATOR

**Send:** `{ "note": "Checked the furnace, adjusting air intake" }` (note is optional)

---

### POST /api/alerts/:id/resolve 🔒
**What it does:** Marks an alert as resolved (the problem has been fixed).

**Send:** `{ "resolutionNote": "Replaced faulty valve, emissions back to normal" }`

---

### GET /api/alerts/stats 🔒
**What it does:** Returns alert statistics — counts by severity and status.

**Receive:** `{ "open": 12, "critical": 3, "high": 5, "warning": 4, "acknowledged": 8, "resolved": 1018 }`

---

## Users Endpoints (`/api/users`)

### GET /api/users 🔒
**What it does:** Returns a list of users. The results are automatically filtered based on the requester's role:
- SUPER_ADMIN → sees all users
- HEAD_SUPERVISOR → sees users in their company
- SITE_SUPERVISOR → sees users in their sites
- OPERATOR/AUDITOR → access denied

**Filters:** `?role=OPERATOR&page=1&pageSize=20`

---

### POST /api/users 🔒 (SUPER_ADMIN only)
**What it does:** Creates a new user.

**Send:**
```json
{
  "username": "john_operator",
  "email": "john@enim.tn",
  "password": "SecurePass123",
  "role": "OPERATOR",
  "industryId": "...",
  "zonesAssigned": ["zone-id-1", "zone-id-2"]
}
```

---

### GET /api/users/:id 🔒
**What it does:** Returns the details of one specific user.

---

### PUT /api/users/:id 🔒 (SUPER_ADMIN only)
**What it does:** Updates a user's information.

---

### DELETE /api/users/:id 🔒 (SUPER_ADMIN only)
**What it does:** Deletes a user account.

---

### POST /api/users/:id/sites 🔒 (SUPER_ADMIN only)
**What it does:** Assigns sites to a HEAD_SUPERVISOR.

**Send:** `{ "siteIds": ["site-id-1", "site-id-2"] }`

---

### POST /api/users/:id/zones 🔒 (SUPER_ADMIN, SITE_SUPERVISOR)
**What it does:** Assigns zones to an OPERATOR.

**Send:** `{ "zoneIds": ["zone-id-1"] }`

---

### PUT /api/users/:id/role 🔒 (SUPER_ADMIN only)
**What it does:** Changes a user's role.

**Send:** `{ "role": "SITE_SUPERVISOR" }`

---

### GET /api/users/role/:role 🔒 (SUPER_ADMIN only)
**What it does:** Returns all users with a specific role.

**Example:** `GET /api/users/role/OPERATOR`

---

## Sites Endpoints (`/api/sites`)

| Method | Path | Who can use it | What it does |
|--------|------|---------------|-------------|
| GET | `/api/sites` | All logged-in users | List all accessible sites |
| POST | `/api/sites` | SUPER_ADMIN, HEAD_SUPERVISOR | Create a new site |
| GET | `/api/sites/:id` | All logged-in users | Get one site's details |
| PUT | `/api/sites/:id` | SUPER_ADMIN, HEAD_SUPERVISOR | Update a site |
| DELETE | `/api/sites/:id` | SUPER_ADMIN | Delete a site |

---

## Zones Endpoints (`/api/zones`)

| Method | Path | Who can use it | What it does |
|--------|------|---------------|-------------|
| GET | `/api/zones` | All logged-in users | List all accessible zones |
| POST | `/api/zones` | SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR | Create a new zone |
| GET | `/api/zones/:id` | All logged-in users | Get one zone's details |
| PUT | `/api/zones/:id` | SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR | Update a zone |
| DELETE | `/api/zones/:id` | SUPER_ADMIN | Delete a zone |
| POST | `/api/zones/:id/operators` | SUPER_ADMIN, SITE_SUPERVISOR | Assign operators to a zone |
| DELETE | `/api/zones/:id/operators` | SUPER_ADMIN, SITE_SUPERVISOR | Remove operators from a zone |

---

## Reports Endpoints (`/api/reports`)

### GET /api/reports 🔒
**What it does:** Returns a list of all generated reports.

**Filters:** `?from=...&to=...&type=PDF&page=1&pageSize=10`

---

### POST /api/reports 🔒 (SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR, AUDITOR)
**What it does:** Generates a new compliance report.

**Send:**
```json
{
  "title": "Monthly Compliance Report — May 2026",
  "type": "PDF",
  "periodStart": "2026-05-01T00:00:00Z",
  "periodEnd": "2026-05-31T23:59:59Z",
  "siteId": "..."
}
```

**Receive:** `{ "report": { "id": "...", "status": "pending", "fileUrl": null } }`

The report is generated asynchronously. Poll `GET /api/reports/:id` to check when `status` becomes `"ready"`.

---

### GET /api/reports/:id 🔒
**What it does:** Returns the details of one report, including the download URL once it's ready.

---

## Thresholds Endpoints (`/api/thresholds`)

### GET /api/thresholds 🔒
**What it does:** Returns the active threshold configuration (the legal limits for each pollutant).

**Receive:**
```json
{
  "config": {
    "nom": "Configuration Globale",
    "polluants": {
      "NOx": { "min": 0, "max": 120, "warning": 96, "critical": 144, "unit": "mg/Nm³" },
      "SO2": { "min": 0, "max": 120, "warning": 96, "critical": 144, "unit": "mg/Nm³" }
    }
  }
}
```

---

### PUT /api/thresholds/:id 🔒 (SUPER_ADMIN only)
**What it does:** Updates the threshold configuration.

---

## Site Config Endpoints (`/api/site-config`)

### GET /api/site-config 🔒
**What it does:** Returns the active site KPI configuration (air flow rate, weights, targets).

---

### PUT /api/site-config/:id 🔒 (SUPER_ADMIN only)
**What it does:** Updates the site configuration.

---

## Sensor Nodes Endpoints (`/api/sensor-nodes`)

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/api/sensor-nodes` | List all sensor nodes |
| POST | `/api/sensor-nodes` | Create a sensor node |
| GET | `/api/sensor-nodes/:id` | Get one node's details |
| PUT | `/api/sensor-nodes/:id` | Update a node |
| DELETE | `/api/sensor-nodes/:id` | Delete a node (SUPER_ADMIN) |

---

## Sensors Endpoints (`/api/sensors`)

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/api/sensors` | List all sensors |
| POST | `/api/sensors` | Create a sensor |
| GET | `/api/sensors/:id` | Get one sensor's details |
| PUT | `/api/sensors/:id` | Update a sensor |

---

## Pollutants Endpoints (`/api/polluants`)

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/api/polluants` | List all pollutants |
| POST | `/api/polluants` | Create a pollutant (SUPER_ADMIN) |
| GET | `/api/polluants/:id` | Get one pollutant's details |
| PUT | `/api/polluants/:id` | Update a pollutant (SUPER_ADMIN) |

---

## WebSocket (`/ws`)

The WebSocket connection is not a regular HTTP endpoint — it's a persistent two-way connection. Here is the message protocol:

### Step 1: Connect
```
Browser connects to: ws://localhost:5000/ws

Server immediately sends:
{ "type": "connected", "clientId": "client_1746364800_abc123" }
```

### Step 2: Authenticate
```
Browser sends:
{ "type": "authenticate", "payload": { "userId": "...", "role": "OPERATOR", "email": "operator@enim.tn" } }

Server responds:
{ "type": "authenticated", "message": "Authenticated as OPERATOR" }
```

### Step 3: Subscribe to Updates
```
Browser sends:
{ "type": "subscribe", "payload": { "topics": ["kpi:daily", "kpi:hourly"] } }

Server responds:
{ "type": "subscribed", "topics": ["kpi:daily", "kpi:hourly"] }
```

### Step 4: Receive Live Updates
```
Every 5 seconds, server sends:
{
  "type": "kpi_update",
  "topic": "kpi:daily",
  "timestamp": "2026-05-04T14:30:05Z",
  "data": { ... KPI data ... }
}

When a new alert is created, server sends:
{
  "type": "alert",
  "timestamp": "2026-05-04T14:30:00Z",
  "alert": { "severity": "High", "message": "NOX exceeded limit", ... }
}
```

### Heartbeat (Keep-Alive)
```
Browser sends every 30s: { "type": "ping" }
Server responds:         { "type": "pong" }
```

---

## WebSocket Stats Endpoint

### GET /api/ws/stats 🔒 (SUPER_ADMIN only)
**What it does:** Returns information about all currently connected WebSocket clients.

**Receive:**
```json
{
  "totalConnections": 3,
  "connections": [
    {
      "clientId": "client_1746364800_abc123",
      "userId": "...",
      "role": "OPERATOR",
      "email": "operator@enim.tn",
      "connectedAt": "2026-05-04T14:00:00Z",
      "subscribedTopics": ["kpi:daily"]
    }
  ]
}
```

---

## Error Response Format

All errors from the API follow the same format:

```json
{
  "success": false,
  "message": "A human-readable explanation of what went wrong"
}
```

For expired tokens, an extra field is added:
```json
{
  "success": false,
  "message": "Token expiré — Veuillez vous reconnecter",
  "expired": true
}
```

The frontend uses the `expired: true` flag to automatically refresh the token instead of showing a login prompt.

### HTTP Status Codes

| Code | Meaning | When it happens |
|------|---------|----------------|
| 200 | OK | Request succeeded |
| 201 | Created | New resource was created |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Not logged in, or token expired |
| 403 | Forbidden | Logged in but don't have permission |
| 404 | Not Found | The requested resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Something went wrong on the server |
