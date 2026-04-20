/**
 * Test route file loading
 */
try {
  console.log("Loading userManagementRoutes...");
  const routes = require("./routes/userManagementRoutes");
  console.log("✅ Loaded successfully");
  console.log("Type:", typeof routes);
  console.log("Is function?", typeof routes === "function");
  console.log("Methods:", Object.getOwnPropertyNames(routes).filter(m => !m.startsWith("_")));
  
  // Check if it's an Express Router
  console.log("Router stack length:", routes.stack?.length || 0);
  
  if (routes.stack) {
    console.log("\nRegistered routes:");
    routes.stack.forEach((layer, idx) => {
      console.log(`  [${idx}] ${layer.route?.path || layer.name} - ${layer.route?.methods ? Object.keys(layer.route.methods).join(",") : "middleware"}`);
    });
  }
} catch (error) {
  console.error("❌ Error loading routes:", error.message);
  console.error(error.stack);
}
