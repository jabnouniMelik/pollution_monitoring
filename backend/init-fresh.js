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
 *   6 Sensors per node  (CO2, NOX, SO2, PM25, PM10, COV)
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
const AggregateData = require("./models/AggregateData");
const LstmForecast  = require("./models/LstmForecast");
const AnomalyDetection = require("./models/AnomalyDetection");
const Report        = require("./models/Report");

// ── Constants ─────────────────────────────────────────────────
const DAYS        = parseInt(process.env.SEED_DAYS || "30", 10);
const INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const BATCH_SIZE  = 500;
const IS_DEMO     = process.env.SEED_DEMO === "1";

// Pollutant definitions — regulatory limits from Décret 2018-928 + 2018-928
// Annexe 1 (valeurs générales) — applicables à toutes sources fixes industrielles.
// Ces valeurs constituent les seuils par défaut du système générique.
// Pour un déploiement sectoriel spécifique, surcharger via ThresholdConfig.
const POLLUTANTS = [
  // CO2 : pas de VLE réglementaire — seuil interne pour suivi KPI
  { code: "CO2",  name: "CO2",  formula: "CO₂",  unit: "ppm",    regulatoryLimit: 800,  warningThreshold: 640,  weight: 0.05 },
  // NOx : 500 mg/Nm³ — Annexe 1, §4 (flux > 25 kg/h)
  { code: "NOX",  name: "NOX",  formula: "NOₓ",  unit: "mg/Nm³", regulatoryLimit: 500,  warningThreshold: 400,  weight: 0.30 },
  // SO2 : 300 mg/Nm³ — Annexe 1, §3 (flux > 25 kg/h)
  { code: "SO2",  name: "SO2",  formula: "SO₂",  unit: "mg/Nm³", regulatoryLimit: 300,  warningThreshold: 240,  weight: 0.25 },
  // PM25 : 40 mg/m³ — Annexe 1, §1 (flux > 1 kg/h)
  { code: "PM25", name: "PM25", formula: "PM₂.₅",unit: "µg/m³",  regulatoryLimit: 40,   warningThreshold: 32,   weight: 0.15 },
  // PM10 : même VLE poussières (Annexe 1, §1) — mesure SDS011 complémentaire
  { code: "PM10", name: "PM10", formula: "PM₁₀", unit: "µg/m³",  regulatoryLimit: 48,   warningThreshold: 38,   weight: 0.10 },
  // COV : 110 mg/Nm³ — Annexe 1, §7 (flux > 2 kg/h, exprimé en carbone total)
  { code: "COV",  name: "COV",  formula: "COV",  unit: "mg/Nm³", regulatoryLimit: 110,  warningThreshold: 88,   weight: 0.15 },
];

// Sensor models per pollutant — aligned with actual hardware (see rapport/II3_Couche_IoT.md)
const SENSOR_MODELS = {
  CO2: "MH-Z19B", NOX: "MQ-131", SO2: "MQ-136", PM25: "SDS011", PM10: "SDS011", COV: "SGP30",
};

// Emission profiles per zone (baseline ± amplitude + noise)
// Values calibrated against Décret 2018-928, Annexe 1 VLEs so normal operation
// stays mostly compliant but warning/breach events occur naturally.
// NOX VLE = 500 mg/Nm³ | SO2 VLE = 300 mg/Nm³ | PM VLE = 40 mg/m³ | COV VLE = 110 mg/Nm³
const PROFILES = {
  //                    CO2            NOX              SO2             PM25           PM10           COV
  "Zone-Four":      { CO2: [650,120,40], NOX: [400,80,40],  SO2: [240,50,30], PM25: [32,8,4],  PM10: [38,10,5], COV: [88,15,10]  },
  "Zone-Broyage":   { CO2: [420,80,30],  NOX: [260,60,30],  SO2: [150,40,20], PM25: [20,6,3],  PM10: [24,7,4],  COV: [58,10,7]   },
  "Zone-Stockage":  { CO2: [380,60,25],  NOX: [230,50,25],  SO2: [130,35,18], PM25: [16,4,2],  PM10: [19,5,2],  COV: [52,8,5]    },
  "Zone-Expedition":{ CO2: [350,50,20],  NOX: [200,40,20],  SO2: [110,30,15], PM25: [12,3,2],  PM10: [14,4,2],  COV: [46,7,4]    },
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

/** Épisodes de dépassement pour démo rapport (pics industriels + épisode récent). */
function buildDemoEpisodes(startTime, now) {
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  return [
    { zone: "Zone-Four", pol: "NOX", startMs: startTime + 5 * day, durationMs: 5 * hour, mult: 1.32 },
    { zone: "Zone-Four", pol: "SO2", startMs: startTime + 12 * day, durationMs: 4 * hour, mult: 1.28 },
    { zone: "Zone-Four", pol: "PM25", startMs: startTime + 20 * day, durationMs: 6 * hour, mult: 1.55 },
    { zone: "Zone-Four", pol: "PM10", startMs: startTime + 20 * day, durationMs: 6 * hour, mult: 1.45 },
    { zone: "Zone-Broyage", pol: "PM25", startMs: startTime + 28 * day, durationMs: 8 * hour, mult: 1.6 },
    { zone: "Zone-Broyage", pol: "COV", startMs: startTime + 35 * day, durationMs: 4 * hour, mult: 1.25 },
    { zone: "Zone-Stockage", pol: "SO2", startMs: startTime + 38 * day, durationMs: 3 * hour, mult: 1.22 },
    { zone: "Zone-Expedition", pol: "NOX", startMs: startTime + 42 * day, durationMs: 4 * hour, mult: 1.2 },
    // Dernières heures — visible immédiatement (alertes, IA, courbes live)
    { zone: "Zone-Four", pol: "NOX", startMs: now - 10 * hour, durationMs: 9 * hour, mult: 1.28 },
    { zone: "Zone-Four", pol: "PM25", startMs: now - 6 * hour, durationMs: 6 * hour, mult: 1.48 },
    { zone: "Zone-Four", pol: "PM10", startMs: now - 6 * hour, durationMs: 6 * hour, mult: 1.42 },
    { zone: "Zone-Four", pol: "CO2", startMs: now - 4 * hour, durationMs: 4 * hour, mult: 1.12 },
  ];
}

function applyDemoEpisodes(zoneCode, pollutantCode, baseValue, t, episodes) {
  let v = baseValue;
  for (const ep of episodes) {
    if (ep.zone !== zoneCode || ep.pol !== pollutantCode) continue;
    if (t < ep.startMs || t >= ep.startMs + ep.durationMs) continue;
    const mid = ep.startMs + ep.durationMs / 2;
    const dist = Math.abs(t - mid) / (ep.durationMs / 2);
    const shape = 1 + (1 - Math.min(dist, 1)) * 0.12;
    v *= ep.mult * shape;
  }
  const dow = new Date(t).getUTCDay();
  if (dow === 0 || dow === 6) v *= 0.5;
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
    AggregateData, LstmForecast, AnomalyDetection, Report,
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
  // Décret gouvernemental n° 2018-928 — Annexe 1 (valeurs générales)
  // décret gouvernemental n° 2018-928 du 7 novembre 2018.
  // Annexe 1 — Valeurs limites générales à la source, toutes sources fixes.
  // Pour un déploiement cimenteries, surcharger via ThresholdConfig (Annexe 6).
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 2: ThresholdConfig ──");
  await ThresholdConfig.create({
    nom: "Sources fixes — Décret 2018-928 (Annexe 1)",
    description: "Valeurs limites générales à la source pour toutes sources fixes industrielles — Décret gouvernemental n° 2018-928, Annexe 1.",
    installationType: "GENERAL",
    polluants: {
      // §1 — Poussières : 40 mg/m³ (flux > 1 kg/h)
      PM:   { min: 0, max: 40,  warning: 32,  critical: 48,  unit: "mg/m³",  reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)" },
      PM25: { min: 0, max: 40,  warning: 32,  critical: 48,  unit: "µg/m³",  reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)" },
      PM10: { min: 0, max: 48,  warning: 38,  critical: 58,  unit: "µg/m³",  reference: "Décret 2018-928, Annexe 1, §1 — Poussières (flux > 1 kg/h)" },
      // §3 — SO₂ : 300 mg/m³ (flux > 25 kg/h)
      SO2:  { min: 0, max: 300, warning: 240, critical: 360, unit: "mg/Nm³", reference: "Décret 2018-928, Annexe 1, §3 — SO₂ (flux > 25 kg/h)" },
      // §4 — NOₓ : 500 mg/m³ (flux > 25 kg/h)
      NOx:  { min: 0, max: 500, warning: 400, critical: 600, unit: "mg/Nm³", reference: "Décret 2018-928, Annexe 1, §4 — NOₓ (flux > 25 kg/h)" },
      // §7 — COV : 110 mg/m³ (flux > 2 kg/h, carbone total)
      COV:  { min: 0, max: 110, warning: 88,  critical: 132, unit: "mg/Nm³", reference: "Décret 2018-928, Annexe 1, §7 — COV (flux > 2 kg/h)" },
      // CO₂ : pas de VLE réglementaire — seuil interne suivi KPI
      CO2:  { min: 0, max: 800, warning: 640, critical: 960, unit: "ppm",    reference: "Suivi interne — pas de VLE réglementaire" },
    },
    warningOffsetPercent: 20,
    criticalOffsetPercent: 20,
    actif: true,
  });
  console.log("  ✓ ThresholdConfig created (Décret 2018-928, Annexe 1)");

  // ══════════════════════════════════════════════════════════
  // STEP 3 — SiteConfig (KPI parameters)
  // ══════════════════════════════════════════════════════════
  console.log("\n── Step 3: SiteConfig ──");
  await SiteConfig.create({
    siteName: "Cimenterie de Gabès",
    airflow: 3.5,
    polluantWeights: { NOx: 0.30, SO2: 0.25, PM25: 0.15, PM10: 0.10, COV: 0.15, CO2: 0.05 },
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
    password: "Audit1234!", role: "AUDITOR", industryId: industrie._id, isActive: true,
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
      pollutants: ["CO2", "NOX", "SO2", "PM25", "PM10", "COV"],
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
      nom: def.nom,
      IndustrieId: industrie._id,
      zoneId: zone._id,
      siteId: zone.siteId,
      Status: "Active",
      IPAddress: def.ip,
      macAddress: def.mac,
      localisation: { type: "Point", coordinates: zone.localisation.coordinates },
    });
    nodeDocs[def.zone] = node;
    await Zone.findByIdAndUpdate(zone._id, { sensorNodeCount: 1 });
    console.log(`  ✓ ${node.nom} (zone="${def.zone}")`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 10 — Sensors (6 per node = 24 total)
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
    console.log(`  ✓ 6 sensors for ${node.nom}`);
  }

  // ══════════════════════════════════════════════════════════
  // STEP 11 — Readings + Alerts
  // ══════════════════════════════════════════════════════════
  console.log(`\n── Step 11: Readings + Alerts (${DAYS} days × 5-min) ──`);
  console.log(`  Mode: ${IS_DEMO ? "DÉMO (épisodes de dépassement)" : "standard"}`);
  console.log("  Generating readings and alerts...\n");

  const now = Date.now();
  const startTime = now - DAYS * 24 * 60 * 60 * 1000;
  const steps = Math.floor((now - startTime) / INTERVAL_MS);
  const demoEpisodes = IS_DEMO ? buildDemoEpisodes(startTime, now) : null;

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
        let value = genValue(profile, t);
        if (demoEpisodes) {
          value = applyDemoEpisodes(zoneCode, p.code, value, t, demoEpisodes);
        }
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
            message: `${p.code} dépasse le seuil réglementaire ANPE (Décret 2018-928) — Dépassement : +${(((value - p.regulatoryLimit) / p.regulatoryLimit) * 100).toFixed(2)}%`,
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
  console.log(`  Sensors    : 24 (6 per node)`);
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

  if (process.env.SKIP_DISCONNECT !== "1") {
    await mongoose.disconnect();
    console.log("✓ Done\n");
  }

  return { totalReadings, totalAlerts, days: DAYS, demo: IS_DEMO };
}

if (require.main === module) {
  main().catch(e => {
    console.error("❌ init-fresh failed:", e.message);
    console.error(e.stack);
    process.exit(1);
  });
}

module.exports = { main, DAYS, IS_DEMO };
