const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const connectDB = async () => {
  const mongoUri =
    process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db";
  console.log(`🔗 Connecting to MongoDB: ${mongoUri}`);
  // A larger pool helps absorb bursts from MQTT ingestion + API traffic
  // without serializing them behind the default pool size (~100).
  await mongoose.connect(mongoUri, {
    maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 200,
    serverSelectionTimeoutMS: 10000,
  });
  console.log("MongoDB connected");
};

module.exports = connectDB;
