# IoT Simulator — Documentation
### The virtual sensor station used for testing

---

## What is the IoT Simulator?

In a real production environment, physical sensor devices (like ESP32 microcontrollers with gas sensors attached) would be installed at the factory and would send measurements wirelessly. During development and testing, we don't have access to a real factory, so we use a **simulator** — a software program that pretends to be those physical sensors.

The simulator runs on a computer and sends fake (but realistic) sensor readings to the same MQTT message broker that real sensors would use. The backend server cannot tell the difference — it processes simulated data exactly the same way it would process real sensor data.

Think of it as a **flight simulator for pilots** — it's not a real airplane, but it behaves exactly like one for training purposes.

---

## What Does the Simulator Represent?

The simulator represents a single sensor station called **"Station-Sfax-01"** located in **"Zone-A"** of an industrial site near Sfax, Tunisia (coordinates: 34.74°N, 10.76°E).

This station has **7 sensors** attached to it, each measuring a different thing:

---

## The 7 Simulated Sensors

### Sensor 1 — CO₂ (Carbon Dioxide)
| Property | Value |
|----------|-------|
| Hardware model | MH-Z19B |
| Measurement unit | ppm (parts per million) |
| Normal range | 400–800 ppm |
| Sends data every | 10 seconds |
| MQTT topic | `emissions/Zone-A/CO2` |

**What it measures:** Carbon dioxide concentration in the air. Normal outdoor air is about 400 ppm. Industrial processes can push this higher.

---

### Sensor 2 — NOx (Nitrogen Oxides)
| Property | Value |
|----------|-------|
| Hardware model | MQ-135 |
| Measurement unit | mg/Nm³ (milligrams per normal cubic meter) |
| Normal range | 20–120 mg/Nm³ |
| Legal limit (VLE) | 120 mg/Nm³ |
| Sends data every | 30 seconds |
| MQTT topic | `emissions/Zone-A/NOX` |

**What it measures:** Nitrogen oxides — a family of gases produced by combustion. Causes acid rain and respiratory problems.

---

### Sensor 3 — SO₂ (Sulfur Dioxide)
| Property | Value |
|----------|-------|
| Hardware model | Alphasense SO2-B4 |
| Measurement unit | mg/Nm³ |
| Normal range | 10–120 mg/Nm³ |
| Legal limit (VLE) | 120 mg/Nm³ |
| Sends data every | 30 seconds |
| MQTT topic | `emissions/Zone-A/SO2` |

**What it measures:** Sulfur dioxide — produced by burning fossil fuels containing sulfur. Causes acid rain and lung damage.

---

### Sensor 4 — PM2.5 (Fine Particles)
| Property | Value |
|----------|-------|
| Hardware model | Plantower PMS5003 |
| Measurement unit | µg/m³ (micrograms per cubic meter) |
| Normal range | 5–12 µg/m³ |
| Legal limit (VLE) | 12 µg/m³ |
| Sends data every | 15 seconds |
| MQTT topic | `emissions/Zone-A/PM25` |

**What it measures:** Particulate matter smaller than 2.5 micrometers. These tiny particles can penetrate deep into the lungs and enter the bloodstream.

---

### Sensor 5 — COV (Volatile Organic Compounds)
| Property | Value |
|----------|-------|
| Hardware model | CCS811 |
| Measurement unit | mg/Nm³ |
| Normal range | 5–30 mg/Nm³ |
| Legal limit (VLE) | 30 mg/Nm³ |
| Sends data every | 30 seconds |
| MQTT topic | `emissions/Zone-A/COV` |

**What it measures:** Volatile organic compounds — a broad category of carbon-based chemicals that evaporate easily. Many are toxic and contribute to smog formation.

---

### Sensor 6 — Temperature
| Property | Value |
|----------|-------|
| Hardware model | SHT31 |
| Measurement unit | °C |
| Normal range | 18–35°C |
| Sends data every | 10 seconds |
| MQTT topic | `emissions/Zone-A/TEMPERATURE` |

**What it measures:** Ambient air temperature. Used as environmental context — temperature affects how pollutants disperse in the air.

---

### Sensor 7 — Humidity
| Property | Value |
|----------|-------|
| Hardware model | SHT31 (same chip as temperature) |
| Measurement unit | %RH (percent relative humidity) |
| Normal range | 30–60% |
| Sends data every | 10 seconds |
| MQTT topic | `emissions/Zone-A/HUMIDITY` |

**What it measures:** Relative humidity. Also used as environmental context.

---

## Alert Levels

Each pollutant sensor has 4 alert levels based on how far the value is from the legal limit:

| Level | Icon | When it triggers | Example for NOx (limit = 120) |
|-------|------|-----------------|-------------------------------|
| **Normal** | 🟢 | Value is within the safe range | 20–96 mg/Nm³ |
| **Warning** | 🟡 | Value is approaching the limit (80–100% of limit) | 96–120 mg/Nm³ |
| **High** | 🟠 | Value exceeds the limit (100–120% of limit) | 120–144 mg/Nm³ |
| **Critical** | 🔴 | Value severely exceeds the limit (>120% of limit) | 144–180 mg/Nm³ |

---

## Simulation Scenarios

The simulator can run in different modes to test how the system responds to various situations:

```bash
node simulator.js random     # Default: randomly switches between all levels
node simulator.js normal     # All sensors stay in the safe range
node simulator.js warning    # All sensors approach their limits
node simulator.js high       # All sensors exceed their limits
node simulator.js critical   # All sensors are in severe exceedance
```

**Why are these scenarios useful?**
- `normal` — verifies the dashboard shows green status correctly
- `warning` — tests that yellow alerts appear on the dashboard
- `critical` — tests that red alerts are created and pushed to supervisors
- `random` — simulates realistic factory behavior with occasional spikes

---

## The Message Format

Every time a sensor "takes a measurement," the simulator sends a JSON message to the MQTT broker. Here is an example message for the NOx sensor:

```json
{
  "sensorType": "NOX",
  "model": "MQ-135",
  "value": 135.7,
  "rawValue": 135.7,
  "unit": "mg/Nm³",
  "timestamp": "2026-05-04T14:30:00.000Z",
  "isValid": true,
  "nodeId": "Station-Sfax-01",
  "zone": "Zone-A"
}
```

**What each field means:**
- `sensorType` — which pollutant this sensor measures
- `model` — the hardware model name (used to look up the sensor in the database)
- `value` — the measured value after any unit conversion
- `rawValue` — the raw value before conversion (same as value in most cases)
- `unit` — the unit of measurement
- `timestamp` — when the measurement was taken (ISO 8601 format)
- `isValid` — whether the sensor considers this reading reliable
- `nodeId` — which sensor station this came from
- `zone` — which zone the station is in

---

## How the Simulator Generates Values

The simulator doesn't just generate random numbers — it generates **realistic values** that follow the behavior of real sensors:

1. **Scenario determines the range**: In `normal` mode, values stay within the normal range. In `critical` mode, values are in the critical range.
2. **Values drift gradually**: Values don't jump suddenly — they change smoothly over time, like real sensors.
3. **Occasional spikes**: In `random` mode, the simulator occasionally generates spike values to simulate real-world events (a furnace starting up, a valve opening, etc.).

---

## Data Flow (Step by Step)

```
1. simulator.js starts and connects to Mosquitto MQTT broker
   → "Connected to mqtt://localhost:1883"

2. Every 10 seconds (CO₂ sensor):
   → Generates a CO₂ value based on the current scenario
   → Publishes JSON message to topic "emissions/Zone-A/CO2"

3. Mosquitto broker receives the message and forwards it to all subscribers

4. Backend's mqttService.js receives the message (it subscribed to "emissions/#")
   → Parses the JSON
   → Looks up the sensor in MongoDB by type="CO2" and model="MH-Z19B"
   → Looks up the pollutant in MongoDB by name="CO2"
   → Calls ReadingService.ingestReading() with the data

5. ReadingService saves the Reading to MongoDB
   → Calls AlertService.checkThresholds()

6. AlertService compares value against ThresholdConfig
   → If value > warning threshold → creates Alert (severity: "Warning")
   → If value > critical threshold → creates Alert (severity: "Critical")
   → Calls websocketService.broadcastAlert() to push to dashboard

7. Dashboard receives the alert via WebSocket
   → Shows red notification to supervisors
   → Updates KPI scores
```

---

## Total Data Volume

With all 7 sensors running:
- CO₂: 1 message every 10s = 6/min
- NOx: 1 message every 30s = 2/min
- SO₂: 1 message every 30s = 2/min
- PM2.5: 1 message every 15s = 4/min
- COV: 1 message every 30s = 2/min
- Temperature: 1 message every 10s = 6/min
- Humidity: 1 message every 10s = 6/min

**Total: ~28 messages per minute = ~1,680 readings per hour = ~40,320 per day**

---

## Starting the Simulator

**Prerequisites:**
1. Mosquitto MQTT broker must be running on port 1883
2. Backend server must be running on port 5000
3. The database must be initialized (sensors must exist in MongoDB)

```bash
cd iot
npm install          # First time only
npm start            # Starts with random scenario
```

When it starts successfully, you'll see:
```
╔══════════════════════════════════════════════════╗
║     SIMULATEUR IoT — Émissions Industrielles     ║
║     Système : Station-Sfax-01                    ║
║     Zone    : Zone-A                             ║
║     Scénario: RANDOM                             ║
╚══════════════════════════════════════════════════╝

✅ Connected to MQTT broker: mqtt://localhost:1883
📡 Starting simulation...

┌──────────────┬──────────────────────┬───────────┐
│ Type         │ Model                │ Frequency │
├──────────────┼──────────────────────┼───────────┤
│ CO2          │ MH-Z19B              │ 10s       │
│ NOX          │ MQ-135               │ 30s       │
│ SO2          │ Alphasense SO2-B4    │ 30s       │
│ PM25         │ Plantower PMS5003    │ 15s       │
│ COV          │ CCS811               │ 30s       │
│ TEMPERATURE  │ SHT31                │ 10s       │
│ HUMIDITY     │ SHT31                │ 10s       │
└──────────────┴──────────────────────┴───────────┘
```

---

## Environment Variables (`iot/.env`)

| Variable | Default | What it does |
|----------|---------|-------------|
| `MQTT_BROKER` | `mqtt://localhost:1883` | Address of the MQTT broker |
| `MQTT_CLIENT_ID` | `pollution-simulator` | Name the simulator uses to identify itself |
| `API_URL` | `http://localhost:5000` | Backend server address |
| `API_EMAIL` | `admin@enim.tn` | Admin credentials (used for initialization) |
| `API_PASSWORD` | `Admin1234` | Admin password |
| `NODE_ENV` | `development` | Environment mode |
