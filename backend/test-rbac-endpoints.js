/**
 * TEST SCRIPT: Verify RBAC Endpoints
 * Tests all new RBAC-protected routes
 * Run: node test-rbac-endpoints.js
 */

require("dotenv").config();

const BASE_URL = "http://localhost:5000";
const TIMEOUT = 5000;

// ── Test Users ─────────────────────────────────────────────────
// In production, use real credentials from database
const testUsers = {
  admin: {
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    role: "SUPER_ADMIN",
  },
  supervisor: {
    username: "head_supervisor",
    email: "head@example.com",
    password: "head123",
    role: "HEAD_SUPERVISOR",
  },
  operator: {
    username: "operator",
    email: "operator@example.com",
    password: "operator123",
    role: "OPERATOR",
  },
};

// ── Helper Functions ───────────────────────────────────────────
const log = (emoji, message) => console.log(`${emoji} ${message}`);
const logSuccess = (msg) => log("✅", msg);
const logError = (msg) => log("❌", msg);
const logTest = (msg) => log("🧪", msg);
const logInfo = (msg) => log("ℹ️", msg);

// ── Login and get token ────────────────────────────────────────
async function login(email, password) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (response.ok && data.data?.accessToken) {
      return data.data.accessToken;
    } else {
      logError(`Login failed for ${email}: ${data.message || response.statusText}`);
      return null;
    }
  } catch (error) {
    logError(`Login failed for ${email}: ${error.message}`);
    return null;
  }
}

// ── Make API Request ───────────────────────────────────────────
async function makeRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      headers: { "Content-Type": "application/json" },
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const responseData = await response.json();
    
    return { success: response.ok, status: response.status, data: responseData };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: error.message,
    };
  }
}

// ── Test Suite ─────────────────────────────────────────────────
async function runTests() {
  log("🚀", "Starting RBAC Endpoints Test Suite\n");

  // 1. Test Authentication
  logTest("Testing Authentication Endpoints");
  log("", "");

  const adminToken = await login(testUsers.admin.email, testUsers.admin.password);
  if (adminToken) {
    logSuccess(`Admin logged in`);
    logInfo(`Token: ${adminToken.substring(0, 20)}...`);
  } else {
    logError(`Admin login failed`);
    return;
  }

  log("", "");

  // 2. Test User Management Routes
  logTest("Testing User Management Endpoints (/api/users)");
  log("", "");

  let result = await makeRequest("GET", "/api/users", null, adminToken);
  if (result.success && result.status === 200) {
    logSuccess(`GET /api/users → ${result.status} (Users list retrieved)`);
  } else {
    logError(`GET /api/users → ${result.status} ${result.message}`);
  }

  result = await makeRequest(
    "POST",
    "/api/users",
    {
      username: "testuser",
      email: "test@test.com",
      password: "test123",
      role: "OPERATOR",
    },
    adminToken
  );
  if (result.status === 201 || result.status === 400) {
    logSuccess(
      `POST /api/users → ${result.status} (User creation - expects 201 or 400 if exists)`
    );
  } else {
    logError(`POST /api/users → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/users/role/OPERATOR", null, adminToken);
  if (result.status === 200) {
    logSuccess(`GET /api/users/role/OPERATOR → ${result.status}`);
  } else {
    logError(`GET /api/users/role/OPERATOR → ${result.status} ${result.message}`);
  }

  log("", "");

  // 3. Test Site Management Routes
  logTest("Testing Site Management Endpoints (/api/sites)");
  log("", "");

  result = await makeRequest("GET", "/api/sites", null, adminToken);
  if (result.success && result.status === 200) {
    logSuccess(`GET /api/sites → ${result.status} (Sites list retrieved)`);
  } else {
    logError(`GET /api/sites → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/sites/industrie/test", null, adminToken);
  if (result.status === 200 || result.status === 404) {
    logSuccess(`GET /api/sites/industrie/:id → ${result.status}`);
  } else {
    logError(`GET /api/sites/industrie/:id → ${result.status} ${result.message}`);
  }

  log("", "");

  // 4. Test Zone Management Routes
  logTest("Testing Zone Management Endpoints (/api/zones)");
  log("", "");

  result = await makeRequest("GET", "/api/zones", null, adminToken);
  if (result.success && result.status === 200) {
    logSuccess(`GET /api/zones → ${result.status} (Zones list retrieved)`);
  } else {
    logError(`GET /api/zones → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/zones/site/test", null, adminToken);
  if (result.status === 200 || result.status === 404) {
    logSuccess(`GET /api/zones/site/:siteId → ${result.status}`);
  } else {
    logError(`GET /api/zones/site/:siteId → ${result.status} ${result.message}`);
  }

  log("", "");

  // 5. Test Site Config Management Routes
  logTest("Testing Site Config Management Endpoints (/api/site-config)");
  log("", "");

  result = await makeRequest("GET", "/api/site-config", null, adminToken);
  if (result.success && result.status === 200) {
    logSuccess(`GET /api/site-config → ${result.status} (Active config retrieved)`);
    if (result.data.data) {
      logInfo(`- Airflow: ${result.data.data.airflow || "N/A"}`);
      logInfo(`- KPI Target (TD): ${result.data.data.targets?.TD || "N/A"}%`);
    }
  } else {
    logError(`GET /api/site-config → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/site-config/targets", null, adminToken);
  if (result.status === 200) {
    logSuccess(`GET /api/site-config/targets → ${result.status}`);
  } else {
    logError(`GET /api/site-config/targets → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/site-config/weights", null, adminToken);
  if (result.status === 200) {
    logSuccess(`GET /api/site-config/weights → ${result.status}`);
  } else {
    logError(`GET /api/site-config/weights → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/site-config/airflow", null, adminToken);
  if (result.status === 200) {
    logSuccess(`GET /api/site-config/airflow → ${result.status}`);
  } else {
    logError(`GET /api/site-config/airflow → ${result.status} ${result.message}`);
  }

  log("", "");

  // 6. Test Threshold Config Management Routes
  logTest("Testing Threshold Config Management Endpoints (/api/thresholds)");
  log("", "");

  result = await makeRequest("GET", "/api/thresholds", null, adminToken);
  if (result.success && result.status === 200) {
    logSuccess(`GET /api/thresholds → ${result.status} (Active thresholds retrieved)`);
    if (result.data.data?.pollutants) {
      logInfo(`- Pollutants configured: ${Object.keys(result.data.data.pollutants).length}`);
    }
  } else {
    logError(`GET /api/thresholds → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/thresholds/all", null, adminToken);
  if (result.status === 200) {
    logSuccess(`GET /api/thresholds/all → ${result.status}`);
  } else {
    logError(`GET /api/thresholds/all → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/thresholds/pollutant/NOx", null, adminToken);
  if (result.status === 200) {
    logSuccess(`GET /api/thresholds/pollutant/:name → ${result.status}`);
  } else {
    logError(`GET /api/thresholds/pollutant/:name → ${result.status} ${result.message}`);
  }

  result = await makeRequest("GET", "/api/thresholds/report", null, adminToken);
  if (result.status === 200) {
    logSuccess(`GET /api/thresholds/report → ${result.status}`);
  } else {
    logError(`GET /api/thresholds/report → ${result.status} ${result.message}`);
  }

  log("", "");

  // 7. Test Authorization (non-admin should be denied)
  logTest("Testing Authorization (Permission Boundaries)");
  log("", "");

  const supervisorToken = await login(testUsers.supervisor.email, testUsers.supervisor.password);
  if (supervisorToken) {
    result = await makeRequest("POST", "/api/users", { username: "test" }, supervisorToken);
    if (result.status === 403) {
      logSuccess(`POST /api/users (non-SUPER_ADMIN) → 403 Forbidden ✅`);
    } else {
      logError(
        `POST /api/users (non-SUPER_ADMIN) → ${result.status} (Expected 403)`
      );
    }
  }

  log("", "");

  // 8. Test Unauthenticated Access
  logTest("Testing Unauthenticated Access");
  log("", "");

  result = await makeRequest("GET", "/api/users", null, null);
  if (result.status === 401) {
    logSuccess(`GET /api/users (no token) → 401 Unauthorized ✅`);
  } else {
    logError(`GET /api/users (no token) → ${result.status} (Expected 401)`);
  }

  log("", "");
  log("🏁", "Test Suite Complete");
}

// ── Run Tests ──────────────────────────────────────────────────
runTests().catch(console.error);
