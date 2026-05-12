# Deployment Guide
### How to install and run the system

---

## Overview

Running the full EmissionsIQ system requires starting **5 separate components** in the right order. Think of it like starting a factory — you need to turn on the power (database), then the communication network (MQTT broker), then the control room (backend), then the monitoring stations (IoT simulator), and finally the dashboard screens (frontend).

```
Start order:
1. MongoDB (database)
2. Mosquitto (MQTT message broker)
3. Backend server (Node.js)
4. IoT Simulator (sensor data generator)
5. Frontend (React website)
6. AI Module (optional — Python predictions)
```

---

## Prerequisites

Before you can run the system, you need to install these tools:

| Tool | Version | What it's for | Download |
|------|---------|--------------|---------|
| **Node.js** | 20 or higher | Runs the backend and IoT simulator | nodejs.org |
| **npm** | 10 or higher | Installs JavaScript packages (comes with Node.js) | — |
| **MongoDB** | 6 or higher | The database | mongodb.com |
| **Mosquitto** | 2 or higher | The MQTT message broker | mosquitto.org |
| **Python** | 3.10 or higher | Runs the AI module (optional) | python.org |
| **Docker** | 24 or higher | For containerized deployment (optional) | docker.com |

---

## Step 1: Start MongoDB

MongoDB is the database that stores all sensor readings, alerts, users, and configuration.

**Windows (if installed as a service):**
```bash
net start MongoDB
```

**Or start manually:**
```bash
mongod --dbpath C:\data\db
```

**Verify it's running:** Open a browser and go to `http://localhost:27017` — you should see a message saying "It looks like you are trying to access MongoDB over HTTP."

---

## Step 2: Start Mosquitto (MQTT Broker)

Mosquitto is the message relay station that receives sensor data from the IoT simulator and forwards it to the backend.

**Windows (if installed as a service):**
```bash
net start mosquitto
```

**Or start manually:**
```bash
mosquitto -v
```

The `-v` flag enables verbose logging so you can see messages being relayed.

**Verify it's running:** You should see `mosquitto version X.X.X starting` in the terminal.

---

## Step 3: Set Up and Start the Backend

### First-time setup only:

```bash
cd backend

# Install all required packages
npm install

# Initialize the database with required data
npm run init
```

The `npm run init` command runs 4 scripts in sequence:
1. **init:simulator** — Creates sensor nodes, sensors, and the pollutant catalog in MongoDB
2. **init:users** — Creates one default user for each role
3. **init:thresholds** — Loads the legal threshold values from Décret 2010-2516
4. **init:kpi** — Sets up KPI calculation parameters (air flow rate, pollutant weights)

### Start the backend:

```bash
npm start
```

**What you should see:**
```
✅ MongoDB connected
✅ [MQTT Service] Connected to broker: mqtt://localhost:1883
📡 [MQTT Service] Subscribed to topic: emissions/#
[WebSocket] Server initialized on /ws
Server running on port 5000
```

If you see any ❌ errors, check that MongoDB and Mosquitto are running first.

---

## Step 4: Start the IoT Simulator

The simulator generates fake sensor readings and sends them to the backend via MQTT.

```bash
cd iot

# Install packages (first time only)
npm install

# Start with random scenario (recommended for testing)
npm start

# Or start with a specific scenario:
node simulator.js normal     # All sensors in safe range
node simulator.js warning    # Sensors approaching limits
node simulator.js critical   # Sensors exceeding limits
```

**What you should see:**
```
╔══════════════════════════════════════════════════╗
║     SIMULATEUR IoT — Émissions Industrielles     ║
║     Système : Station-Sfax-01                    ║
║     Zone    : Zone-A                             ║
║     Scénario: RANDOM                             ║
╚══════════════════════════════════════════════════╝

✅ Connected to MQTT broker: mqtt://localhost:1883
📡 Starting simulation...
```

After a few seconds, you should see sensor readings being published:
```
🟢 CO2: 542 ppm (normal)
🟡 NOX: 98 mg/Nm³ (warning)
🟢 SO2: 45 mg/Nm³ (normal)
```

---

## Step 5: Start the Frontend

```bash
cd frontend

# Install packages (first time only)
npm install

# Start the development server
npm run dev
```

**What you should see:**
```
  VITE v5.0.12  ready in 234 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Open your browser and go to `http://localhost:3000`. You should see the login page.

**Default login credentials:**
- Email: `admin@enim.tn`
- Password: `Admin1234`

---

## Step 6: Start the AI Module (Optional)

The AI module provides trend predictions and anomaly detection. The system works without it, but the AI Predictions page will show no data.

```bash
cd ia

# Create a Python virtual environment (isolated Python environment)
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# Install Python packages (first time only)
pip install -r requirements.txt

# Train the AI models (requires historical data in MongoDB)
# Run the simulator for a few hours first to generate enough data
python model_trainer.py

# Start the AI API server
python api.py
```

The AI service will start on `http://localhost:8000`.

---

## Configuration Files

Each component has its own configuration file:

### Backend (`backend/.env`)
```env
MONGO_URI=mongodb://localhost:27017/pollution_db
PORT=5000
MQTT_BROKER=mqtt://localhost:1883
JWT_ACCESS_SECRET=change_this_to_a_long_random_string
JWT_REFRESH_SECRET=change_this_to_a_different_long_random_string
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
NODE_ENV=development
```

### Frontend (`frontend/.env`)
Create this file if it doesn't exist:
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
VITE_ENABLE_DEVTOOLS=false
```

### IoT Simulator (`iot/.env`)
```env
MQTT_BROKER=mqtt://localhost:1883
MQTT_CLIENT_ID=pollution-simulator
API_URL=http://localhost:5000
API_EMAIL=admin@enim.tn
API_PASSWORD=Admin1234
NODE_ENV=development
```

### AI Module (`ia/.env`)
```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=pollution_db
IA_HOST=0.0.0.0
IA_PORT=8000
NODEJS_URL=http://localhost:5000
```

---

## Port Summary

| Service | Port | What connects to it |
|---------|------|-------------------|
| Frontend (development) | 3000 | Your browser |
| Backend API | 5000 | Frontend (HTTP requests) |
| Backend WebSocket | 5000 | Frontend (live updates, path: /ws) |
| MongoDB | 27017 | Backend, AI module |
| Mosquitto MQTT | 1883 | IoT simulator, Backend |
| AI Module | 8000 | Frontend (AI predictions page) |

---

## Docker Deployment (Production)

For production deployment, the frontend can be packaged as a Docker container:

### Build the frontend Docker image:
```bash
cd frontend
docker build -t emissionsiq/frontend .
```

### Run it:
```bash
docker run -p 3000:80 emissionsiq/frontend
```

### Or use Docker Compose (frontend + backend together):
```bash
cd frontend
docker compose up
```

The Docker Compose file starts:
- **Frontend** container: builds from Dockerfile, serves on port 3000 via Nginx
- **Backend** container: runs `node server.js` from the backend folder on port 5000

> Note: MongoDB and Mosquitto are not included in the Docker Compose file. You need to run them separately or add them as additional services.

---

## Verifying the System is Working

After starting all components, run the system check script:

```bash
cd backend
node check-system-ready.js
```

This script checks:
- ✅ MongoDB is connected
- ✅ MQTT broker is reachable
- ✅ Sensor nodes exist in the database
- ✅ Sensors exist in the database
- ✅ Pollutants exist in the database
- ✅ Threshold configuration exists
- ✅ KPI configuration exists
- ✅ At least one user exists

Other useful diagnostic scripts:
```bash
node check-recent-data.js      # Shows the most recent sensor readings
node check-alerts.js           # Shows recent alerts
node check-readings.js         # Shows reading statistics
node diagnose-sensors.js       # Checks sensor configuration
```

---

## Production Checklist

Before deploying to a real production server, complete this checklist:

### Security
- [ ] Change `JWT_ACCESS_SECRET` to a long random string (at least 32 characters)
- [ ] Change `JWT_REFRESH_SECRET` to a different long random string
- [ ] Change all default user passwords (admin, supervisor, operator, auditor)
- [ ] Set `NODE_ENV=production` in the backend `.env`
- [ ] Configure Mosquitto with username/password authentication
- [ ] Set up MongoDB authentication (username + password)
- [ ] Enable HTTPS with an SSL certificate (required for the `Secure` cookie flag)

### Performance
- [ ] Set up MongoDB indexes (done automatically by Mongoose on first run)
- [ ] Configure MongoDB to run as a service (auto-restart on server reboot)
- [ ] Configure Mosquitto to run as a service
- [ ] Configure the backend to run as a service (use PM2 or systemd)

### Monitoring
- [ ] Set up log rotation for `backend.log` and `frontend.log`
- [ ] Configure alerts for server downtime
- [ ] Set up regular database backups

### Configuration
- [ ] Set `FRONTEND_URL` in backend `.env` to your production domain (for CORS)
- [ ] Set `VITE_API_URL` in frontend `.env` to your production backend URL
- [ ] Verify all threshold values match the actual Décret 2010-2516 requirements

---

## Troubleshooting

### "Cannot connect to MongoDB"
- Make sure MongoDB is running: `net start MongoDB` (Windows)
- Check the `MONGO_URI` in `backend/.env`
- Verify MongoDB is listening on port 27017

### "Cannot connect to MQTT broker"
- Make sure Mosquitto is running: `net start mosquitto` (Windows)
- Check the `MQTT_BROKER` in `backend/.env` and `iot/.env`
- Verify Mosquitto is listening on port 1883

### "No data appearing on the dashboard"
1. Check the IoT simulator is running and connected
2. Check the backend logs for MQTT messages being received
3. Run `node check-recent-data.js` to see if readings are in the database
4. Check the browser console for WebSocket connection errors

### "Login fails with 'Invalid credentials'"
- Make sure you ran `npm run init:users` to create the default users
- Try the default credentials: `admin@enim.tn` / `Admin1234`
- Check the backend logs for authentication errors

### "KPI values show 0 or N/A"
- The system needs some readings in the database first
- Run the IoT simulator for a few minutes to generate data
- Run `npm run init:kpi` to ensure KPI configuration exists
