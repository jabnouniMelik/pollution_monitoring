require("dotenv").config();
const mongoose = require("mongoose");
const Reading = require("./models/Reading");
const Alert = require("./models/Alert");

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected\n");

    // Count readings
    const readingCount = await Reading.countDocuments({});
    console.log(`📊 Total Readings in DB: ${readingCount}`);

    // Sample readings
    const readings = await Reading.find({}).limit(5).exec();
    console.log(`\n📌 Sample Readings (first 5):`);
    readings.forEach((r, i) => {
      console.log(
        `  ${i + 1}. Sensor: ${r.sensorId}, Value: ${r.value} ${r.unit}`,
      );
    });

    // Count alerts
    const alertCount = await Alert.countDocuments({});
    console.log(`\n🚨 Total Alerts in DB: ${alertCount}`);

    // Sample alerts
    const alerts = await Alert.find({}).limit(10).exec();
    console.log(`\n📌 Sample Alerts (first 10):`);
    alerts.forEach((a, i) => {
      console.log(`  ${i + 1}. Severity: ${a.severity}, Message: ${a.message}`);
    });

    // Alert statistics
    const alertStats = await Alert.aggregate([
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
        },
      },
    ]);
    console.log(`\n📈 Alert Statistics by Severity:`);
    alertStats.forEach((stat) => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

checkData();
