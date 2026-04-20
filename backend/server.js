const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const connectDB = require("./config/db");
const { initializeWebSocket, getStats: getWSStats } = require("./services/websocketService");

const app = express();
const server = http.createServer(app);

// ── CORS Configuration ────────────────────────────────────────
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Global rate-limit.
// - In development: generous cap so a page reload / HMR burst doesn't lock you out.
// - In production: stricter cap to mitigate abuse.
// Tune via RATE_LIMIT_MAX if you need a specific value (still respects dev/prod defaults).
const isProd = process.env.NODE_ENV === "production";
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || (isProd ? 300 : 2000);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Trop de requêtes" },
  // Don't count successful GETs against the budget in dev — the SPA makes
  // dozens of parallel reads (KPI, alerts, readings) per page.
  skipSuccessfulRequests: !isProd,
});
app.use(globalLimiter);

// ── RBAC Management Routes (FIRST - Priority) ──────────────────
// User, Site, Zone management with role-based access control
console.log("[DEBUG] Loading RBAC routes (FIRST)...");

// Test: mount a simple debug route to see if Express can handle sub-paths
app.get("/api/users/test-direct", (req, res) => {
  res.json({ message: "✅ Direct test route works!" });
});

// Mount RBAC routes directly
try {
  const userRoutes = require("./routes/userManagementRoutes");
  console.log("[DEBUG] userRoutes type:", typeof userRoutes, "constructor:", userRoutes?.constructor?.name);
  
  app.use("/api/users", (req, res, next) => {
    console.log("[MOUNT DEBUG] /api/users path matched!");
    next();
  });
  
  app.use("/api/users", userRoutes);
  console.log("[DEBUG] ✓ User routes mounted");
} catch (e) {
  console.error("[ERROR] Failed to mount user routes:", e.message, e.stack);
}

// ── Other Routes ──────────────────────────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/industries", require("./routes/industrieRoutes"));
app.use("/api/sensor-nodes", require("./routes/sensorNodeRoutes"));
app.use("/api/polluants", require("./routes/polluantRoutes"));
app.use("/api/sensors", require("./routes/sensorRoutes"));
app.use("/api/readings", require("./routes/readingRoutes"));
app.use("/api/alerts", require("./routes/alertRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/kpi", require("./routes/kpiRoutes"));

// RBAC management routes (admin/site/zone/threshold/site-config)
// These were declared in routes/ but never mounted, causing 404s in the SPA
// (e.g. GET /api/thresholds → 404 from the Compliance page).
try {
  app.use("/api/sites", require("./routes/siteManagementRoutes"));
  app.use("/api/zones", require("./routes/zoneManagementRoutes"));
  app.use("/api/thresholds", require("./routes/thresholdConfigManagementRoutes"));
  app.use("/api/site-config", require("./routes/siteConfigManagementRoutes"));
  console.log("[DEBUG] ✓ Site/Zone/Threshold/SiteConfig routes mounted");
} catch (e) {
  console.error("[ERROR] Failed to mount RBAC management routes:", e.message);
}

// ── Test route to verify new routing works ───────────────────
app.get("/api/test-rbac", (req, res) => {
  res.json({ message: "✅ RBAC routes are loaded and working!" });
});

app.get("/test", (req, res) => {
  res.json({ message: "✅ Root test route works!" });
});

// Catch-all debug route
app.use((req, res, next) => {
  console.log(`[DEBUG CATCH-ALL] ${req.method} ${req.originalUrl} - Route not matched`);
  next();
});

app.get("/", (req, res) => {
  res.json({
    message: " Serveur pollution-monitoring opérationnel !",
    version: "3.0 — Auth JWT + RBAC + MQTT activé",
  });
});

const { errorHandler } = require("./middleware/errorHandler");
app.use(errorHandler);

// ── WebSocket Stats Endpoint ──────────────────────────────────
app.get("/api/ws/stats", (req, res) => {
  res.json({
    success: true,
    websocket: getWSStats(),
  });
});

const PORT = process.env.PORT || 5000;

// Bootstrap: connect to MongoDB FIRST, then start the HTTP listener and all
// services that depend on the DB (MQTT, WebSocket, schedulers). Subscribing
// to MQTT before Mongoose is connected causes a stampede when the connection
// opens — buffered queries all fire at once and starve the event loop, which
// shows up as slow/timing-out login requests during the first few seconds.
(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("   → Vérifiez que MongoDB est lancé et que MONGO_URI est correct.");
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(` Serveur démarré sur le port ${PORT}`);
    console.log(` Authentification JWT activée`);

    try {
      const { startMQTTService } = require("./services/mqttService");
      startMQTTService();
      console.log(` Service MQTT démarré — écoute sur emissions/#`);
    } catch (err) {
      console.error(" Service MQTT non démarré:", err.message);
      console.log("   → Vérifiez que Mosquitto est lancé");
    }

    try {
      initializeWebSocket(server);
      console.log(` WebSocket activé — écoute sur /ws`);
    } catch (err) {
      console.error(" WebSocket non initialisé:", err.message);
    }

    try {
      const { startKPIBroadcaster } = require("./services/kpiBroadcaster");
      startKPIBroadcaster(5000);
      console.log(` KPI Broadcaster activé — données mock en streaming`);
    } catch (err) {
      console.error(" KPI Broadcaster non démarré:", err.message);
    }

    try {
      const kpiScheduler = require("./schedulers/kpiScheduler");
      kpiScheduler.start();
      console.log(` Schedulers KPI activés — agrégations automatiques`);
    } catch (err) {
      console.error(" Schedulers KPI non démarrés:", err.message);
    }
  });
})();
