# EmissionsIQ — Project Overview
### Industrial Pollution Monitoring System

---

## What is this system?

**EmissionsIQ** is a real-time industrial air pollution monitoring platform for Tunisian factories. It continuously measures pollutant concentrations from sensor nodes installed in factory zones, checks them against legal limits from **Décret tunisien 2010-2516**, and alerts the right people when something goes wrong.

The system is built around a **cement factory demo** (Cimenterie de Gabès) with 2 sites, 4 zones, and 4 ESP32 sensor nodes — but is designed to scale to any number of industries, sites, and zones.

---

## Architecture

```
ESP32 Sensor Nodes (4 nodes × 5 pollutants)
        │  MQTT  emissions/<zone>/<pollutant>
        ▼
  MQTT Broker (Mosquitto :1883)
        │
        ▼
  Backend API (Node.js/Express :5000)
  ├── ReadingService  → saves readings, triggers alert engine
  ├── Alert Engine    → 1 active alert per sensor×pollutant, auto-resolves
  ├── KPI Service     → TD, EMJ, IPE, RCO2
  ├── WebSocket       → real-time push to dashboard
  └── MQTT Service    → subscribes to emissions/#
        │
        ▼
  MongoDB (pollution_db)
  ├── readings, alerts, users, sites, zones
  ├── industries, sensorNodes, sensors, polluants
  └── siteConfig, thresholdConfig, refreshTokens

  React Frontend (:5173)
  ├── Role-adaptive dashboard (5 roles)
  ├── Real-time charts with smart Y-axis scaling
  ├── Alert management with acknowledge/resolve workflow
  └── Sites & Zones management with approval workflow
```

---

## The 5 User Roles

| Role | Access | Home Page |
|------|--------|-----------|
| **SUPER_ADMIN** | System admin — users, sites, zones, config, approvals. No operational dashboards. | `/industries` |
| **HEAD_SUPERVISOR** | All sites/zones of their industry. Full operational access. | `/overview` |
| **SITE_SUPERVISOR** | Their assigned sites only. Manage operators. | `/overview` |
| **OPERATOR** | Their assigned zones only. Acknowledge alerts. View AI predictions. | `/overview` |
| **AUDITOR** | Read-only. All data. Generate reports. | `/overview` |

---

## Pollutants Monitored

| Code | Name | Unit | Regulatory Limit | Warning Threshold |
|------|------|------|-----------------|-------------------|
| CO2 | Dioxyde de carbone | ppm | 800 | 600 |
| NOX | Oxydes d'azote | mg/Nm³ | 200 | 150 |
| SO2 | Dioxyde de soufre | mg/Nm³ | 100 | 75 |
| PM25 | Particules fines | µg/m³ | 50 | 35 |
| COV | Composés organiques volatils | mg/Nm³ | 30 | 22 |

---

## KPIs

| KPI | Formula | Target |
|-----|---------|--------|
| **TD** — Taux de Dépassement | (readings above limit / total) × 100 | ≤ 2% / month |
| **EMJ** — Émission Massique Journalière | avg_concentration × Q_air × 86400 | Decrease 10%/quarter |
| **IPE** — Indice de Performance Environnementale | Weighted score 0–100 | ≥ 95 / month |
| **RCO2** — Réduction CO₂ | (current − baseline) / baseline × 100 | ≤ −5% / quarter |

---

## Alert Engine

The alert engine creates **one active alert per (sensor × pollutant)** pair:

```
Reading arrives → value > warningThreshold?
  NO  → Is there an open alert? → YES → Auto-resolve (resolvedAt set, isAcknowledged untouched)
  YES → Is there an open alert?
          NO  → Create new alert
          YES → Severity escalated OR 30s window expired → Update in place
                Otherwise → Skip (too soon)
```

**Alert states:**
- **Open** — breach detected, no action taken
- **Acknowledged** — operator has seen it (`isAcknowledged=true`, `resolvedAt=null`)
- **Resolved manually** — operator resolved it (`resolvedAt` set, `resolvedBy` = user)
- **Resolved automatically** — value dropped below threshold (`resolvedAt` set, `resolvedBy=null`)

Acknowledging ≠ Resolving. They are independent states.

---

## Site/Zone Approval Workflow

When HEAD_SUPERVISOR or SITE_SUPERVISOR creates a new site or zone, it goes through a 3-step approval:

```
① PENDING    → SUPER_ADMIN reviews: location, pollutants, initial zone
② PREPARING  → Sensor node assigned, physical installation in progress
③ APPROVED   → Site/zone activated
```

- Site creation auto-creates an initial zone (shown as one request, not two)
- Supervisors can track their pending requests in "Mes demandes" panel

---

## Demo Data (init-fresh.js)

Run `node init-fresh.js` to wipe and reseed:

| Entity | Count |
|--------|-------|
| Industrie | 1 (Cimenterie de Gabès) |
| Sites | 2 (Principal + Annexe) |
| Zones | 4 (Zone-Four, Zone-Broyage, Zone-Stockage, Zone-Expedition) |
| SensorNodes | 4 (1 per zone, zone field matches Zone.code exactly) |
| Sensors | 20 (5 per node) |
| Readings | ~172,800 (30 days × 5-min interval) |
| Alerts | ~11,370 (real threshold breaches) |
| Users | 8 (all roles) |

**Demo accounts:**

| Role | Email | Password |
|------|-------|----------|
| SUPER_ADMIN | superadmin@emissionsiq.tn | Admin1234! |
| HEAD_SUPERVISOR | responsable.industrie@cimenterie-gabes.tn | Head1234! |
| SITE_SUPERVISOR | responsable.site@cimenterie-gabes.tn | Site1234! |
| OPERATOR (Zone-Four) | operateur.four@cimenterie-gabes.tn | Oper1234! |
| OPERATOR (Zone-Broyage) | operateur.broyage@cimenterie-gabes.tn | Oper1234! |
| OPERATOR (Zone-Stockage) | operateur.stockage@cimenterie-gabes.tn | Oper1234! |
| OPERATOR (Zone-Expedition) | operateur.expedition@cimenterie-gabes.tn | Oper1234! |
| AUDITOR | auditor@example.com | Audit1234! |

---

## Quick Start

```bash
# 1. Start MongoDB and Mosquitto

# 2. Initialize fresh database
cd backend
node init-fresh.js

# 3. Start backend
npm start

# 4. Start real-time simulator (separate terminal)
node simulator.js              # normal values
node simulator.js warning      # elevated values (more alerts)
node simulator.js critical     # threshold-breaching values

# 5. Start frontend (separate terminal)
cd frontend
npm run dev
# → http://localhost:5173
```

---

## Documentation Index

| File | Contents |
|------|----------|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | This file |
| [BACKEND.md](./BACKEND.md) | Server architecture, services, API routes |
| [FRONTEND.md](./FRONTEND.md) | Dashboard pages, components, role-adaptive UI |
| [AUTH_RBAC.md](./AUTH_RBAC.md) | Authentication, roles, permissions |
| [DATABASE.md](./DATABASE.md) | MongoDB collections and schemas |
| [IOT_SIMULATOR.md](./IOT_SIMULATOR.md) | Real-time simulator usage |
| [API_REFERENCE.md](./API_REFERENCE.md) | All API endpoints |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment guide |
