/**
 * Quick login test
 */
async function test() {
  const response = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "admin123" }),
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));
  
  if (data.accessToken) {
    console.log("\n✅ Login successful!");
    console.log("Token:", data.accessToken.substring(0, 30) + "...");
  }
}

test();
