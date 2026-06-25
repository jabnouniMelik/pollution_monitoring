const connectDB = require("../config/db");
const Indusrie = require("../models/Industrie");
const SensorNode = require("../models/SensorNode");
const Sensor = require("../models/Sensor");
const Polluant = require("../models/Polluant");
const Reading = require("../models/Reading");
const Alert = require("../models/Alert");
const Report = require("../models/Report");

async function runTests() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    // Clear existing test data
    await SensorNode.deleteMany({});
    await Indusrie.deleteMany({});
    await Polluant.deleteMany({});
    await Sensor.deleteMany({});
    await Reading.deleteMany({});
    await Alert.deleteMany({});
    await Report.deleteMany({});

    //industrie test
    const industrie = await Indusrie.create({
      nom: "industrie1",
      secteur: "Ciment",
      localisation: {
        ville: "Tunis",
        latitude: 36.8065,
        longitude: 10.1818,
      },
      contact: "12345678",
      actif: true,
    });
    console.log("Industrie created:", industrie.nom);

    //sensor node test
    const sensorNode = await SensorNode.create({
      nom: "Node1",
      IndustrieId: industrie._id,
      zone: "Zone-A",
      Status: "Active",
      IPAddress: "192.168.1.100",
      macAddress: "00:1B:44:11:3A:B7",
    });
    console.log("Sensor node created:", sensorNode.nom);

    //polluant test
    const polluant = await Polluant.create({
      name: "NOX",
      formula: "NO+NO2",
      unit: "mg/Nm3",
      regulatoryLimit: 200,
      warningThreshold: 150,
      description: "Oxides of nitrogen",
      conversionFactor: 2.05,
    });
    console.log("Polluant created:", polluant.name);

    //sensor test
    const sensor = await Sensor.create({
      sensorNodeId: sensorNode._id,
      PolluantId: polluant._id,
      type: "NOX",
      unit: "mg/Nm3",
      model: "ME4-NO2",
      calibrationDate: new Date(),
      driftThreshold: 5,
    });
    console.log("Sensor created:", sensor.type);

    //reading tests

    for (let i = 0; i < 5; i++) {
      await Reading.create({
        PolluantId: polluant._id,
        sensorId: sensor._id,
        nodeId: sensorNode._id,
        value: Math.random() * 200,
        unit: "mg/Nm3",
        isValid: true,
      });
    }
    console.log("Readings created for sensor:", sensor.type);

    //lire les readings du sensor
    const readings = await Reading.find({ sensorId: sensor._id })
      .sort({ timestamp: -1 })
      .limit(5)
      .populate("PolluantId", "name unit regulatoryLimit")
      .populate("sensorId", "model type");
    console.log("Latest readings for sensor:", sensor.type);
    readings.forEach((reading) => {
      const status =
        reading.value > reading.PolluantId.regulatoryLimit
          ? "Exceeding limit"
          : "Within limit";
      console.log(
        `- ${reading.sensorId.model} | ${reading.PolluantId.name}: ${reading.value.toFixed(2)} ${reading.PolluantId.unit} ${status}`,
      );
    });

    // Find a reading that exceeds the limit
    const exceedingReading = readings.find(
      (r) => r.value > r.PolluantId.regulatoryLimit,
    );

    if (exceedingReading) {
      const alert = await Alert.create({
        message: `NOx level ${exceedingReading.value.toFixed(2)} exceeds limit of ${exceedingReading.PolluantId.regulatoryLimit}`,
        threshold: exceedingReading.PolluantId.regulatoryLimit,
        value: exceedingReading.value,
        type: "Threshold",
        severity: "Warning",
        ReadingId: exceedingReading._id,
        SensorId: sensor._id,
        PolluantId: polluant._id,
        isAcknowledged: false,
      });
      console.log("Alert created:", alert.message);
    } else {
      console.log("No readings exceed the limit - skipping alert creation");
    }

    const reading = readings[0];

    //report test
    const report = await Report.create({
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      overallScore: 96.8,
      breachCount: 3,
      status: "DRAFT",
    });
    console.log(
      "\n📄 Rapport créé — Période:",
      report.periodStart.toLocaleDateString(),
      "→",
      report.periodEnd.toLocaleDateString(),
    );

    console.log("\n Tests completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error during tests:", err);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Error during tests:", err);
  process.exit(1);
});
