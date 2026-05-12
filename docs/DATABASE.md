# Database — Documentation
### How data is organized and stored

---

## What is the Database?

The system uses **MongoDB** as its database. MongoDB is a "document database" — instead of storing data in rigid tables like a spreadsheet (as traditional SQL databases do), it stores data as flexible JSON-like documents. This makes it well-suited for sensor data, which can have varying structures.

The database is named **`pollution_db`** and contains **14 collections** (the MongoDB equivalent of tables).

Think of the database as a **large filing cabinet** with 14 drawers. Each drawer holds a specific type of document (users, readings, alerts, etc.).

---

## The Organizational Hierarchy

The system models the real-world structure of an industrial company:

```
🏭 Industrie (the company)
    │
    ├── 🏗️ Site (a physical factory location)
    │       │
    │       ├── 📍 Zone (an area within the site, e.g., "Furnace Area")
    │       │       │
    │       │       └── 📡 SensorNode (a physical sensor box installed in the zone)
    │       │                   │
    │       │                   └── 🔬 Sensor (one sensor on the box, measures one pollutant)
    │       │                               │
    │       │                               └── 📊 Reading (one measurement at one moment)
    │       │                                           │
    │       │                                           └── 🚨 Alert (created if reading exceeds threshold)
    │       │
    │       └── 📍 Zone B ...
    │
    └── 🏗️ Site B ...
```

**Real-world example:**
- **Industrie**: "Cimenterie Sfax" (a cement company)
- **Site**: "Usine Principale" (the main factory)
- **Zone**: "Zone-A — Fours de calcination" (the kiln area)
- **SensorNode**: "Station-Sfax-01" (an ESP32 box with sensors attached)
- **Sensor**: The NOx sensor on that box (model: MQ-135)
- **Reading**: "NOx = 135 mg/Nm³ at 14:30:00 on May 4, 2026"
- **Alert**: "NOx exceeded limit of 120 mg/Nm³ — severity: High"

---

## The 14 Collections

### 1. users
Stores all system accounts.

| Field | Type | Description |
|-------|------|-------------|
| `username` | Text (unique) | The login name |
| `email` | Text (unique) | Email address, used for login |
| `password` | Text (encrypted) | Password stored as a bcrypt hash — never in plain text |
| `role` | Choice | One of: SUPER_ADMIN, HEAD_SUPERVISOR, SITE_SUPERVISOR, OPERATOR, AUDITOR |
| `industryId` | Reference → Industrie | Which company this user belongs to |
| `sitesManaging` | List of references → Site | Which sites this user manages (for supervisors) |
| `zonesAssigned` | List of references → Zone | Which zones this user monitors (for operators) |
| `isActive` | True/False | Whether the account is enabled |
| `lastLogin` | Date/Time | When the user last logged in |

**Security note:** Passwords are never stored in plain text. They are processed through bcrypt (a one-way hashing algorithm) before storage. Even if someone stole the database, they could not read the passwords.

---

### 2. industries (Industrie)
The top-level organizational unit — a company.

| Field | Type | Description |
|-------|------|-------------|
| `nom` | Text | Company name (e.g., "Cimenterie Sfax") |
| `secteur` | Text | Industry sector (e.g., "Cimenterie", "Chimie") |
| `localisation` | GPS coordinates | Geographic location |
| `contact` | Object | Phone number, email, responsible person |
| `actif` | True/False | Whether the company is active in the system |

---

### 3. sites
A physical factory location belonging to a company.

| Field | Type | Description |
|-------|------|-------------|
| `nom` | Text | Site name (e.g., "Usine Principale") |
| `industrieId` | Reference → Industrie | Which company owns this site |
| `supervisorId` | Reference → User | The supervisor responsible for this site |
| `localisation` | GPS + address | Physical location and address |
| `contact` | Object | Site contact information |
| `actif` | True/False | Whether the site is active |
| `zoneCount` | Number | How many zones this site has (stored for quick display) |

---

### 4. zones
A specific area within a site, grouped by function (e.g., "Furnace Area", "Crushing Unit").

| Field | Type | Description |
|-------|------|-------------|
| `code` | Text | Short identifier (e.g., "Zone-A") |
| `nom` | Text | Descriptive name (e.g., "Fours de calcination") |
| `siteId` | Reference → Site | Which site this zone belongs to |
| `industrieId` | Reference → Industrie | Which company (stored for quick queries) |
| `description` | Text | What happens in this zone |
| `localisation` | GPS coordinates | Zone location |
| `operatorsAssigned` | List of references → User | Which operators monitor this zone |
| `actif` | True/False | Whether the zone is active |
| `sensorNodeCount` | Number | How many sensor boxes are in this zone |

---

### 5. sensornodes (SensorNode)
A physical sensor box (e.g., an ESP32 microcontroller) installed in a zone.

| Field | Type | Description |
|-------|------|-------------|
| `nom` | Text | Node name (e.g., "Station-Sfax-01") |
| `IndustrieId` | Reference → Industrie | Which company owns this node |
| `localisation` | GPS coordinates | Exact installation location |
| `zone` | Text | Zone code (e.g., "Zone-A") |
| `Status` | Choice | "Active" or "Inactive" |
| `IPAddress` | Text | Network IP address of the device |
| `macAddress` | Text (unique) | Hardware MAC address (unique identifier) |

---

### 6. sensors
An individual sensor chip attached to a sensor node. One node can have multiple sensors (one per pollutant).

| Field | Type | Description |
|-------|------|-------------|
| `sensorNodeId` | Reference → SensorNode | Which box this sensor is on |
| `PolluantId` | Reference → Polluant | Which pollutant this sensor measures |
| `type` | Choice | CO2, SO2, NOX, PM25, PM10, COV, TEMPERATURE, or HUMIDITY |
| `model` | Text | Hardware model name (e.g., "MH-Z19B") |
| `unit` | Text | Measurement unit (e.g., "ppm", "mg/Nm³") |
| `calibrationDate` | Date | When the sensor was last calibrated |
| `driftThreshold` | Number | How much drift is acceptable before recalibration |
| `isActive` | True/False | Whether the sensor is operational |

---

### 7. polluants
The catalog of all pollutants the system can monitor, with their regulatory limits.

| Field | Type | Description |
|-------|------|-------------|
| `name` | Text (unique) | Pollutant name (e.g., "NOX") |
| `code` | Text (unique) | Short code (auto-generated from name) |
| `formula` | Text | Chemical formula (e.g., "NO₂") |
| `unit` | Text | Measurement unit |
| `regulatoryLimit` | Number | VLE — the legal maximum (from Décret 2010-2516) |
| `warningThreshold` | Number | Warning level (typically 80% of VLE) |
| `description` | Text | Description of the pollutant |
| `conversionFactor` | Number | Unit conversion factor (if sensor measures in different units) |
| `weight` | Number (0–1) | How much this pollutant contributes to the IPE score |

---

### 8. readings ⭐ (High-volume — 131,000+ documents)
Every single sensor measurement is stored here. This is the most important and largest collection.

| Field | Type | Description |
|-------|------|-------------|
| `sensorId` | Reference → Sensor | Which sensor took this measurement |
| `PolluantId` | Reference → Polluant | Which pollutant was measured |
| `nodeId` | Reference → SensorNode | Which sensor box it came from |
| `value` | Number | The measured value (after unit conversion) |
| `unit` | Text | The unit of measurement |
| `isValid` | True/False | Whether this reading passed validation checks |
| `rawValue` | Number | The original value before any conversion |
| `timestamp` | Date/Time | When the measurement was taken |

**Performance optimization:** This collection has 4 database indexes to make queries fast:
- By timestamp (newest first) — for "show me the latest readings"
- By sensor + timestamp — for "show me all readings from sensor X"
- By pollutant + timestamp — for "show me all NOx readings"
- By node + timestamp — for "show me all readings from Station-Sfax-01"

Without these indexes, searching through 131,000+ documents would be very slow.

---

### 9. alerts
Every alert generated when a reading exceeded a threshold.

| Field | Type | Description |
|-------|------|-------------|
| `PolluantId` | Reference → Polluant | Which pollutant triggered the alert |
| `SensorId` | Reference → Sensor | Which sensor generated the reading |
| `ReadingId` | Reference → Reading | The specific reading that triggered this alert |
| `severity` | Choice | "Warning", "High", or "Critical" |
| `type` | Choice | "Threshold", "SensorFault", or "Anomaly" |
| `value` | Number | The measured value that triggered the alert |
| `threshold` | Number | The threshold that was exceeded |
| `message` | Text | Human-readable description of the alert |
| `timestamp` | Date/Time | When the alert was created |
| `isAcknowledged` | True/False | Has someone acknowledged this alert? |
| `acknowledgedBy` | Reference → User | Who acknowledged it |
| `acknowledgedAt` | Date/Time | When it was acknowledged |
| `resolvedAt` | Date/Time | When it was resolved |
| `resolvedBy` | Reference → User | Who resolved it |
| `resolutionNote` | Text | What was done to resolve the issue |

---

### 10. thresholdconfigs
The regulatory threshold configuration. Based on Décret 2010-2516.

This collection stores the legal limits for each pollutant, plus the warning and critical thresholds derived from them.

| Field | Type | Description |
|-------|------|-------------|
| `nom` | Text | Configuration name (e.g., "Configuration Globale") |
| `description` | Text | Description |
| `polluants.NOx.max` | Number | Legal limit for NOx (mg/Nm³) |
| `polluants.NOx.warning` | Number | Warning threshold = max − 20% |
| `polluants.NOx.critical` | Number | Critical threshold = max + 20% |
| `polluants.SO2.*` | Numbers | Same structure for SO₂ |
| `polluants.PM25.*` | Numbers | Same structure for PM2.5 |
| `polluants.COV.*` | Numbers | Same structure for COV |
| `polluants.CO2.*` | Numbers | Same structure for CO₂ |
| `warningOffsetPercent` | Number | How far below max to set warning (default: 20%) |
| `criticalOffsetPercent` | Number | How far above max to set critical (default: 20%) |
| `actif` | True/False | Is this the active configuration? |

---

### 11. siteconfigs
KPI calculation parameters specific to a site.

| Field | Type | Description |
|-------|------|-------------|
| `airflow` | Number | Q_air — air flow rate in Nm³/s (used in EMJ formula) |
| `polluantWeights` | Object | How much each pollutant contributes to IPE score |
| `baseline` | Object | Reference emission values for RCO2 calculation |
| `kpiTargets` | Object | Target values for each KPI (TD ≤ 2%, IPE ≥ 95, etc.) |
| `actif` | True/False | Is this the active configuration? |

---

### 12. aggregatedatas
Pre-computed summaries of readings, organized by time period. Used to make charts load fast.

Instead of calculating averages over 131,000 readings every time someone opens a chart, the system pre-computes these summaries on a schedule and stores them here.

| Field | Type | Description |
|-------|------|-------------|
| `polluantId` | Reference → Polluant | Which pollutant |
| `period` | Choice | "HOURLY", "DAILY", or "MONTHLY" |
| `periodStart` | Date/Time | Start of the aggregation period |
| `periodEnd` | Date/Time | End of the aggregation period |
| `avgValue` | Number | Average concentration during this period |
| `minValue` | Number | Minimum value during this period |
| `maxValue` | Number | Maximum value during this period |
| `count` | Number | How many readings were included |
| `breachCount` | Number | How many readings exceeded the legal limit |

---

### 13. reports
Records of generated compliance reports.

| Field | Type | Description |
|-------|------|-------------|
| `title` | Text | Report title |
| `type` | Choice | "PDF" or "CSV" |
| `period` | Object | `{ start: date, end: date }` — the reporting period |
| `generatedBy` | Reference → User | Who requested the report |
| `fileUrl` | Text | Path to the generated file (for download) |
| `status` | Choice | "pending", "ready", or "error" |

---

### 14. refreshtokens
Stores active refresh tokens for secure session management.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | Reference → User | Which user this token belongs to |
| `token` | Text (hashed) | The refresh token (stored as a hash, not plain text) |
| `expiresAt` | Date/Time | When this token expires (7 days after creation) |
| `isRevoked` | True/False | Has this token been invalidated (e.g., after logout)? |

---

## How Collections Are Connected

```
User ──────────────────────────────────────────────────────────────────┐
  │ sitesManaging[]                                                     │
  │ zonesAssigned[]                                                     │
  ▼                                                                     │
Industrie ──► Site ──► Zone ──► SensorNode ──► Sensor ──► Reading ──► Alert
                                                              │
                                                           Polluant ◄──┘
                                                              │
                                                        ThresholdConfig
                                                              │
                                                         SiteConfig
```

**Reading example:** A Reading document links to:
- The Sensor that measured it
- The Polluant that was measured
- The SensorNode the sensor is attached to

**Alert example:** An Alert document links to:
- The Polluant that was exceeded
- The Sensor that detected it
- The Reading that triggered it
- The User who acknowledged it (once acknowledged)

---

## Database Performance

The system is designed to handle high data volumes efficiently:

- **Indexes** on the most-queried fields (timestamp, sensorId, polluantId) make lookups fast
- **Geospatial indexes** (2dsphere) on sites, zones, and nodes enable location-based queries
- **Pre-aggregation** (AggregateData collection) avoids recalculating averages over millions of readings
- **Denormalization** (storing industrieId in Zone even though it could be derived through Site) avoids expensive multi-level joins

At the time of the last audit, the database contained:
- 131,456+ readings (growing at ~40,000/day)
- 1,038+ alerts
- 8 users
- 4 industries, 3 sites, 5 zones, 7 sensor nodes
