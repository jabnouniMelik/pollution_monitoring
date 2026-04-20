/**
 * Delete demo users for cleanup
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function cleanupUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await User.deleteMany({
      email: {
        $in: [
          "admin@example.com",
          "head@example.com",
          "site@example.com",
          "operator@example.com",
          "auditor@example.com",
        ],
      },
    });

    console.log(`✓ Deleted ${result.deletedCount} users`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

cleanupUsers();
