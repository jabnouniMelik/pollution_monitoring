/**
 * SCRIPT 01 — SEED FULL TEST DATA
 * Creates a realistic multi-industry dataset for full workflow testing.
 *
 * Creates:
 *   3 Industries
 *     └── 1 Site each
 *         └── 2 Zones each
 *             └── 1 SensorNode each (6 nodes total)
 *                 └── 8 Sensors each (CO2, NOX, SO2, PM25, PM10, COV, TEMP, HUMIDITY)
 *   7 Polluants (regulatory reference data — idempotent)
 *   1 ThresholdConfig (Décret 2018-928 — idempotent)
 *   1 SiteConfig (KPI parameters — idempotent)
 *   Demo users (idempotent — skips if already exist)
 *
 * Usage: node testing/scripts/01-seed-full-data.js
 */

// Resolve modules from backend/node_modules so this script runs from any cwd
const path = require("path");
const BACKEND = path.join(__dirname, "../../backend");
require(path.join(BACKEND, "node_modules/dotenv")).config({ path: path.join(BACKEND, ".env") });
const mongoose = require(path.join(BACKEND, "node_modules/mongoose"));
const bcrypt   = require(path.join(BACKEND, "node_modules/bcryptjs"));

// ── Load models from backend ──────────────────────────────────
const modelsPath = path.join(__dirname, "../../backend/models");
const Industrie      = require(path.join(modelsPath, "Industrie"));
const Site           = require(path.join(modelsPath, "Site"));
const Zone           = require(path.join(modelsPath, "Zone"));
const SensorNode     = require(path.join(modelsPath, "SensorNode"));
const Sensor         = require(path.join(modelsPath, "Sensor"));
const Polluant       = require(path.join(modelsPath, "Polluant"));
const User           = require(path.join(modelsPath, "User"));
const ThresholdConfig = require(path.join(modelsPath, "ThresholdConfig"));
const SiteConfig     = require(path.join(modelsPath, "SiteConfig"));

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db";
const BCRYPT_COST = Number(process.env.BCRYPT_COST) || 10;

// ═══════════════════════════════════════════════════════════════
// DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const INDUSTRIES_DATA = [
  {
    nom: "Cimenterie Sfax",
    secteur: "Ciment",
    localisation: { ville: "Sfax", latitude: 34.7406, longitude: 10.7603 },
    contact: "contact@cimenterie-sfax.tn",
    sites: [
      {
        nom: "Site Principal Sfax",
        localisation: { ville: "Sfax", coordinates: [10.7603, 34.7406] },
        contact: { telephone: "+216 74 000 001", email: "site1@cimenterie-sfax.tn", responsable: "Karim Ben Ali" },
        zones: [
          { code: "Zone-A", nom: "Zone Fours de Calcination", description: "Fours rotatifs haute température" },
          { code: "Zone-B", nom: "Zone Concassage", description: "Unité de concassage et broyage" },
        ],
      },
    ],
  },
  {
    nom: "Raffinerie Bizerte",
    secteur: "Pétrochimie",
    localisation: { ville: "Bizerte", latitude: 37.2744, longitude: 9.8739 },
    contact: "contact@raffinerie-bizerte.tn",
    sites: [
      {
        nom: "Site Distillation Bizerte",
        localisation: { ville: "Bizerte", coordinates: [9.8739, 37.2744] },
        contact: { telephone: "+216 72 000 002", email: "site1@raffinerie-bizerte.tn", responsable: "Sonia Trabelsi" },
        zones: [
          { code: "Zone-A", nom: "Zone Distillation Atmosphérique", description: "Colonnes de distillation primaire" },
          { code: "Zone-B", nom: "Zone Stockage Produits", description: "Réservoirs de stockage intermédiaire" },
        ],
      },
    ],
  },
  {
    nom: "Chimie Gabès",
    secteur: "Chimie",
    localisation: { ville: "Gabès", latitude: 33.8814, longitude: 10.0982 },
    contact: "contact@chimie-gabes.tn",
    sites: [
      {
        nom: "Site Réacteurs Gabès",
        localisation: { ville: "Gabès", coordinates: [10.0982, 33.8814] },
        contact: { telephone: "+216 75 000 003", email: "site1@chimie-gabes.tn", responsable: "Mehdi Chaabane" },
        zones: [
          { code: "Zone-A", nom: "Zone Réacteurs Chimiques", description: "Réacteurs de synthèse et catalyse" },
          { code: "Zone-B", nom: "Zone Traitement Effluents", description: "Station de traitement des rejets" },
        ],
      },
    ],
  },
];

const POLLUANTS_DATA = [
  // CO2 : pas de VLE réglementaire — seuil interne suivi KPI
  { name: "CO2",         formula: "CO2",      unit: "ppm",     regulatoryLimit: 800,  warningThreshold: 640,  description: "Dioxyde de carbone",           conversionFactor: 1, weight: 0.05 },
  // NOX : 500 mg/Nm³ — Décret 2018-928, Annexe 1, §4 (flux > 25 kg/h)
  { name: "NOX",         formula: "NO+NO2",   unit: "mg/Nm³",  regulatoryLimit: 500,  warningThreshold: 400,  description: "Oxydes d'azote",               conversionFactor: 1, weight: 0.30 },
  // SO2 : 300 mg/Nm³ — Décret 2018-928, Annexe 1, §3 (flux > 25 kg/h)
  { name: "SO2",         formula: "SO2",      unit: "mg/Nm³",  regulatoryLimit: 300,  warningThreshold: 240,  description: "Dioxyde de soufre",            conversionFactor: 1, weight: 0.25 },
  // PM25 : 40 mg/m³ — Décret 2018-928, Annexe 1, §1 (flux > 1 kg/h)
  { name: "PM25",        formula: "PM2.5",    unit: "µg/m³",   regulatoryLimit: 40,   warningThreshold: 32,   description: "Particules fines PM2.5",       conversionFactor: 1, weight: 0.15 },
  { name: "PM10",        formula: "PM10",     unit: "µg/m³",   regulatoryLimit: 48,   warningThreshold: 38,   description: "Particules inhalables PM10",     conversionFactor: 1, weight: 0.10 },
  // COV : 110 mg/Nm³ — Décret 2018-928, Annexe 1, §7 (flux > 2 kg/h)
  { name: "COV",         formula: "COV",      unit: "mg/Nm³",  regulatoryLimit: 110,  warningThreshold: 88,   description: "Composés organiques volatils",  conversionFactor: 1, weight: 0.15 },
  { name: "TEMPERATURE", formula: "T",        unit: "°C",      regulatoryLimit: 35,   warningThreshold: 28,   description: "Température ambiante",         conversionFactor: 1, weight: 0.00 },
  { name: "HUMIDITY",    formula: "RH",       unit: "%RH",     regulatoryLimit: 60,   warningThreshold: 48,   description: "Humidité relative",            conversionFactor: 1, weight: 0.00 },
];

// Sensor specs per type — matches actual ESP32 hardware (see rapport/II3_Couche_IoT.md)
const SENSOR_SPECS = [
  { type: "CO2",         model: "MH-Z19B",  unit: "ppm"     },
  { type: "NOX",         model: "MQ-131",   unit: "mg/Nm³"  },
  { type: "SO2",         model: "MQ-136",   unit: "mg/Nm³"  },
  { type: "PM25",        model: "SDS011",   unit: "µg/m³"   },
  { type: "PM10",        model: "SDS011",   unit: "µg/m³"   },
  { type: "COV",         model: "SGP30",    unit: "mg/Nm³"  },
  { type: "TEMPERATURE", model: "DHT22",    unit: "°C"      },
  { type: "HUMIDITY",    model: "DHT22",    unit: "%RH"     },
];

const DEMO_USERS = [
  { username: "admin",           email: "admin@example.com",           password: "admin123",      role: "SUPER_ADMIN"     },
  { username: "head_supervisor", email: "head@example.com",            password: "head123",       role: "HEAD_SUPERVISOR" },
  { username: "site_supervisor", email: "site@example.com",            password: "site123",       role: "SITE_SUPERVISOR" },
  { username: "operator",        email: "operator@example.com",        password: "operator123",   role: "OPERATOR"        },
  { username: "auditor",         email: "auditor@example.com",         password: "auditor123",    role: "AUDITOR"         },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function log(msg)  { console.log(`  ${msg}`); }
function ok(msg)   { console.log(`  ✅ ${msg}`); }
function skip(msg) { console.log(`  ⏭️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }

// ═══════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function seedPolluants() {
  console.log("\n📦 Seeding Polluants...");
  const polluantMap = {};

  for (const p of POLLUANTS_DATA) {
    let doc = await Polluant.findOne({ name: p.name });
    if (doc) {
      skip(`Polluant '${p.name}' already exists`);
    } else {
      doc = await Polluant.create(p);
      ok(`Created polluant: ${p.name}`);
    }
    polluantMap[p.name] = doc._id;
  }

  return polluantMap;
}

async function seedThresholdConfig() {
  console.log("\n📏 Seeding ThresholdConfig...");
  const existing = await ThresholdConfig.findOne({ nom: "Configuration Globale" });
  if (existing) {
    skip("ThresholdConfig already exists");
    return;
  }

  await ThresholdConfig.create({
    nom: "Configuration Globale",
    description: "Seuils globaux basés sur Décret 2018-928, Annexe 1 (valeurs générales — toutes sources fixes industrielles tunisiennes)",
    polluants: {
      NOx:  { min: 0,   max: 500, warning: 400, critical: 600, unit: "mg/Nm³", reference: "Décret 2018-928, Annexe 1, §4 — NOₓ (flux > 25 kg/h)" },
      SO2:  { min: 0,   max: 300, warning: 240, critical: 360, unit: "mg/Nm³", reference: "Décret 2018-928, Annexe 1, §3 — SO₂ (flux > 25 kg/h)" },
      PM:   { min: 0,   max: 40,  warning: 32,  critical: 48,  unit: "mg/m³",  reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)" },
      PM25: { min: 0,   max: 40,  warning: 32,  critical: 48,  unit: "µg/m³",  reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)" },
      PM10: { min: 0,   max: 48,  warning: 38,  critical: 58,  unit: "µg/m³",  reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)" },
      COV:  { min: 0,   max: 110, warning: 88,  critical: 132, unit: "mg/Nm³", reference: "Décret 2018-928, Annexe 1, §7 — COV (flux > 2 kg/h)" },
      CO2:  { min: 400, max: 800, warning: 640, critical: 960, unit: "ppm",    reference: "Suivi interne — pas de VLE réglementaire" },
    },
    actif: true,
  });
  ok("ThresholdConfig created");
}

async function seedSiteConfig() {
  console.log("\n⚙️  Seeding SiteConfig...");
  const existing = await SiteConfig.findOne({ isActive: true });
  if (existing) {
    skip("SiteConfig already exists");
    return;
  }

  await SiteConfig.create({
    siteName: "Configuration Globale",
    airflow: 2.0,
    thermalPower: null,
    polluantWeights: { NOx: 0.30, SO2: 0.25, PM25: 0.15, PM10: 0.10, COV: 0.15, CO2: 0.05 },
    targets: { tauxDepassement: 2.0, ipe: 95, reductionCO2: -5.0 },
    isActive: true,
  });
  ok("SiteConfig created");
}

async function seedUsers() {
  console.log("\n👥 Seeding Users...");
  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ $or: [{ email: u.email }, { username: u.username }] });
    if (existing) {
      skip(`User '${u.username}' already exists`);
      continue;
    }
    const hashed = await bcrypt.hash(u.password, BCRYPT_COST);
    await User.create({ ...u, password: hashed });
    ok(`Created user: ${u.username} (${u.role})`);
  }
}

async function seedIndustriesTree(polluantMap) {
  console.log("\n🏭 Seeding Industries → Sites → Zones → SensorNodes → Sensors...");

  // Track all created nodes for the simulator config output
  const createdNodes = [];
  let nodeIndex = 0; // used for unique MAC addresses

  for (const indData of INDUSTRIES_DATA) {
    // ── Industry ──────────────────────────────────────────────
    let industrie = await Industrie.findOne({ nom: indData.nom });
    if (!industrie) {
      industrie = await Industrie.create({
        nom: indData.nom,
        secteur: indData.secteur,
        localisation: indData.localisation,
        contact: indData.contact,
        actif: true,
      });
      ok(`Industry: ${indData.nom}`);
    } else {
      skip(`Industry '${indData.nom}' already exists`);
    }

    for (const siteData of indData.sites) {
      // ── Site ────────────────────────────────────────────────
      let site = await Site.findOne({ nom: siteData.nom, industrieId: industrie._id });
      if (!site) {
        site = await Site.create({
          nom: siteData.nom,
          industrieId: industrie._id,
          localisation: {
            type: "Point",
            coordinates: siteData.localisation.coordinates,
            ville: siteData.localisation.ville,
          },
          contact: siteData.contact,
          actif: true,
        });
        ok(`  Site: ${siteData.nom}`);
      } else {
        skip(`  Site '${siteData.nom}' already exists`);
      }

      for (const zoneData of siteData.zones) {
        // ── Zone ──────────────────────────────────────────────
        let zone = await Zone.findOne({ code: zoneData.code, siteId: site._id });
        if (!zone) {
          zone = await Zone.create({
            code: zoneData.code,
            nom: zoneData.nom,
            siteId: site._id,
            industrieId: industrie._id,
            description: zoneData.description,
            localisation: {
              type: "Point",
              coordinates: [indData.localisation.longitude, indData.localisation.latitude],
            },
            actif: true,
          });
          ok(`    Zone: ${zoneData.code} — ${zoneData.nom}`);
        } else {
          skip(`    Zone '${zoneData.code}' already exists`);
        }

        // ── SensorNode ────────────────────────────────────────
        const nodeName = `Node-${indData.secteur.substring(0, 3).toUpperCase()}-${zoneData.code}`;
        // Unique MAC using sequential index (00:00 → 00:05 for 6 nodes)
        const macHex = nodeIndex.toString(16).padStart(2, "0").toUpperCase();
        const macAddress = `AA:BB:CC:DD:EE:${macHex}`;
        nodeIndex++;

        let node = await SensorNode.findOne({ nom: nodeName, IndustrieId: industrie._id });
        if (!node) {
          node = await SensorNode.create({
            nom: nodeName,
            IndustrieId: industrie._id,
            zoneId: zone._id,
            siteId: zone.siteId,
            localisation: {
              type: "Point",
              coordinates: [indData.localisation.longitude, indData.localisation.latitude],
            },
            Status: "Active",
            macAddress: macAddress,
          });
          ok(`      SensorNode: ${nodeName}`);
        } else {
          skip(`      SensorNode '${nodeName}' already exists`);
        }

        // ── Sensors (7 per node) ──────────────────────────────
        for (const spec of SENSOR_SPECS) {
          const polluantId = polluantMap[spec.type];
          if (!polluantId) {
            warn(`Polluant not found for type: ${spec.type}`);
            continue;
          }

          const existing = await Sensor.findOne({ sensorNodeId: node._id, type: spec.type });
          if (!existing) {
            await Sensor.create({
              sensorNodeId: node._id,
              PolluantId: polluantId,
              type: spec.type,
              model: spec.model,
              unit: spec.unit,
              isActive: true,
              calibrationDate: new Date(),
              driftThreshold: 5,
            });
          }
        }
        ok(`      Sensors: 7 sensors created for ${nodeName}`);

        createdNodes.push({
          nodeName,
          industrie: indData.nom,
          zone: zoneData.code,
          nodeId: node._id.toString(),
          macAddress,
        });
      }
    }
  }

  return createdNodes;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║        SEED FULL TEST DATA — EmissionsIQ         ║");
  console.log("╚══════════════════════════════════════════════════╝");

  console.log(`\n🔌 Connecting to ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  const polluantMap = await seedPolluants();
  await seedThresholdConfig();
  await seedSiteConfig();
  await seedUsers();
  const nodes = await seedIndustriesTree(polluantMap);

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                  SEED COMPLETE                   ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Created sensor nodes:                           ║");
  nodes.forEach((n) => {
    console.log(`║    • ${n.nodeName.padEnd(20)} [${n.zone}] ${n.industrie.substring(0, 16).padEnd(16)} ║`);
  });
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Login credentials:                              ║");
  console.log("║    SuperAdmin : admin@example.com / admin123     ║");
  console.log("║    Head Sup   : head@example.com  / head123      ║");
  console.log("║    Site Sup   : site@example.com  / site123      ║");
  console.log("║    Operator   : operator@example.com / operator123║");
  console.log("║    Auditor    : auditor@example.com / auditor123  ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Next step:                                      ║");
  console.log("║    node testing/scripts/02-multi-simulator.js    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
