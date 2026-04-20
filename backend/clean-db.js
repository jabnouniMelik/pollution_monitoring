require("dotenv").config();
const mongoose = require("mongoose");
const Polluant = require("./models/Polluant");
const Reading = require("./models/Reading");
const Alert = require("./models/Alert");
const Sensor = require("./models/Sensor");
const SensorNode = require("./models/SensorNode");

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🔄 Nettoyage de la base de données...\n");

    // First, let's get the current polluants WITH IDs
    const polluants = await Polluant.find({});
    console.log("📋 Polluants actuels en DB:");
    polluants.forEach((p) => {
      console.log(`  - ${p.name}: _id = ${p._id}`);
    });

    // Clear readings and alerts (but not polluants or sensors)
    const readingCount = await Reading.deleteMany({});
    console.log(`\n✅ Cleared ${readingCount.deletedCount} readings`);

    const alertCount = await Alert.deleteMany({});
    console.log(`✅ Cleared ${alertCount.deletedCount} alerts\n`);

    console.log("✨ Database is now clean and ready for new simulator data!");

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur:", err.message);
    process.exit(1);
  }
}

main();
