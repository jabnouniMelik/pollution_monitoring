/**
 * Comprehensive RBAC Route Testing
 * Tests endpoints and shows middleware logs
 */
async function testEndpoints() {
  console.log("🚀 Starting RBAC Route Tests with Middleware Logging\n");

  const BASE_URL = "http://localhost:5000";

  // Step 1: Get authentication token
  console.log("=" .repeat(60));
  console.log("STEP 1: Authenticate");
  console.log("=" .repeat(60));

  let response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "admin123" }),
  });

  const loginData = await response.json();
  if (!loginData.data?.accessToken) {
    console.log("❌ Login failed:", loginData.message);
    return;
  }

  const token = loginData.data.accessToken;
  console.log("✅ Authentication successful");
  console.log(`   Token: ${token.substring(0, 50)}...\n`);

  // Step 2: Test various RBAC routes
  const tests = [
    { method: "GET", path: "/api/test", name: "Test Route (no auth)" },
    { method: "GET", path: "/api/users", name: "GET /api/users (RBAC)" },
    { method: "GET", path: "/api/sites", name: "GET /api/sites (RBAC)" },
    { method: "GET", path: "/api/zones", name: "GET /api/zones (RBAC)" },
    { method: "GET", path: "/api/site-config", name: "GET /api/site-config (RBAC)" },
    { method: "GET", path: "/api/thresholds", name: "GET /api/thresholds (RBAC)" },
  ];

  for (const test of tests) {
    console.log("=" .repeat(60));
    console.log(`Testing: ${test.name}`);
    console.log("=" .repeat(60));

    const options = {
      method: test.method,
      headers: { "Content-Type": "application/json" },
    };

    // Add token to RBAC routes
    if (test.path.includes("/api/") && test.path !== "/api/test") {
      options.headers.Authorization = `Bearer ${token}`;
    }

    try {
      response = await fetch(`${BASE_URL}${test.path}`, options);
      console.log(`Status: ${response.status} ${response.statusText}`);

      const contentType = response.headers.get("content-type");
      let data;
      if (contentType?.includes("application/json")) {
        data = await response.json();
        console.log(
          `Response: ${JSON.stringify(data, null, 2).substring(0, 200)}${
            JSON.stringify(data).length > 200 ? "..." : ""
          }`
        );
      } else {
        data = await response.text();
        console.log(`Response: ${data.substring(0, 200)}`);
      }

      if (response.ok) {
        console.log("✅ Request succeeded");
      } else {
        console.log(`⚠️  Request returned ${response.status}`);
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }

    console.log("");
  }

  console.log("=" .repeat(60));
  console.log("✅ Test suite complete");
  console.log("=" .repeat(60));
  console.log("\nCheck server terminal for middleware logs:");
  console.log("  [ROUTE MATCH] - Route was matched");
  console.log("  [VERIFY TOKEN] - Token verification");
  console.log("  [CHECK ROLE] - Role authorization");
}

testEndpoints().catch(console.error);
