/**
 * Test if userManagementController loads correctly
 */
try {
  console.log("Loading userManagementController...");
  const controller = require("./controllers/userManagementController");
  console.log("✅ Loaded successfully");
  console.log("Exported methods:", Object.keys(controller));
} catch (error) {
  console.error("❌ Error loading controller:", error.message);
  console.error(error.stack);
}
