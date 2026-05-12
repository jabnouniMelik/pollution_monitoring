/**
 * ============================================================
 * INIT-FRESH — Clean database and seed a complete demo system
 * ============================================================
 * Wipes ALL collections, then creates:
 *
 *   1 SUPER_ADMIN
 *   1 Industrie  : Cimenterie de Gabès
 *   2 Sites      : Site Principal Gabès | Site Annexe Gabès
 *   2 Zones/site : Zone-Four + Zone-Broyage | Zone-Stockage + Zone-Expedition
 *   1 SensorNode per zone (4 total)
 *   5 Sensors per node  (CO2, NOX, SO2, PM25, COV)
 *   30 days of readings (5-min interval) per sensor
 *   Alerts generated from readings that exceed thresholds
 *   1 HEAD_SUPERVISOR, 1 SITE_SUPERVISOR, 4 OPERATORs, 1 AUDITOR
 *   1 SiteConfig (KPI parameters)
 *   1 ThresholdConfig (regulatory limits)
 *
 * Usage:
 *   node init-fresh.js
 *   npm run init:fresh
 * ============================================================
 */

"use strict";
require("dotenv").config();
const mongoose = require("mongoose");

// ── Models ────────────────────────────────────────────────────
const Industrie     = require("./models/Industrie");
const Site          = require("./models/Site");
const Zone          = require("./models/Zone");
const SensorNode    = require("./models/SensorNode");
const Sensor        = require("./models/Sensor");
const Polluant      = require("./models/Polluant");
const Reading       = require("./models/Reading");
const Alert         = require("./models/Alert");
const User          = require("./models/User");
const SiteConfig    = require("./models/SiteConfig");
const ThresholdConfig = require("./models/ThresholdConfig");
const RefreshToken  = require("./models/RefreshToken");

// ── Constants ─────────────────────────────────────────────────
const DAYS        = 30;
const INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const BATCH_SIZE  = 500;

// Pollutant definitions — regulatory limits from Décret 2010-2516
const POLLUTANTS = [
  { code: "CO2",  name: "CO2",  formula: "CO₂",  unit: "ppm",     regulatoryLimit: 800,  warningThreshold: 600,  weight: 0.05 },
  { code: "NOX",  name: "NOX",  formula: "NOₓ",  unit: "mg/Nm³",  regulatoryLimit: 200,  warningThreshold: 150,  weight: 0.30 },
  { code: "SO2",  name: "SO2",  formula: "SO₂",  unit: "mg/Nm³",  regulatoryLimit: 100,  warningThreshold: 75,   weight: 0.25 },
  { code: "PM25", name: "PM25", formula: "PM₂.₅",unit: "µg/m³",   regulatoryLimit: 50,   warningThreshold: 35,   weight: 0.25 },
  { code: "COV",  name: "COV",  formula: "COV",  unit: "mg/Nm³",  regulatoryLimit: 30,   warningThreshold: 22,   weight: 0.15 },
];

// Sensor models per pollutant
const SENSOR_MODELS = {
  CO2: "MH-Z19B", NOX: "MiCS-6814", SO2: "MiCS-6814", PM25: "SDS011", COV: "BME680",
};

// Emission profiles per zone (baseline ± amplitude + noise)
const PROFILES = {
  "Zone-Four":      { CO2: [650,120,40], NOX: [85,30,15],  SO2: [45,20,10], PM25: [28,12,8],  COV: [18,8,5]  },
  "Zone-Broyage":   { CO2: [420,80,30],  NOX: [55,20,10],  SO2: [30,12,7],  PM25: [18,8,5],   COV: [12,5,3]  },
  "Zone-Stockage":  { CO2: [380,60,25],  NOX: [40,15,8],   SO2: [22,10,5],  PM25: [14,6,4],   COV: [9,4,2]   },
  "Zone-Expedition":{ CO2: [350,50,20],  NOX: [35,12,6],   SO2: [18,8,4],   PM25: [12,5,3],   COV: [7,3,2]   },
};

// ── Helpers ───────────────────────────────────────────────────
function genValue(profile, t) {
  const [baseline, amplitude, noise] = profile;
  const hour = new Date(t).getUTCHours();
  const dayFactor = (hour >= 6 && hour <= 18) ? 1.15 : 0.85;
  const wave = Math.sin(t / (4 * 60 * 60 * 1000));
  const v = (baseline + amplitude * wave + (Math.random() - 0.5) * 2 * noise) * dayFactor;
  return Math.max(0, Math.round(v * 100) / 100);
}

async function insertBatched(Model, docs, label) {
  let n = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await Model.insertMany(docs.slice(i, i + BATCH_SIZE), { ordered: false });
    n += Math.min(BATCH_SIZE, docs.length - i);
    process.stdout.write(`\r    ${label}: ${n}/${docs.length}`);
  }
  process.stdout.write("\n");
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db";
  await mongoose.connect(uri);
  console.log("✓ MongoDB connected:", uri, "\n");

  // ══════════════════════════════════════════════════════════
  // STEP 0 — Wipe all collections
  // ══════════════════════════════════════════════════════════
  console.log("── Step 0: Wiping all collections ──");
  const collections = [
    Alert, Reading, Sensor, SensorNode, Zone, Site, Industrie,
    Polluant, User, SiteConfig, ThresholdConfig, RefreshToken,
  ];
  for (const Model of collections) {
    const { deletedCount } = await Model.deleteMany({});
    console.log(`  ✓ ${Model.modelName}: ${deletedCount} deleted`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 1 — Polluants
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 1: Polluants ──");
  const polluantDocs = {};
  for (const p of POLLUTANTS) {
    const doc = await Polluant.create(p);
    polluantDocs[p.code] = doc;
    console.log(`  ✓ ${p.code}`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 2 — ThresholdConfig
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 2: ThresholdConfig ──");
  await ThresholdConfig.create({
    nom: "Configuration Globale",
    description: "Seuils réglementaires — Décret 2010-2516 (Tunisie)",
    polluants: {
      NOx:  { min: 50,  max: 200, warning: 150, critical: 200, unit: "mg/Nm³", reference: "Décret 2010-2516" },
      SO2:  { min: 20,  max: 100, warning: 75,  critical: 100, unit: "mg/Nm³", reference: "Décret 2010-2516" },
      PM:   { min: 10,  max: 50,  warning: 35,  critical: 50,  unit: "µg/m³",  reference: "Décret 2010-2516" },
      PM25: { min: 10,  max: 50,  warning: 35,  critical: 50,  unit: "µg/m³",  reference: "Décret 2010-2516" },
      COV:  { min: 5,   max: 30,  warning: 22,  critical: 30,  unit: "mg/Nm³", reference: "ANPE" },
      CO2:  { min: 400, max: 800, warning: 600, critical: 800, unit: "ppm",    reference: "Custom" },
    },
    warningOffsetPercent: 25,
    criticalOffsetPercent: 0,
    actif: true,
  });
  console.log("  ✓ ThresholdConfig created");

  // ══════════════════════════════════════════════════════════
  // STEP 3 — SiteConfig (KPI parameters)
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 3: SiteConfig ──");
  await SiteConfig.create({
    siteName: "Cimenterie de Gabès",
    airflow: 3.5,
    polluantWeights: { NOx: 0.30, SO2: 0.25, PM25: 0.25, COV: 0.15, CO2: 0.05 },
    targets: { tauxDepassement: 2.0, ipe: 95, reductionCO2: -5.0 },
    location: { type: "Point", coordinates: [10.0982, 33.8815] },
    isActive: true,
  });
  console.log("  ✓ SiteConfig created");

  // ══════════════════════════════════════════════════════════
  // STEP 4 — Industrie
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 4: Industrie ──");
  const industrie = await Industrie.create({
    nom: "Cimenterie de Gabès",
    secteur: "Ciment",
    localisation: { ville: "Gabès", latitude: 33.8815, longitude: 10.0982 },
    contact: "contact@cimenterie-gabes.tn",
    actif: true,
  });
  console.log("  ✓", industrie.nom);

  // ══════════════════════════════════════════════════════════
  // STEP 5 — Users
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 5: Users ──");

  const superAdmin = await new User({
    username: "superadmin", email: "superadmin@emissionsiq.tn",
    password: "Admin1234!", role: "SUPER_ADMIN", isActive: true,
  }).save();
  console.log("  ✓ SUPER_ADMIN:", superAdmin.email);

  const auditor = await new User({
    username: "auditor", email: "auditor@example.com",
    password: "Audit1234!", role: "AUDITOR", isActive: true,
  }).save();
  console.log("  ✓ AUDITOR:", auditor.email);

  const headSup = await new User({
    username: "resp_industrie_gabes", email: "responsable.industrie@cimenterie-gabes.tn",
    password: "Head1234!", role: "HEAD_SUPERVISOR", industryId: industrie._id, isActive: true,
  }).save();
  console.log("  ✓ HEAD_SUPERVISOR:", headSup.email);

  const siteSup = await new User({
    username: "resp_site_gabes", email: "responsable.site@cimenterie-gabes.tn",
    password: "Site1234!", role: "SITE_SUPERVISOR", industryId: industrie._id, isActive: true,
  }).save();
  console.log("  ✓ SITE_SUPERVISOR:", siteSup.email);

  // Operators created after zones (need zone IDs)

  // ══════════════════════════════════════════════════════════
  // STEP 6 — Sites (2)
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 6: Sites ──");

  const site1 = await Site.create({
    nom: "Site Principal Gabès",
    industrieId: industrie._id,
    supervisorId: siteSup._id,
    localisation: { type: "Point", coordinates: [10.0982, 33.8815], ville: "Gabès", adresse: "Route de Sfax, Gabès" },
    contact: { telephone: "+216 75 000 001", email: "site1@cimenterie-gabes.tn", responsable: siteSup.username },
    actif: true, approvalStatus: "APPROVED", approvedBy: superAdmin._id, approvedAt: new Date(),
    description: "Site principal de production de ciment Portland",
  });
  console.log("  ✓", site1.nom);

  const site2 = await Site.create({
    nom: "Site Annexe Gabès",
    industrieId: industrie._id,
    supervisorId: siteSup._id,
    localisation: { type: "Point", coordinates: [10.1050, 33.8750], ville: "Gabès", adresse: "Zone Industrielle, Gabès" },
    contact: { telephone: "+216 75 000 002", email: "site2@cimenterie-gabes.tn", responsable: siteSup.username },
    actif: true, approvalStatus: "APPROVED", approvedBy: superAdmin._id, approvedAt: new Date(),
    description: "Site annexe — stockage et expédition",
  });
  console.log("  ✓", site2.nom);

  // Assign sites to supervisors
  await User.findByIdAndUpdate(siteSup._id, { sitesManaging: [site1._id, site2._id] });
  await User.findByIdAndUpdate(headSup._id, { sitesManaging: [site1._id, site2._id] });

  // ══════════════════════════════════════════════════════════
  // STEP 7 — Zones (2 per site = 4 total)
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 7: Zones ──");

  const zoneConfigs = [
    { code: "Zone-Four",      nom: "Zone Fours de Calcination",  siteId: site1._id, coords: [10.0975, 33.8820], desc: "Fours rotatifs de calcination du clinker" },
    { code: "Zone-Broyage",   nom: "Zone Broyage & Expédition",  siteId: site1._id, coords: [10.0990, 33.8810], desc: "Broyage du clinker et expédition" },
    { code: "Zone-Stockage",  nom: "Zone Stockage Matières",     siteId: site2._id, coords: [10.1045, 33.8755], desc: "Stockage des matières premières" },
    { code: "Zone-Expedition",nom: "Zone Expédition Annexe",     siteId: site2._id, coords: [10.1055, 33.8745], desc: "Expédition depuis le site annexe" },
  ];

  const zoneDocs = {};
  for (const cfg of zoneConfigs) {
    const zone = await Zone.create({
      code: cfg.code, nom: cfg.nom, siteId: cfg.siteId, industrieId: industrie._id,
      description: cfg.desc,
      localisation: { type: "Point", coordinates: cfg.coords },
      actif: true, approvalStatus: "APPROVED", approvedBy: superAdmin._id, approvedAt: new Date(),
      pollutants: ["CO2", "NOX", "SO2", "PM", "COV"],
    });
    zoneDocs[cfg.code] = zone;
    console.log(`  ✓ ${zone.nom}`);
  }

  // Update site zone counts
  await Site.findByIdAndUpdate(site1._id, { zoneCount: 2 });
  await Site.findByIdAndUpdate(site2._id, { zoneCount: 2 });

  // ══════════════════════════════════════════════════════════
  // STEP 8 — Operators (1 per zone)
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 8: Operators ──");

  const operatorDefs = [
    { username: "operateur_four_gabes",      email: "operateur.four@cimenterie-gabes.tn",      zone: "Zone-Four" },
    { username: "operateur_broyage_gabes",   email: "operateur.broyage@cimenterie-gabes.tn",   zone: "Zone-Broyage" },
    { username: "operateur_stockage_gabes",  email: "operateur.stockage@cimenterie-gabes.tn",  zone: "Zone-Stockage" },
    { username: "operateur_expedition_gabes",email: "operateur.expedition@cimenterie-gabes.tn",zone: "Zone-Expedition" },
  ];

  for (const def of operatorDefs) {
    const zone = zoneDocs[def.zone];
    const op = await new User({
      username: def.username, email: def.email,
      password: "Oper1234!", role: "OPERATOR",
      industryId: industrie._id,
      zonesAssigned: [zone._id],
      isActive: true,
    }).save();
    await Zone.findByIdAndUpdate(zone._id, { $push: { operatorsAssigned: op._id } });
    console.log(`  ✓ OPERATOR ${def.username} → ${def.zone}`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 9 — SensorNodes (1 per zone)
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 9: SensorNodes ──");

  const nodeDefs = [
    { nom: "Node-Four",      zone: "Zone-Four",       mac: "AA:BB:CC:DD:EE:01", ip: "192.168.10.11" },
    { nom: "Node-Broyage",   zone: "Zone-Broyage",    mac: "AA:BB:CC:DD:EE:02", ip: "192.168.10.12" },
    { nom: "Node-Stockage",  zone: "Zone-Stockage",   mac: "AA:BB:CC:DD:EE:03", ip: "192.168.10.13" },
    { nom: "Node-Expedition",zone: "Zone-Expedition", mac: "AA:BB:CC:DD:EE:04", ip: "192.168.10.14" },
  ];

  const nodeDocs = {};
  for (const def of nodeDefs) {
    const zone = zoneDocs[def.zone];
    const node = await SensorNode.create({
      nom: def.nom, IndustrieId: industrie._id,
      zone: def.zone,   // ← matches Zone.code exactly
      Status: "Active", IPAddress: def.ip, macAddress: def.mac,
      localisation: { type: "Point", coordinates: zone.localisation.coordinates },
    });
    nodeDocs[def.zone] = node;
    await Zone.findByIdAndUpdate(zone._id, { sensorNodeCount: 1 });
    console.log(`  ✓ ${node.nom} (zone="${def.zone}")`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 10 — Sensors (5 per node = 20 total)
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 10: Sensors ──");

  const sensorDocs = {}; // "Zone-Four:CO2" → sensor
  for (const [zoneCode, node] of Object.entries(nodeDocs)) {
    for (const p of POLLUTANTS) {
      const sensor = await Sensor.create({
        sensorNodeId: node._id,
        PolluantId: polluantDocs[p.code]._id,
        type: p.code,
        model: SENSOR_MODELS[p.code],
        unit: p.unit,
        calibrationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      });
      sensorDocs[`${zoneCode}:${p.code}`] = sensor;
    }
    console.log(`  ✓ 5 sensors for ${node.nom}`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 11 — Readings + Alerts
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 11: Readings + Alerts (30 days × 5-min) ──");
  console.log("  Generating ~86,400 readings and alerts...\n");

  const now = Date.now();
  const startTime = now - DAYS * 24 * 60 * 60 * 1000;
  const steps = Math.floor((now - startTime) / INTERVAL_MS);

  let totalReadings = 0;
  let totalAlerts = 0;

  for (const [zoneCode, node] of Object.entries(nodeDocs)) {
    const zoneProfile = PROFILES[zoneCode];

    for (const p of POLLUTANTS) {
      const sensor = sensorDocs[`${zoneCode}:${p.code}`];
      const polluant = polluantDocs[p.code];
      const profile = zoneProfile[p.code];
      const readings = [];
      const alerts = [];

      for (let s = 0; s < steps; s++) {
        const t = startTime + s * INTERVAL_MS;
        const value = genValue(profile, t);
        const isValid = value >= 0;

        readings.push({
          sensorId: sensor._id,
          PolluantId: polluant._id,
          nodeId: node._id,
          value, unit: p.unit, rawValue: value, isValid,
          timestamp: new Date(t),
        });

        // Generate alert if value exceeds warning threshold
        if (value >= p.warningThreshold) {
          const severity = value >= p.regulatoryLimit ? "Critical" : "Warning";
          alerts.push({
            PolluantId: polluant._id,
            SensorId: sensor._id,
            ReadingId: null, // will be set after reading insert
            severity,
            type: "Threshold",
            value,
            threshold: value >= p.regulatoryLimit ? p.regulatoryLimit : p.warningThreshold,
            message: `${p.code} dépasse le seuil réglementaire ANPE (NT 106.04) — Dépassement : +${(((value - p.regulatoryLimit) / p.regulatoryLimit) * 100).toFixed(2)}%`,
            timestamp: new Date(t),
            isAcknowledged: Math.random() > 0.7, // 30% unacknowledged
          });
        }
      }

      await insertBatched(Reading, readings, `${node.nom}/${p.code} readings`);
      totalReadings += readings.length;

      if (alerts.length > 0) {
        // Assign a dummy ReadingId (first reading of this batch)
        const firstReading = await Reading.findOne({ sensorId: sensor._id }).select("_id").lean();
        const alertsWithReading = alerts.map(a => ({ ...a, ReadingId: firstReading?._id || new mongoose.Types.ObjectId() }));
        await insertBatched(Alert, alertsWithReading, `${node.nom}/${p.code} alerts`);
        totalAlerts += alerts.length;
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // STEP 12 — Final summary
  // ══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(62));
  console.log("  FRESH SYSTEM INITIALIZED");
  console.log("═".repeat(62));
  console.log(`  Industrie  : Cimenterie de Gabès`);
  console.log(`  Sites      : Site Principal Gabès | Site Annexe Gabès`);
  console.log(`  Zones      : Zone-Four | Zone-Broyage | Zone-Stockage | Zone-Expedition`);
  console.log(`  SensorNodes: 4 (1 per zone)`);
  console.log(`  Sensors    : 20 (5 per node)`);
  console.log(`  Readings   : ${totalReadings.toLocaleString()}`);
  console.log(`  Alerts     : ${totalAlerts.toLocaleString()}`);
  console.log("═".repeat(62));
  console.log("\n  ACCOUNTS:");
  console.log("  SUPER_ADMIN      : superadmin@emissionsiq.tn          / Admin1234!");
  console.log("  HEAD_SUPERVISOR  : responsable.industrie@cimenterie-gabes.tn / Head1234!");
  console.log("  SITE_SUPERVISOR  : responsable.site@cimenterie-gabes.tn      / Site1234!");
  console.log("  OPERATOR (Four)  : operateur.four@cimenterie-gabes.tn        / Oper1234!");
  console.log("  OPERATOR (Broyage): operateur.broyage@cimenterie-gabes.tn   / Oper1234!");
  console.log("  OPERATOR (Stockage): operateur.stockage@cimenterie-gabes.tn / Oper1234!");
  console.log("  OPERATOR (Expéd.): operateur.expedition@cimenterie-gabes.tn / Oper1234!");
  console.log("  AUDITOR          : auditor@example.com                       / Audit1234!");
  console.log("═".repeat(62) + "\n");

  await mongoose.disconnect();
  console.log("✓ Done\n");
}

main().catch(e => {
  console.error("❌ init-fresh failed:", e.message);
  console.error(e.stack);
  process.exit(1);
});
