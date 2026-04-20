# 🧪 Full Test Instructions — Pollution Monitoring

Hands‑on guide to testing the three parts of this project:

| Part         | Folder       | Role                                                         |
| ------------ | ------------ | ------------------------------------------------------------ |
| **Backend**  | `backend/`   | REST API (`:5000`), MQTT ingestion, WebSocket `/ws`, MongoDB |
| **IoT**      | `iot/`       | Sensor simulator publishing to MQTT broker                   |
| **Frontend** | `frontend/`  | React + Vite app (`:3000`) — login, dashboards, live data    |

The `ia/` folder is **out of scope** (not implemented yet).

---

## Table of contents

1. [Architecture & data flow](#1-architecture--data-flow)
2. [Prerequisites](#2-prerequisites)
3. [One‑time environment setup](#3-one-time-environment-setup)
4. [Preflight — verify local services](#4-preflight--verify-local-services)
5. [Backend tests](#5-backend-tests)
6. [IoT simulator tests](#6-iot-simulator-tests)
7. [Frontend tests](#7-frontend-tests)
8. [End‑to‑end integration test (all three at once)](#8-endtoend-integration-test-all-three-at-once)
9. [Known caveats & gotchas](#9-known-caveats--gotchas)
10. [Troubleshooting](#10-troubleshooting)
11. [Cleanup / stopping services](#11-cleanup--stopping-services)

---

## 1. Architecture & data flow

```
┌────────────┐   MQTT (emissions/#)   ┌────────────┐   WebSocket /ws   ┌──────────────┐
│  iot/      │ ──────────────────────▶│  backend   │──────────────────▶│  frontend    │
│ simulator  │      :1883             │  :5000     │                   │  :3000       │
└────────────┘                        │            │   REST /api/*     │              │
                                      │  MongoDB   │◀──────────────────│              │
                                      │  :27017    │                   │              │
                                      └────────────┘                   └──────────────┘
```

- Simulator publishes JSON readings on `emissions/Zone-A/<SENSOR>`.
- Backend subscribes to `emissions/#`, resolves sensor+polluant, writes `Reading`, optionally creates an `Alert` when thresholds are crossed.
- Backend broadcasts KPI updates every 5 s over `/ws` and streams alerts over WebSocket.
- Frontend calls REST + opens WebSocket to render live KPIs and alerts.

---

## 2. Prerequisites

| Tool               | Used by                | Required version          | Notes                                  |
| ------------------ | ---------------------- | ------------------------- | -------------------------------------- |
| Node.js            | all                    | **20+** (Vite 5 needs it) | `node -v`                              |
| npm                | all                    | 9+                        | ships with Node                        |
| MongoDB            | backend                | 6+ on `localhost:27017`   | must be running                        |
| Mosquitto MQTT     | backend + IoT          | 2+ on `localhost:1883`    | must be running                        |
| `mosquitto_pub/sub`| optional (manual MQTT) | any                       | handy for §6.4                         |
| PowerShell         | commands in this guide | Windows default           | adapt quoting for bash/zsh if needed   |

Quick check that both daemons are listening:

```powershell
netstat -ano | Select-String ":27017|:1883"
```

You should see **two LISTENING** lines. If not, start MongoDB and Mosquitto first (Windows services or your usual command).

---

## 3. One‑time environment setup

### 3.1 Install dependencies

Run these **once per machine** (each in its own terminal — order does not matter):

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend;  npm install
cd c:\Users\melik\Desktop\pollution_monitoring\iot;      npm install
cd c:\Users\melik\Desktop\pollution_monitoring\frontend; npm install
```

### 3.2 Environment files

**`backend/.env`** (already present) — keys used:

| Variable               | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `MONGO_URI`            | e.g. `mongodb://localhost:27017/pollution_db`  |
| `PORT`                 | default `5000`                                 |
| `MQTT_BROKER`          | default `mqtt://localhost:1883`                |
| `JWT_ACCESS_SECRET`    | signs access tokens                            |
| `JWT_REFRESH_SECRET`   | signs refresh tokens                           |
| `JWT_ACCESS_EXPIRES`   | default `15m`                                  |
| `JWT_REFRESH_EXPIRES`  | default `7d`                                   |
| `NODE_ENV`             | `development` locally                          |
| `FRONTEND_URL`         | (optional) CORS origin, default `http://localhost:3000` |

**`iot/.env`** — keys used:

| Variable     | Purpose                                  |
| ------------ | ---------------------------------------- |
| `MQTT_BROKER`| default `mqtt://localhost:1883`          |
| *(others)*   | present but unused by current IoT scripts |

> ℹ️ The simulator reads its MQTT client‑id from `process.env.MQTT_CLIENTsensorId` (not `MQTT_CLIENT_ID`), so it falls back to `pollution-simulator`. Harmless.

**`frontend/.env.local`** — create it from the template:

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\frontend
Copy-Item .env.example .env.local
```

Minimum values:

```
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000/ws
VITE_ENABLE_DEVTOOLS=true
```

### 3.3 Seed the database

From `backend/`:

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm run init        # = init:simulator + init:users + init:thresholds
npm run init:kpi    # KPI SiteConfig + polluant weights (run once, separately)
```

This creates:

- **1 industry** (`Station-Sfax-01`), **1 sensor node** (`Zone-A`)
- **7 polluants** (CO2, NOX, SO2, COV, PM25, TEMPERATURE, HUMIDITY)
- **7 sensors** matching the simulator
- **5 demo users** (see credentials below)
- **1 global `ThresholdConfig`** document
- **1 active `SiteConfig`** for KPI calculations

#### Demo credentials

| Email                  | Password     | Role              |
| ---------------------- | ------------ | ----------------- |
| `admin@example.com`    | `admin123`   | `SUPER_ADMIN`     |
| `head@example.com`     | `head123`    | `HEAD_SUPERVISOR` |
| `site@example.com`     | `site123`    | `SITE_SUPERVISOR` |
| `operator@example.com` | `operator123`| `OPERATOR`        |
| `auditor@example.com`  | `audit123`   | `AUDITOR`         |

---

## 4. Preflight — verify local services

Run these **every time before testing** to avoid wasted debugging.

```powershell
# Mongo + MQTT listening?
netstat -ano | Select-String ":27017|:1883"

# Backend / frontend ports free?
netstat -ano | Select-String ":5000|:3000"
```

Expected:

- `27017` and `1883` → **LISTENING**
- `5000` and `3000` → **nothing** (unless a server is already running; kill it if you want a clean run)

---

## 5. Backend tests

> 💡 Run each section in the `backend/` folder:  
> `cd c:\Users\melik\Desktop\pollution_monitoring\backend`

### 5.1 Route / controller smoke load (no server, no DB)

Purely syntactic — good first check after code changes.

```powershell
node test-route-loading.js
node test-controller.js
```

**Pass**: each prints `✅ Loaded successfully` and a small inventory of the mounted stack.

### 5.2 Integration seed test (`tests/test.js`)

Connects to MongoDB, clears collections, seeds industrie/node/polluants/sensors, creates readings, alert, report.

```powershell
npm test
```

**Pass**: final line `Tests completed successfully`, exit code `0`. Inspect DB to see fresh docs.

### 5.3 Service‑layer error tests (`tests/serviceErrors.test.js`)

Exercises `ReadingService`, `AlertService`, `AuthService`, `SensorService` error branches directly (no HTTP).

```powershell
npm run test:services
```

**Pass**: summary line showing passed >> failed. Requires MongoDB only.

### 5.4 HTTP error‑handling tests (`tests/errorHandling.test.js`)

Uses `axios` to hit a **running** server on `:5000` and exercise 401/403/400 paths.

**Prereqs**: backend running (see 5.7) **and** `axios` installed (it is not in `package.json`, so add it if missing):

```powershell
npm i --save-dev axios
npm run test:errors
```

**Pass**: colored pass/fail tally; most 401/403 cases must pass.

### 5.5 KPI logic test (`test-kpi.js`)

Runs KPI/aggregation services against MongoDB (no HTTP).

```powershell
node test-kpi.js
```

**Pass**: ends with `TESTS TERMINÉS` and exit code `0`. Requires DB seeded (`npm run init`).

### 5.6 Data‑health utilities (read‑only)

Handy to inspect current state of the DB:

```powershell
node diagnose-sensors.js   # full dump: polluants, sensors, readings, alerts
node check-alerts.js       # counts + severity aggregation
```

### 5.7 Start the server

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm start
```

Look for these lines in the output (they confirm each subsystem started):

```
Serveur démarré sur le port 5000
✅ [MQTT Service] Connecté au broker: mqtt://localhost:1883
📡 [MQTT Service] Abonné au topic: emissions/#
WebSocket activé — écoute sur /ws
KPI Broadcaster activé
Schedulers KPI activés
MongoDB connected
```

### 5.8 Manual API tests (server must be running)

All snippets are PowerShell.

**Public route:**

```powershell
Invoke-RestMethod http://localhost:5000/
```

**Login:**

```powershell
$body = @{ email = "admin@example.com"; password = "admin123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri http://localhost:5000/api/auth/login `
  -Method POST -Body $body -ContentType "application/json"
$token = $login.data.accessToken
$token.Substring(0,40) + "..."
```

Expected: `success: true`, message contains `Bienvenue admin`, token printed.

**Get current user (protected):**

```powershell
Invoke-RestMethod http://localhost:5000/api/auth/me `
  -Headers @{ Authorization = "Bearer $token" }
```

**Readings (latest):**

```powershell
Invoke-RestMethod "http://localhost:5000/api/readings?limit=5" `
  -Headers @{ Authorization = "Bearer $token" }
```

**Alerts:**

```powershell
Invoke-RestMethod "http://localhost:5000/api/alerts" `
  -Headers @{ Authorization = "Bearer $token" }
```

**KPI summary (protected):**

```powershell
Invoke-RestMethod http://localhost:5000/api/kpi/summary `
  -Headers @{ Authorization = "Bearer $token" }
```

**WebSocket stats:**

```powershell
Invoke-RestMethod http://localhost:5000/api/ws/stats
```

### 5.9 RBAC endpoint test

With the server running:

```powershell
node test-rbac-endpoints.js
node test-with-logs.js
node debug-routes.js
node compare-routes.js      # expect /api/sites → 404 (route not mounted, see §9)
```

**Pass**: admin JWT obtains `200` on `/api/users`, non‑admin JWTs receive `403` on admin‑only routes.

### 5.10 WebSocket client (optional)

Quick Node REPL client to verify `/ws`:

```powershell
node -e "const W=require('ws'); const ws=new W('ws://localhost:5000/ws'); ws.on('open',()=>{console.log('open'); ws.send(JSON.stringify({type:'authenticate',payload:{userId:'u1',role:'SUPER_ADMIN',email:'admin@example.com'}})); ws.send(JSON.stringify({type:'subscribe',payload:{topics:['kpi:hourly','alerts:all']}}));}); ws.on('message',m=>console.log('<=',m.toString().slice(0,200)));"
```

You should see `connected`, `authenticated`, `subscribed`, then a `kpi_update` every 5 s.

---

## 6. IoT simulator tests

> 💡 Run each in the `iot/` folder:  
> `cd c:\Users\melik\Desktop\pollution_monitoring\iot`

### 6.1 Start the simulator (default random scenario)

```powershell
npm start
```

Expected console:

- ASCII banner with `Station-Sfax-01 / Zone-A / Scénario: RANDOM`
- `✅ Connecté au broker MQTT : mqtt://localhost:1883`
- Table of 7 sensors with intervals (10 s / 15 s / 30 s)
- A stream of 🟢/🟡/🟠/🔴 lines, one per sensor reading

### 6.2 Scenario matrix

| Command                              | Effect                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `node simulator.js`                  | **Default `random`**: 65% normal, 15% warning, 12% high, 8% critical      |
| `node simulator.js normal`           | Values stay in normal band                                                |
| `node simulator.js warning`          | Values targeted to warning band (yellow alerts expected)                  |
| `node simulator.js high`             | Values in high band (orange alerts, `severity: high`)                     |
| `node simulator.js critical`         | Values in critical band (red alerts, `severity: critical`)                |
| `node simulator.js foobar`           | Rejected → stderr + exit code 1                                           |

Verify backend is ingesting: watch the backend terminal for `📥 [MQTT] Reçu` and `📥 [READING] Ingesting reading` lines, plus `[ALERT]` entries when thresholds trip.

### 6.3 Frequency test suite

End‑to‑end timing check: confirms each sensor publishes at its configured interval (±20 %).

**Full suite** (starts simulator in warning mode, runs listener for 2 min, tears down):

```powershell
npm test
```

**Listener only** (you must already be running the simulator in another terminal):

```powershell
# Terminal 1
npm start                       # or any scenario
# Terminal 2
npm run test:frequency
```

**Pass**: final line `✅ Tous les tests de fréquence ont réussi !` and exit code `0`.  
**Fail** (exit 1): a per‑sensor report will show which sensor deviated beyond tolerance.

> The test runs for **2 minutes** by design. NOX/SO2/COV publish every 30 s, so ≥ 3 samples are expected.

### 6.4 Manual MQTT publish (bypass the simulator)

Useful for:

- Triggering a known critical alert on demand
- Testing backend with payloads the simulator wouldn't produce

**Using `mosquitto_pub`:**

```powershell
mosquitto_pub -h localhost -p 1883 -t "emissions/Zone-A/CO2" -q 1 -m "{\"sensorType\":\"CO2\",\"model\":\"MH-Z19B\",\"zone\":\"Zone-A\",\"nodeName\":\"Station-Sfax-01\",\"value\":1500,\"rawValue\":1498.1,\"unit\":\"ppm\",\"level\":\"critical\",\"timestamp\":\"2026-04-18T12:00:00.000Z\",\"isValid\":true,\"rssi\":-60,\"battery\":null}"
```

**Or a pure Node one‑liner** (from `iot/`):

```powershell
node -e "require('mqtt').connect('mqtt://localhost:1883').on('connect',c=>{c.publish('emissions/Zone-A/CO2',JSON.stringify({sensorType:'CO2',model:'MH-Z19B',zone:'Zone-A',nodeName:'Station-Sfax-01',value:1500,rawValue:1498.1,unit:'ppm',level:'critical',timestamp:new Date().toISOString(),isValid:true,rssi:-60,battery:null}),{qos:1},()=>process.exit(0));});"
```

Backend should log `[ALERT] Vérification des seuils pour CO2 … Critical? 1500 > 1200 = true` and create a new `Alert` document.

**Verify via REST:**

```powershell
# reuse $token from 5.8
Invoke-RestMethod "http://localhost:5000/api/alerts?severity=critical&limit=3" `
  -Headers @{ Authorization = "Bearer $token" }
```

### 6.5 Required message shape

Backend matches sensors by `sensorType` + `model`, and polluants by `sensorType = Polluant.name`. These are the **only** values the backend enforces — everything else in the payload is logged/persisted as‑is.

Minimum fields for ingestion:

```json
{
  "sensorType": "CO2",
  "model": "MH-Z19B",
  "value": 650,
  "unit": "ppm"
}
```

Recommended fields (what the simulator sends): add `zone`, `nodeName`, `rawValue`, `level`, `timestamp`, `isValid`, `rssi`, `battery`.

---

## 7. Frontend tests

> 💡 Run each in the `frontend/` folder:  
> `cd c:\Users\melik\Desktop\pollution_monitoring\frontend`

### 7.1 Static checks

```powershell
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (zero warnings)
npm run format         # prettier write
```

### 7.2 Unit / component tests (Vitest)

Existing specs cover:

- `src/features/kpi/utils/kpiCalculations.test.ts` — KPI math
- `src/lib/rbac/checkPermission.test.ts` — role permission checks
- `src/components/kpi/KPICard/KPICard.test.tsx` — KPI card render
- `src/components/ui/Button/Button.test.tsx` — Button component

Run modes:

```powershell
npm run test              # watch mode (interactive)
npm run test -- --run     # single run, exits when done
npm run test:ui           # Vitest UI in the browser
npm run test:coverage     # HTML coverage under ./coverage
```

**Pass**: all specs green in terminal or UI.

### 7.3 Dev server

```powershell
npm run dev
```

Expected:

```
VITE v5.4.x ready in Xms
➜  Local:   http://localhost:3000/
```

Open http://localhost:3000 — the app must redirect you to `/login`.

### 7.4 Manual UI flow (backend + simulator recommended running)

Walk through these with the browser DevTools open (Network + Console):

1. **Login redirect**  
   Visit `/` → auto‑redirected to `/login`.

2. **Login success** — use `admin@example.com` / `admin123`. Confirm:
   - `POST /api/auth/login` returns 200 with `data.accessToken`
   - Refresh cookie is set (DevTools → Application → Cookies → `refreshToken`)
   - Navigated to `/` (Overview)

3. **Overview page**  
   - KPI cards load (React Query fires multiple `/api/kpi/...` calls)
   - WebSocket badge in the top bar is **green** (LiveIndicator)
   - Every ~5 s the “last update” timestamp refreshes (driven by `kpi_update` from `/ws`)

4. **Alerts page** (`/alerts`)  
   - List of alerts with severity colors
   - Trigger a critical alert via §6.4 → the page should refresh automatically (WebSocket subscribes to `alerts:all` and invalidates the React Query cache).

5. **History / Compliance / AI / Reports / Config**  
   - All should render. `/ai` and `/reports` require specific permissions — test with admin first, then retry as other users to confirm redirects to `/unauthorized`.

6. **Logout**  
   - Use the user menu. Confirm in‑memory access token is cleared and subsequent routes redirect to `/login`.

7. **Role‑based access**  
   Re‑login with `auditor@example.com` / `audit123` and confirm:
   - Config page (`/config`) redirects to `/unauthorized` (no `VIEW_CONFIG`)
   - Overview / History / Compliance remain accessible

### 7.5 E2E tests (Playwright)

```powershell
npm run test:e2e          # headless run
npm run test:e2e:ui       # interactive UI mode
```

- Default base URL: `http://localhost:3000` (override with `$env:E2E_BASE_URL = "..."`).
- **Frontend must be running** (`npm run dev` or `npm run preview`) unless you set `CI=1` (then Playwright starts `npm run preview` itself — see `playwright.config.ts`).

Existing spec (`e2e/login.spec.ts`):

1. **redirects unauthenticated users to `/login`** — loads `/`, asserts URL and heading.
2. **shows validation errors for empty form** — submits empty form, expects the French validation messages.

**Pass**: both tests green in Chromium + Firefox projects.

### 7.6 Docker build (optional smoke test)

```powershell
docker build -t emissionsiq/frontend:latest .
docker run --rm -p 3000:80 emissionsiq/frontend:latest
```

Open http://localhost:3000 — you'll get the production bundle served by nginx. Note that **API/WS proxy targets `backend:5000`**, so this is only useful with the companion `docker compose up` (see `frontend/docker-compose.yml`).

---

## 8. End‑to‑end integration test (all three at once)

Open **three terminals** (or three VS Code terminals). Start them in this order:

```powershell
# Terminal 1 — backend
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm start

# Terminal 2 — IoT simulator (after backend reports MQTT connected)
cd c:\Users\melik\Desktop\pollution_monitoring\iot
npm start                # or: node simulator.js critical

# Terminal 3 — frontend
cd c:\Users\melik\Desktop\pollution_monitoring\frontend
npm run dev
```

### Verification checklist

- [ ] Backend logs show `📥 [MQTT] Reçu` every 10–30 s per sensor
- [ ] Backend logs show `📥 [READING] Ingesting reading` successfully (no warnings about missing sensor/polluant)
- [ ] For high/critical scenarios, backend logs `[ALERT]` lines and creates `Alert` docs
- [ ] `GET /api/readings?limit=5` (with token) returns the most recent simulator values
- [ ] `GET /api/alerts` returns a non‑empty list after running `critical` for ~1 min
- [ ] Frontend `/alerts` list grows in real time as new alerts arrive
- [ ] LiveIndicator in the top bar stays green, with `lastUpdate` refreshing every ~5 s
- [ ] Stopping the simulator → readings stop arriving but UI stays online

### Quick health snapshot (PowerShell)

```powershell
$body = @{ email="admin@example.com"; password="admin123" } | ConvertTo-Json
$t = (Invoke-RestMethod http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json").data.accessToken
$h = @{ Authorization = "Bearer $t" }

"readings: " + (Invoke-RestMethod "http://localhost:5000/api/readings?limit=100" -Headers $h).data.Count
"alerts:   " + (Invoke-RestMethod "http://localhost:5000/api/alerts" -Headers $h).data.Count
"ws:       " + (Invoke-RestMethod http://localhost:5000/api/ws/stats).websocket.totalClients
```

---

## 9. Known caveats & gotchas

These are real issues in the current code — noting them so your tests aren’t misread as failures.

1. **Four route files are not mounted in `server.js`.**  
   `siteManagementRoutes.js`, `zoneManagementRoutes.js`, `siteConfigManagementRoutes.js`, `thresholdConfigManagementRoutes.js` exist but are dead code. Requests to `/api/sites`, `/api/zones`, etc. will return **404**. `compare-routes.js` and `test-routes-detailed.js` probe these — expect 404s.

2. **`GET /api/users/role/:role` is shadowed.**  
   `GET /:id` is registered before `GET /role/:role` in `userManagementRoutes.js`, so that endpoint will match `:id = "role"` instead. Use `GET /api/users?role=SUPER_ADMIN` filtering in the service layer if the controller supports it, or fix the route order.

3. **KPI admin routes: `checkRole(["admin"])` bug.**  
   The middleware expects rest‑args (`checkRole("SUPER_ADMIN")`), but KPI routes pass a single array argument. Result: `POST /api/kpi/aggregate`, `PUT /api/kpi/config/airflow|weights|targets` will return **403** for every real role until fixed.

4. **`test-login.js` reads `data.accessToken`**, but the controller returns `data.data.accessToken`. Script may print "no token" despite a successful login. The other `test-*.js` scripts use the correct path.

5. **CORS / token storage:** the frontend keeps the **access token in memory only** and the refresh token in an HttpOnly cookie. A hard reload re‑runs `/api/auth/me`; if the refresh cookie is missing, you bounce to `/login`. This is intended.

6. **MQTT auth:** the simulator and backend use an unauthenticated local broker. Don't expose `:1883` publicly.

7. **`tests/errorHandling.test.js` needs `axios`** (not in `package.json`). Install it before running.

---

## 10. Troubleshooting

| Symptom                                              | Check                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `connect ECONNREFUSED ... :27017`                    | MongoDB isn’t running. Start it.                                      |
| `[MQTT Service]` never logs “Connecté”               | Mosquitto isn’t running, or `MQTT_BROKER` env is wrong.               |
| Backend up, but no readings saved                    | Simulator publishes; check `📥 [MQTT] Reçu`. If missing, run `node diagnose-sensors.js` — polluant/sensor rows might be absent; re‑run `npm run init`. |
| Login returns 500                                    | DB unreachable or users not seeded. Run `npm run init:users`.         |
| Login returns 401                                    | Wrong password. Reset by running `node cleanup-users.js` then `npm run init:users`. |
| Frontend shows “Erreur réseau” on login              | Wrong `VITE_API_URL`, backend not on 5000, or CORS (`FRONTEND_URL`) mismatch. |
| `/ws` never connects in the browser                  | Check `VITE_WS_URL` or that backend printed `WebSocket activé`.       |
| Frequency test fails on NOX/SO2/COV                   | 30 s interval + 2 min window = 4 samples expected; long GC or CPU spikes can breach ±20 % tolerance. Re‑run. |
| Playwright errors “Target closed”                    | Frontend dev server isn’t running or port 3000 is occupied.           |
| Port 5000 / 3000 already in use                      | `netstat -ano \| findstr :5000` → `taskkill /PID <pid> /F`.           |
| `EADDRINUSE: address already in use :::5000` on `npm start` | A previous `node server.js` (often a background process from an earlier Cursor session) is still holding the port. Find + kill it: `netstat -ano \| Select-String ":5000.*LISTENING"` then `taskkill /PID <pid> /F`. |
| Backend crashes after ~10–15 min with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` | Was caused by very verbose `console.log` per MQTT message flooding stdout under the simulator's load. Already fixed: the hot-path logs in `backend/services/ReadingService.js` and `backend/services/mqttService.js` are now gated behind `DEBUG_INGEST=true` / `DEBUG_MQTT=true`, and `npm start` runs with `--max-old-space-size=4096`. Re-enable verbose logs ad-hoc with `$env:DEBUG_MQTT="true"; npm start`. |
| `POST /api/auth/login` (or any API) times out after 20 s while backend is running and the terminal shows an endless stream of `Alerte ... créée` lines | The simulator is firing so many threshold-breaching readings that the alert engine is saturating Mongo and starving the event loop. Already fixed: `ReadingService.checkAndCreateAlert` now debounces — a given (sensor, polluant) will only create a new alert either (a) on severity escalation, or (b) after the cooldown window. Tune the window via `ALERT_DEBOUNCE_MS` (default 300000 ms = 5 min). To recover an already-saturated backend: `Ctrl+C` the IoT simulator terminal, wait for the pending inserts to drain, then log in. |
| Overview page crashes with `Cannot read properties of undefined (reading 'filter')` and console shows `GET /api/kpi/summary 400` + `GET /api/kpi/config 404` | Three underlying bugs, all fixed: (1) `frontend/src/features/alerts/api/alertApi.ts` was reading `data.alerts` from the backend response but the backend returns `data: Alert[]` (flat array), so `items` ended up `undefined` and `alerts.data.items.filter(...)` crashed — the adapter now accepts both shapes; (2) `frontend/src/features/kpi/api/kpiApi.ts` was sending `?period=day` while the backend expects `?period=DAILY&periodStart=ISO&periodEnd=ISO` — the client now translates; (3) `GET /api/kpi/config` returned 404 when no `SiteConfig` row existed — it now returns a `{ isDefault: true }` payload, AND `npm run init` now also runs `init:kpi` so the real config is seeded by default. If you already ran `npm run init` before this fix, run `npm run init:kpi` once to seed the site config. |
| Login succeeds but takes 10–20 seconds; backend prints `[AUTH] login OK for <email> in 2xxxxms (slow)` | The backend uses `bcryptjs` (pure-JS bcrypt, no native binding). At its original cost factor **12**, each `bcrypt.compare` was ~1–3 s baseline, and under contention from MQTT ingestion it ballooned to ~20 s because `bcryptjs` yields cooperatively via `setImmediate`. Already fixed: cost factor is now **10** (the `bcryptjs` default, still secure) across `backend/models/User.js`, `backend/services/AuthService.js`, `backend/services/UserManagementService.js` — tunable via `BCRYPT_COST` env var. Because existing users in Mongo still carry their old cost-12 hash, run `npm run init:users` once; the script is now idempotent and will rehash the demo accounts at the new cost. Expected login time after this: ~200–500 ms. |

Reset everything to a clean slate (keeps users):

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend
node clean-db.js          # deletes readings + alerts
npm run init:simulator    # reseed polluants/sensors
```

Nuke users too:

```powershell
node cleanup-users.js
npm run init:users
```

---

## 11. Cleanup / stopping services

In each running terminal press `Ctrl+C`. If something lingers:

```powershell
# find PIDs
netstat -ano | findstr ":5000 :3000 :1883"

# kill by PID
taskkill /PID <pid> /F
```

Stop the whole Mosquitto / MongoDB services (only if you started them manually):

```powershell
# Windows services (if installed as services)
Stop-Service -Name "MongoDB","mosquitto" -ErrorAction SilentlyContinue
```

---

## Quick reference — all test commands in one place

```powershell
# BACKEND
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm install
npm run init && npm run init:kpi        # seed DB
node test-route-loading.js              # load check
node test-controller.js                 # load check
npm test                                # seed + integration
npm run test:services                   # service-layer errors
npm run test:errors                     # HTTP errors (needs server + axios)
node test-kpi.js                        # KPI service test
node diagnose-sensors.js                # DB inspection
npm start                               # run API (:5000)

# IOT
cd c:\Users\melik\Desktop\pollution_monitoring\iot
npm install
npm start                               # random scenario
node simulator.js critical              # force critical alerts
npm test                                # frequency suite (simulator + listener)
npm run test:frequency                  # listener only (simulator must run separately)

# FRONTEND
cd c:\Users\melik\Desktop\pollution_monitoring\frontend
npm install
Copy-Item .env.example .env.local       # one time
npm run typecheck
npm run lint
npm run test -- --run                   # unit tests, one shot
npm run test:coverage                   # unit tests + coverage report
npm run dev                             # dev server (:3000)
npm run test:e2e                        # Playwright
npm run test:e2e:ui                     # Playwright UI
```

---

**Last updated:** April 18, 2026
