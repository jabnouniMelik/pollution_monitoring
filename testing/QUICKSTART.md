# EmissionsIQ — Full Workflow Testing Guide

Complete step-by-step guide to test the entire stack:
**IoT simulator → MQTT → Backend → MongoDB → Frontend Dashboard**

---

## Prerequisites

- MongoDB running on `localhost:27017`
- Mosquitto MQTT broker running on `localhost:1883`
- Node.js installed
- Dependencies installed in `backend/` and `iot/` (`npm install`)
- Frontend dependencies installed in `frontend/` (`npm install`)

---

## Step 1 — Wipe Operational Data

Clears readings, alerts, KPI aggregates, reports, industries, sites, zones, sensor nodes, and sensors.
Keeps: users, polluants, threshold configs, site configs.

```bash
node testing/scripts/00-wipe-operational-data.js
```

---

## Step 2 — Seed Full Test Data

Creates 3 industries with sites, zones, sensor nodes, sensors, polluants, threshold config, site config, and demo users.

```bash
node testing/scripts/01-seed-full-data.js
```

**What gets created:**

| Industry            | Sector       | Site                        | Zones                                          |
|---------------------|--------------|-----------------------------|------------------------------------------------|
| Cimenterie Sfax     | Ciment       | Site Principal Sfax         | Zone-A (Fours), Zone-B (Concassage)            |
| Raffinerie Bizerte  | Pétrochimie  | Site Distillation Bizerte   | Zone-A (Distillation), Zone-B (Stockage)       |
| Chimie Gabès        | Chimie       | Site Réacteurs Gabès        | Zone-A (Réacteurs), Zone-B (Traitement)        |

Each zone has 1 SensorNode with 7 sensors: CO2, NOX, SO2, PM25, COV, TEMPERATURE, HUMIDITY.

**Login credentials:**

| Role            | Email                    | Password     |
|-----------------|--------------------------|--------------|
| SUPER_ADMIN     | admin@example.com        | admin123     |
| HEAD_SUPERVISOR | head@example.com         | head123      |
| SITE_SUPERVISOR | site@example.com         | site123      |
| OPERATOR        | operator@example.com     | operator123  |
| AUDITOR         | auditor@example.com      | auditor123   |

---

## Step 3 — Start the Backend

```bash
cd backend
npm start
```

Backend runs on **http://localhost:5000**

Watch for:
- `✅ MongoDB connected`
- `✅ MQTT connected`
- `✅ WebSocket initialized`
- `✅ KPI scheduler started`

---

## Step 4 — Start the Frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

Frontend runs on **http://localhost:3000**

---

## Step 5 — Start the IoT Simulator

In a new terminal. Choose a scenario:

```bash
# Mix of normal/warning/critical (recommended for full testing)
node testing/scripts/02-multi-simulator.js random

# All values safe — no alerts triggered
node testing/scripts/02-multi-simulator.js normal

# Values near thresholds — warning alerts triggered
node testing/scripts/02-multi-simulator.js warning

# Values above thresholds — critical alerts triggered
node testing/scripts/02-multi-simulator.js critical
```

The simulator publishes on topics: `emissions/Zone-A/CO2`, `emissions/Zone-B/NOX`, etc.
The backend subscribes to `emissions/#` and processes all messages.

---

## Step 6 — Test the Dashboard (SuperAdmin Workflow)

Open **http://localhost:3000** and login as `admin@example.com / admin123`.

### 6.1 — Overview Dashboard
- [ ] Real-time readings appear in charts
- [ ] KPI cards show TD, EMJ, IPE, RCO2 values
- [ ] WebSocket connection active (live updates without page refresh)

### 6.2 — Alerts
- [ ] Alerts appear when simulator sends values above thresholds
- [ ] Severity levels: Warning / High / Critical
- [ ] Acknowledge an alert → status changes
- [ ] Alert history is paginated

### 6.3 — Industries & Sites Management
- [ ] 3 industries visible in the list
- [ ] Click an industry → see its sites and zones
- [ ] Edit an industry name/contact
- [ ] Create a new industry via the UI form
- [ ] Delete the newly created industry

### 6.4 — Zones Management
- [ ] 6 zones visible (2 per industry)
- [ ] Each zone shows its sensor nodes
- [ ] Assign an operator to a zone

### 6.5 — Sensor Nodes & Sensors
- [ ] 6 sensor nodes visible
- [ ] Each node shows 7 sensors
- [ ] Node status shows "Active"
- [ ] Real-time readings visible per sensor

### 6.6 — KPIs & Compliance
- [ ] TD (Taux de Dépassement) calculated per polluant
- [ ] EMJ (Émission Moyenne/Jour) shown in kg/jour
- [ ] IPE (Indice Performance Environnementale) score /100
- [ ] RCO2 (Réduction CO2) percentage
- [ ] KPI history charts render correctly

### 6.7 — Users Management
- [ ] All 5 demo users visible
- [ ] Create a new user (HEAD_SUPERVISOR role)
- [ ] Assign the new user to an industry
- [ ] Change user role
- [ ] Delete the test user

### 6.8 — Reports
- [ ] Generate a PDF report for a date range
- [ ] Generate a CSV report
- [ ] Download the generated report
- [ ] Report appears in history list

### 6.9 — Configuration
- [ ] View threshold config (Décret 2010-2516 limits)
- [ ] Update a threshold value (e.g. NOX warning)
- [ ] View site config (airflow, polluant weights)
- [ ] Update airflow value

---

## Simulator Scenarios for Specific Tests

### Trigger alerts quickly
```bash
node testing/scripts/02-multi-simulator.js critical
```
Wait ~30 seconds → alerts should appear in the dashboard.

### Test normal operations (no alerts)
```bash
node testing/scripts/02-multi-simulator.js normal
```

### Test KPI calculations
Run `random` scenario for at least 5 minutes, then check KPI dashboard.
KPI scheduler runs hourly aggregations automatically.
To trigger manually, use the backend API:
```bash
curl -X POST http://localhost:5000/api/kpi/aggregate \
  -H "Authorization: Bearer <your_token>"
```

---

## Troubleshooting

### No readings appearing
1. Check Mosquitto is running: `mosquitto -v`
2. Check backend MQTT connection in server logs
3. Verify sensors exist in DB: the seed script must have run successfully
4. Check backend logs for `⚠️ Capteur non trouvé` warnings

### No alerts triggered
1. Run simulator with `critical` scenario
2. Check ThresholdConfig exists in DB
3. Check backend AlertService logs

### Frontend shows no data
1. Confirm backend is running on port 5000
2. Check browser console for API errors
3. Verify CORS: backend `.env` should have `FRONTEND_URL=http://localhost:3000`

### MQTT connection refused
- Start Mosquitto: `mosquitto` or `net start mosquitto` (Windows service)
- Default port: 1883, no auth required for local testing

---

## Reset & Repeat

To start fresh at any time:
```bash
node testing/scripts/00-wipe-operational-data.js
node testing/scripts/01-seed-full-data.js
```
Then restart the simulator.
