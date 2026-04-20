/**
 * Script to create demo users for testing
 * Usage: node init-users.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const DEMO_USERS = [
  {
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    name: "Admin User",
    role: "SUPER_ADMIN",
  },
  {
    username: "head_supervisor",
    email: "head@example.com",
    password: "head123",
    name: "Head Supervisor",
    role: "HEAD_SUPERVISOR",
  },
  {
    username: "site_supervisor",
    email: "site@example.com",
    password: "site123",
    name: "Site Supervisor",
    role: "SITE_SUPERVISOR",
  },
  {
    username: "operator",
    email: "operator@example.com",
    password: "operator123",
    name: "Site Operator",
    role: "OPERATOR",
  },
  {
    username: "auditor",
    email: "auditor@example.com",
    password: "audit123",
    name: "Auditor User",
    role: "AUDITOR",
  },
];

async function createDemoUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db",
    );
    console.log("✓ MongoDB connected");

    console.log("\n🔐 Creating demo users...\n");

    for (const userData of DEMO_USERS) {
      try {
        // Idempotent: if the user exists we reset their password so the
        // bcrypt hash is regenerated at the current BCRYPT_COST. This is what
        // makes `npm run init:users` usable as a "fix my demo accounts" tool
        // after bumping/lowering the cost factor.
        const existingUser = await User.findOne({ email: userData.email });

        if (existingUser) {
          existingUser.password = userData.password; // triggers pre-save hash
          existingUser.role = userData.role;
          existingUser.name = userData.name;
          existingUser.username = userData.username;
          existingUser.isActive = true;
          await existingUser.save();
          console.log(
            `  ↻ Rehashed ${userData.email} (${userData.role})`,
          );
          continue;
        }

        const user = new User({
          username: userData.username,
          email: userData.email,
          password: userData.password,
          name: userData.name,
          role: userData.role,
          isActive: true,
        });

        await user.save();
        console.log(`  ✓ Created ${userData.email} (${userData.role})`);
      } catch (err) {
        console.error(`  ✗ Error creating ${userData.email}:`, err.message);
      }
    }

    console.log("\n✅ Demo users initialized!\n");
    console.log("🔑 Demo Accounts:");
    DEMO_USERS.forEach((user) => {
      console.log(`  - ${user.email} / ${user.password} (${user.role})`);
    });

    await mongoose.disconnect();
    console.log("\n✓ Done\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

createDemoUsers();
