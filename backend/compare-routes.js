/**
 * Test both existing and new routes
 */
async function test() {
  const tests = [
    { path: "/api/auth/login", method: "POST", name: "Auth Login (existing)" },
    { path: "/api/industries", method: "GET", name: "Industries (existing)" },
    { path: "/api/users", method: "GET", name: "Users (new)" },
    { path: "/api/sites", method: "GET", name: "Sites (new)" },
  ];

  // Get a fresh token first
  console.log("Getting authentication token...\n");
  let response = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "admin123" }),
  });

  const loginData = await response.json();
  const token = loginData.data?.accessToken;

  console.log("Testing endpoints:\n");
  for (const test of tests) {
    const options = {
      method: test.method,
      headers: { "Content-Type": "application/json" },
    };

    if (token && test.name !== "Auth Login (existing)") {
      options.headers.Authorization = `Bearer ${token}`;
    }

    if (test.method === "POST" && test.name === "Auth Login (existing)") {
      options.body = JSON.stringify({ email: "admin@example.com", password: "admin123" });
    }

    try {
      const res = await fetch(`http://localhost:5000${test.path}`, options);
      const statusText = res.ok ? "✅" : "❌";
      console.log(`${statusText} ${test.name.padEnd(30)} → ${res.status}`);
    } catch (err) {
      console.log(`❌ ${test.name.padEnd(30)} → ERROR: ${err.message}`);
    }
  }
}

test();
