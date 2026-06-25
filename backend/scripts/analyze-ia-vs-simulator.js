/**
 * Compare IA outputs (LSTM + IF) to simulator readings / HOURLY aggregates.
 * Usage: node scripts/analyze-ia-vs-simulator.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Reading = require("../models/Reading");
const Polluant = require("../models/Polluant");
const AggregateData = require("../models/AggregateData");
const LstmForecast = require("../models/LstmForecast");
const AnomalyDetection = require("../models/AnomalyDetection");
const Site = require("../models/Site");
const SensorNode = require("../models/SensorNode");

const SIM_PROFILES = {
  CO2: { baseline: 650, unit: "ppm" },
  NOX: { baseline: 680, unit: "mg/Nm³" },
  SO2: { baseline: 340, unit: "mg/Nm³" },
  PM25: { baseline: 17, unit: "mg/m³" },
  COV: { baseline: 90, unit: "mg/Nm³" },
};

const LSTM_TO_DB = {
  CO2: "CO2",
  NOX: "NOX",
  SOX: "SO2",
  PM25: "PM25",
  PM10: "PM25",
  COV: "COV",
};

async function stats(values) {
  if (!values.length) return null;
  const n = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { n, mean, min, max, std: Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n) };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db");
  console.log("=== Analyse IA vs simulateur ===\n");

  const sites = await Site.find().select("name _id").lean();
  const polluants = await Polluant.find().lean();
  const pByName = Object.fromEntries(polluants.map((p) => [p.name, p]));

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

  for (const site of sites) {
    console.log(`\n## Site: ${site.name} (${site._id})`);

    const nodeIds = (
      await SensorNode.find({ siteId: site._id }).select("_id").lean()
    ).map((n) => n._id);

    // --- Readings last 6h (simulator ~10s cadence) ---
    const readings = await Reading.find({
      timestamp: { $gte: since },
      isValid: true,
      nodeId: { $in: nodeIds },
    })
      .populate("PolluantId", "name unit")
      .lean();

    const siteReadings = readings;

    const byPoll = {};
    for (const r of siteReadings) {
      const name = r.PolluantId?.name;
      if (!name) continue;
      if (!byPoll[name]) byPoll[name] = [];
      byPoll[name].push(r.value);
    }

    console.log("\n### Mesures simulateur (6 dernières h, toutes zones)");
    for (const [code, profile] of Object.entries(SIM_PROFILES)) {
      const dbName = code === "PM25" ? "PM25" : code;
      const vals = byPoll[dbName] || byPoll["PM2.5"] || [];
      const s = await stats(vals);
      if (!s) {
        console.log(`  ${code}: aucune lecture`);
        continue;
      }
      const ratio = s.mean / profile.baseline;
      console.log(
        `  ${code}: n=${s.n} moy=${s.mean.toFixed(1)} [${s.min.toFixed(1)}–${s.max.toFixed(1)}] ` +
          `sim baseline≈${profile.baseline} → ratio moy/baseline=${ratio.toFixed(2)}`,
      );
    }

    // --- HOURLY aggregates (zone-level, last 6h) ---
    const aggStart = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const aggs = await AggregateData.find({
      siteId: site._id,
      period: "HOURLY",
      periodStart: { $gte: aggStart },
      zoneId: { $ne: null },
    })
      .populate("polluantId", "name")
      .lean();

    console.log("\n### Agrégats HOURLY (entrée LSTM/IF)");
    const aggByPoll = {};
    for (const a of aggs) {
      const n = a.polluantId?.name;
      if (!n) continue;
      if (!aggByPoll[n]) aggByPoll[n] = [];
      aggByPoll[n].push(a.avgValue);
    }
    for (const [name, vals] of Object.entries(aggByPoll)) {
      const s = await stats(vals);
      const simKey = name === "PM2.5" ? "PM25" : name;
      const base = SIM_PROFILES[simKey]?.baseline;
      console.log(
        `  ${name}: ${vals.length} créneaux zone, moy horaire moy=${s.mean.toFixed(1)}` +
          (base ? ` (vs sim ~${base})` : ""),
      );
    }
    if (!aggs.length) console.log("  (aucun agrégat HOURLY — lancer scheduler ou attendre H:05)");

    // --- Latest LSTM forecast ---
    const fc = await LstmForecast.findOne({ siteId: site._id })
      .sort({ runAt: -1 })
      .lean();

    if (!fc) {
      console.log("\n### LSTM: aucune prévision en base");
    } else {
      console.log(
        `\n### Dernière prévision LSTM (run ${new Date(fc.runAt).toISOString()}, ancrage ${new Date(fc.anchorPeriodStart).toISOString()})`,
      );
      for (const step of fc.steps || []) {
        console.log(`  ${step.stepLabel} → ${step.targetTime}`);
        for (const p of step.pollutants || []) {
          const dbName = LSTM_TO_DB[p.name] || p.name;
          const sim = SIM_PROFILES[dbName === "PM25" ? "PM25" : dbName];
          const actualAgg = aggByPoll[dbName] || aggByPoll["PM2.5"];
          const aggMean = actualAgg?.length
            ? actualAgg.reduce((a, b) => a + b, 0) / actualAgg.length
            : null;
          const live = byPoll[dbName]?.length
            ? byPoll[dbName].reduce((a, b) => a + b, 0) / byPoll[dbName].length
            : null;
          const ref = live ?? aggMean;
          let note = "";
          if (ref != null && sim) {
            const errPct = ((p.valuePhysical - ref) / ref) * 100;
            const scaleErr = ((p.valuePhysical - sim.baseline) / sim.baseline) * 100;
            note = ` | vs mesures ${ref.toFixed(1)}: ${errPct >= 0 ? "+" : ""}${errPct.toFixed(0)}% | vs baseline sim ${scaleErr >= 0 ? "+" : ""}${scaleErr.toFixed(0)}%`;
          }
          console.log(
            `    ${p.name}: ${p.valuePhysical.toFixed(2)} ${p.unit || ""} [${p.predictionSource}]${note}`,
          );
        }
      }

      // Backtest +1h if target passed
      const step1 = fc.steps?.find((s) => s.stepHours === 1);
      if (step1?.targetTime) {
        const t1 = new Date(step1.targetTime);
        if (t1 < new Date()) {
          console.log("\n### Vérification rétro +1h (prévu vs lu après l'heure cible)");
          for (const p of step1.pollutants) {
            const dbName = LSTM_TO_DB[p.name] || p.name;
            const pId = pByName[dbName]?._id;
            if (!pId) continue;
            const windowStart = new Date(t1.getTime() - 30 * 60 * 1000);
            const windowEnd = new Date(t1.getTime() + 30 * 60 * 1000);
            const actual = await Reading.find({
              PolluantId: pId,
              timestamp: { $gte: windowStart, $lte: windowEnd },
              isValid: true,
            })
              .select("value")
              .lean();
            if (!actual.length) continue;
            const mean = actual.reduce((s, r) => s + r.value, 0) / actual.length;
            const err = p.valuePhysical - mean;
            const errPct = (err / mean) * 100;
            console.log(
              `    ${p.name}: prévu=${p.valuePhysical.toFixed(2)} réel≈${mean.toFixed(2)} Δ=${err >= 0 ? "+" : ""}${err.toFixed(2)} (${errPct >= 0 ? "+" : ""}${errPct.toFixed(1)}%)`,
            );
          }
        } else {
          console.log("\n  (+1h pas encore observable — cible dans le futur)");
        }
      }
    }

    // --- IF ---
    const ad = await AnomalyDetection.find({ siteId: site._id })
      .sort({ periodStart: -1 })
      .limit(3)
      .lean();

    console.log("\n### Isolation Forest (3 derniers créneaux)");
    if (!ad.length) console.log("  (aucune détection — scheduler IF ou données insuffisantes)");
    for (const d of ad) {
      console.log(
        `  ${new Date(d.periodStart).toISOString()}: ${d.isAnomaly ? "ANOMALIE" : "normal"} score=${d.anomalyScore.toFixed(3)}`,
      );
      if (d.featureCols?.length) {
        d.featureCols.forEach((c, i) => {
          const sim = SIM_PROFILES[c === "SOX" ? "SO2" : c === "PM10" ? "PM25" : c];
          const v = d.featureValues[i];
          const ratio = sim ? v / sim.baseline : null;
          console.log(
            `    ${c}=${v?.toFixed(2)}` + (ratio != null ? ` (${(ratio * 100).toFixed(0)}% baseline sim)` : ""),
          );
        });
      }
    }
  }

  console.log("\n=== Fin analyse ===");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
