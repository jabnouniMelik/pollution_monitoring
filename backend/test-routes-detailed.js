/**
 * Detailed debug - test all registered routes
 */
async function test() {
  const baseUrl = "http://localhost:5000";
  
  // Test existing working routes
  console.log("Testing existing routes:");
  const routes = [
    "/api/auth",
    "/api/industries", 
    "/api/users",
    "/api/sites"
  ];
  
  for (const route of routes) {
    try {
      const response = await fetch(`${baseUrl}${route}`, {
        method: "OPTIONS",
        headers: { "Content-Type": "application/json" },
      });
      console.log(`${route} → ${response.status} ${response.statusText}`);
    } catch (e) {
      console.log(`${route} → ERROR: ${e.message}`);
    }
  }
  
  console.log("\nTesting GET endpoints:");
  
  // Test with a simple request without auth first
  try {
    const response = await fetch(`${baseUrl}/api/users`, { method: "GET" });
    console.log(`GET /api/users (no auth) → ${response.status}`);
    const text = await response.text();
    console.log(`Response: ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`GET /api/users → ERROR: ${e.message}`);
  }
}

test();
