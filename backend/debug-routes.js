/**
 * Detailed debug - get fresh token and test
 */
async function test() {
  // First, login to get a fresh token
  console.log("Step 1: Getting fresh authentication token...");
  let response = await fetch("http://localhost:5000/api/auth/login", {
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
  console.log("✅ Got token:", token.substring(0, 40) + "...\n");

  // Test the endpoint
  console.log("Step 2: Testing /api/users endpoint...");
  response = await fetch("http://localhost:5000/api/users", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  console.log("Status:", response.status);
  console.log("Headers:", Object.fromEntries(response.headers));

  const text = await response.text();
  console.log("\nResponse (first 500 chars):");
  console.log(text.substring(0, 500));

  if (text.startsWith("{")) {
    try {
      const json = JSON.parse(text);
      console.log("\n✅ Valid JSON response");
      console.log("Response:", JSON.stringify(json, null, 2).substring(0, 300));
    } catch (e) {
      console.log("Could not parse as JSON");
    }
  }
}

test();
