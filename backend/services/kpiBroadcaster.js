/**
 * KPI Data Broadcaster Service
 * Generates and broadcasts mock KPI data via WebSocket at regular intervals
 * For development and testing purposes
 */

const { broadcastKPIUpdate } = require("./websocketService");

let broadcastInterval = null;

/**
 * Start broadcasting KPI data at regular intervals
 * @param {number} intervalMs - Interval between broadcasts in milliseconds (default: 5000ms)
 */
function startKPIBroadcaster(intervalMs = 5000) {
  if (broadcastInterval) {
    console.warn("[KPI Broadcaster] Already running, stopping previous instance");
    stopKPIBroadcaster();
  }

  console.log(
    `[KPI Broadcaster] Starting with ${intervalMs}ms interval for mock data`
  );

  broadcastInterval = setInterval(() => {
    // Generate hourly KPI data (updated every 5 seconds)
    const hourlyKPI = generateHourlyKPI();
    broadcastKPIUpdate("kpi:hourly", hourlyKPI);

    // Generate daily KPI data (updated every 10 seconds - less frequent)
    if (Date.now() % 10000 < 5000) {
      const dailyKPI = generateDailyKPI();
      broadcastKPIUpdate("kpi:daily", dailyKPI);
    }

    // Generate weekly KPI data (updated every 30 seconds)
    if (Date.now() % 30000 < 5000) {
      const weeklyKPI = generateWeeklyKPI();
      broadcastKPIUpdate("kpi:weekly", weeklyKPI);
    }
  }, intervalMs);
}

/**
 * Stop broadcasting KPI data
 */
function stopKPIBroadcaster() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
    console.log("[KPI Broadcaster] Stopped");
  }
}

/**
 * Generate mock hourly KPI data
 * @returns {object} Hourly KPI metrics
 */
function generateHourlyKPI() {
  const timestamp = new Date();
  const hour = timestamp.getHours();

  return {
    timestamp: timestamp.toISOString(),
    period: "hourly",
    aggregation: `${hour}:00-${hour}:59`,
    metrics: {
      TD: {
        // Taux Dépassement
        value: Math.random() * 3,
        target: 2,
        unit: "%",
        status: Math.random() * 3 < 2 ? "compliant" : "alert",
      },
      EMJ: {
        // Émission Massique Journalière
        value: (Math.random() * 50 + 30).toFixed(2),
        target: 40,
        unit: "kg/day",
        status: Math.random() * 100 < 70 ? "compliant" : "warning",
      },
      IPE: {
        // Indice Pollution Émis
        value: (Math.random() * 20 + 85).toFixed(2),
        target: 95,
        unit: "index",
        status: Math.random() * 100 < 60 ? "compliant" : "alert",
      },
      RCO2: {
        // Réduction CO2
        value: (Math.random() * 8 - 2).toFixed(2),
        target: -5,
        unit: "%",
        status: Math.random() * 100 < 50 ? "compliant" : "warning",
      },
    },
    pollutants: {
      NOx: {
        concentration: (Math.random() * 200 + 50).toFixed(2),
        limit: 300,
        unit: "µg/m³",
        status: Math.random() * 100 < 80 ? "ok" : "warning",
      },
      SO2: {
        concentration: (Math.random() * 100 + 20).toFixed(2),
        limit: 125,
        unit: "µg/m³",
        status: Math.random() * 100 < 90 ? "ok" : "warning",
      },
      PM: {
        concentration: (Math.random() * 150 + 30).toFixed(2),
        limit: 200,
        unit: "µg/m³",
        status: Math.random() * 100 < 85 ? "ok" : "alert",
      },
      PM25: {
        concentration: (Math.random() * 75 + 15).toFixed(2),
        limit: 100,
        unit: "µg/m³",
        status: Math.random() * 100 < 80 ? "ok" : "warning",
      },
      PM10: {
        concentration: (Math.random() * 90 + 18).toFixed(2),
        limit: 120,
        unit: "µg/m³",
        status: Math.random() * 100 < 80 ? "ok" : "warning",
      },
      COV: {
        concentration: (Math.random() * 50 + 10).toFixed(2),
        limit: 100,
        unit: "µg/m³",
        status: Math.random() * 100 < 95 ? "ok" : "warning",
      },
      CO2: {
        concentration: (Math.random() * 500 + 400).toFixed(2),
        limit: 1000,
        unit: "ppm",
        status: "ok",
      },
    },
    sites: [
      {
        siteId: "site_001",
        name: "Industrial Park - Tunis",
        TD: (Math.random() * 3).toFixed(2),
        EMJ: (Math.random() * 50 + 30).toFixed(2),
        IPE: (Math.random() * 20 + 85).toFixed(2),
        status: Math.random() * 100 < 70 ? "compliant" : "warning",
      },
      {
        siteId: "site_002",
        name: "Factory - Sfax",
        TD: (Math.random() * 3).toFixed(2),
        EMJ: (Math.random() * 50 + 25).toFixed(2),
        IPE: (Math.random() * 20 + 80).toFixed(2),
        status: Math.random() * 100 < 75 ? "compliant" : "warning",
      },
    ],
  };
}

/**
 * Generate mock daily KPI data
 * @returns {object} Daily KPI aggregation
 */
function generateDailyKPI() {
  const timestamp = new Date();
  timestamp.setHours(0, 0, 0, 0);

  return {
    timestamp: timestamp.toISOString(),
    period: "daily",
    aggregation: timestamp.toLocaleDateString("en-US"),
    metrics: {
      TD: {
        value: (Math.random() * 2.5).toFixed(2),
        target: 2,
        unit: "%",
        status: Math.random() * 100 < 65 ? "compliant" : "warning",
      },
      EMJ: {
        value: (Math.random() * 55 + 35).toFixed(2),
        target: 40,
        unit: "kg/day",
        status: Math.random() * 100 < 60 ? "compliant" : "warning",
      },
      IPE: {
        value: (Math.random() * 15 + 88).toFixed(2),
        target: 95,
        unit: "index",
        status: Math.random() * 100 < 55 ? "compliant" : "alert",
      },
      RCO2: {
        value: (Math.random() * 7 - 1).toFixed(2),
        target: -5,
        unit: "%",
        status: Math.random() * 100 < 45 ? "compliant" : "warning",
      },
    },
    hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      TD: (Math.random() * 3).toFixed(2),
      EMJ: (Math.random() * 50 + 30).toFixed(2),
      IPE: (Math.random() * 20 + 85).toFixed(2),
    })),
  };
}

/**
 * Generate mock weekly KPI data
 * @returns {object} Weekly KPI aggregation
 */
function generateWeeklyKPI() {
  const timestamp = new Date();
  const startOfWeek = new Date(timestamp);
  startOfWeek.setDate(timestamp.getDate() - timestamp.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return {
    timestamp: timestamp.toISOString(),
    period: "weekly",
    aggregation: `Week ${Math.ceil(timestamp.getDate() / 7)}`,
    metrics: {
      TD: {
        value: (Math.random() * 2).toFixed(2),
        target: 2,
        unit: "%",
        status: Math.random() * 100 < 70 ? "compliant" : "warning",
      },
      EMJ: {
        value: (Math.random() * 50 + 38).toFixed(2),
        target: 40,
        unit: "kg/day",
        status: Math.random() * 100 < 65 ? "compliant" : "warning",
      },
      IPE: {
        value: (Math.random() * 10 + 92).toFixed(2),
        target: 95,
        unit: "index",
        status: Math.random() * 100 < 60 ? "compliant" : "alert",
      },
      RCO2: {
        value: (Math.random() * 6 - 0.5).toFixed(2),
        target: -5,
        unit: "%",
        status: Math.random() * 100 < 50 ? "compliant" : "warning",
      },
    },
    dailyBreakdown: Array.from({ length: 7 }, (_, i) => ({
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
      TD: (Math.random() * 2.5).toFixed(2),
      EMJ: (Math.random() * 55 + 35).toFixed(2),
      IPE: (Math.random() * 15 + 88).toFixed(2),
      RCO2: (Math.random() * 7 - 1).toFixed(2),
    })),
  };
}

module.exports = {
  startKPIBroadcaster,
  stopKPIBroadcaster,
};
