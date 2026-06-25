/**
 * ============================================================
 * DEMO REPORT — Jeu de données complet pour captures / rapport
 * ============================================================
 * Prépare un système « comme en production » sans attendre des heures :
 *   1. Réinitialise MongoDB (45 j d'historique, pics de dépassement)
 *   2. Agrège HOURLY (72 h) + DAILY (toute la période) → courbes KPI
 *   3. Lance IF + LSTM sur toutes les zones (si service IA up)
 *   4. Option --live : démarre simulator.js en arrière-plan
 *
 * Usage:
 *   npm run demo:report
 *   npm run demo:report -- --live
 *   node demo-report.js --days 30
 *
 * Prérequis:
 *   - MongoDB
 *   - Backend : npm start
 *   - Service IA (FastAPI port 8000) pour prévisions / anomalies
 *   - Frontend : npm run dev → http://localhost:5173
 * ============================================================
 */

"use strict";

require("dotenv").config();
const { spawn } = require("child_process");
const path = require("path");

const DEMO_DAYS = parseInt(process.env.SEED_DAYS || "45", 10);
const HOURLY_HOURS = parseInt(process.env.AGG_HOURLY_HOURS || "72", 10);

const args = process.argv.slice(2);
const startLive = args.includes("--live");
const daysArg = args.find((a) => a.startsWith("--days="));
if (daysArg) {
  process.env.SEED_DAYS = daysArg.split("=")[1];
}

process.env.SEED_DAYS = String(parseInt(process.env.SEED_DAYS || String(DEMO_DAYS), 10));
process.env.SEED_DEMO = "1";
process.env.SKIP_DISCONNECT = "1";

const aggregationService = require("./services/AggregationService");
const aiService = require("./services/AIService");
const Zone = require("./models/Zone");

function logStep(title) {
  console.log("\n" + "─".repeat(62));
  console.log(`  ${title}`);
  console.log("─".repeat(62));
}

async function backfillAggregates(days, hourlyHours) {
  const zones = await Zone.find({ actif: true }).select("_id siteId nom code").lean();
  if (!zones.length) {
    console.log("  ⚠️  Aucune zone active — agrégation ignorée");
    return { daily: 0, hourly: 0 };
  }

  const now = new Date();
  now.setUTCMinutes(0, 0, 0);

  let dailyCount = 0;
  let hourlyCount = 0;

  logStep(`Agrégation DAILY — ${days} jours × ${zones.length} zones`);
  for (let d = days - 1; d >= 0; d--) {
    const periodStart = new Date(now);
    periodStart.setUTCDate(periodStart.getUTCDate() - d);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);

    for (const zone of zones) {
      const results = await aggregationService.aggregateAllPolluantsForZone(
        "DAILY",
        periodStart,
        periodEnd,
        zone._id.toString(),
        zone.siteId.toString(),
      );
      if (results.length) dailyCount += results.length;
    }
    if (d % 5 === 0 || d === 0) {
      process.stdout.write(`\r  Jour ${days - d}/${days} — ${dailyCount} agrégats polluants`);
    }
  }
  console.log(`\n  ✓ ${dailyCount} documents DAILY (polluants + IPE zone)`);

  logStep(`Agrégation HOURLY — ${hourlyHours} h × ${zones.length} zones (IA + historique récent)`);
  for (let h = hourlyHours; h >= 1; h--) {
    const periodEnd = new Date(now);
    periodEnd.setUTCHours(periodEnd.getUTCHours() - (h - 1));
    const periodStart = new Date(periodEnd);
    periodStart.setUTCHours(periodStart.getUTCHours() - 1);

    for (const zone of zones) {
      const results = await aggregationService.aggregateAllPolluantsForZone(
        "HOURLY",
        periodStart,
        periodEnd,
        zone._id.toString(),
        zone.siteId.toString(),
      );
      if (results.length) hourlyCount += results.length;
    }
    if (h % 12 === 0 || h === 1) {
      process.stdout.write(`\r  Heure ${hourlyHours - h + 1}/${hourlyHours} — ${hourlyCount} agrégats`);
    }
  }
  console.log(`\n  ✓ ${hourlyCount} documents HOURLY`);

  return { daily: dailyCount, hourly: hourlyCount };
}

async function runIA() {
  if (!aiService.isEnabled()) {
    console.log("  ⏭  IA désactivée (IA_ENABLED=false)");
    return false;
  }

  const health = await aiService.checkHealth();
  if (health.status === "unreachable" || health.status === "disabled") {
    console.log("  ⚠️  Service IA injoignable:", health.error || health.status);
    console.log("     Démarrez-le : cd ia && uvicorn api:app --port 8000");
    return false;
  }
  console.log("  ✓ Service IA:", health.status || "ok");

  try {
  if (process.env.IA_SKIP_IF !== "1") {
    const ifResult = await aiService.runAnomalyDetectionForAllZones();
    console.log("  ✓ Isolation Forest:", ifResult?.processed ?? ifResult?.length ?? "ok");
  }
  const lstmResult = await aiService.runForecastsForAllZones();
  console.log("  ✓ LSTM 4h:", lstmResult?.processed ?? lstmResult?.length ?? "ok");
  return true;
  } catch (err) {
    console.log("  ⚠️  Erreur IA:", err.message);
    return false;
  }
}

function startSimulator() {
  const script = path.join(__dirname, "simulator.js");
  const child = spawn(process.execPath, [script, "warning"], {
    cwd: __dirname,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  console.log(`  ✓ Simulateur MQTT démarré (PID ${child.pid}) — mode warning`);
  console.log("    Arrêt : taskkill /PID " + child.pid + "  (Windows) ou kill " + child.pid);
}

async function main() {
  const days = parseInt(process.env.SEED_DAYS, 10);
  const t0 = Date.now();

  console.log("\n" + "═".repeat(62));
  console.log("  DEMO REPORT — Préparation captures rapport");
  console.log("═".repeat(62));
  console.log(`  Historique : ${days} jours | Agrégats : DAILY + ${HOURLY_HOURS}h HOURLY`);
  console.log(`  Épisodes   : dépassements historiques + alertes récentes (Zone-Four)`);

  logStep("Phase 1/3 — Seed MongoDB (init-fresh mode démo)");
  const { main: seedMain } = require("./init-fresh");
  const seedStats = await seedMain();
  console.log(`  ✓ ${seedStats.totalReadings.toLocaleString()} lectures, ${seedStats.totalAlerts.toLocaleString()} alertes`);

  logStep("Phase 2/3 — Agrégation KPI (courbes Overview / Conformité)");
  const agg = await backfillAggregates(days, HOURLY_HOURS);

  logStep("Phase 3/3 — Prévisions IA (page Prédictions)");
  const iaOk = await runIA();

  if (startLive) {
    logStep("Bonus — Flux temps réel MQTT");
    startSimulator();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const mongoose = require("mongoose");
  await mongoose.disconnect();

  console.log("\n" + "═".repeat(62));
  console.log("  DEMO PRÊTE — captures recommandées");
  console.log("═".repeat(62));
  console.log("  1. Reconnectez-vous (session invalidée après reset BDD)");
  console.log("     superadmin@emissionsiq.tn / Admin1234!");
  console.log("     responsable.site@cimenterie-gabes.tn / Site1234!");
  console.log("");
  console.log("  2. Zone à sélectionner : « Zone Fours de Calcination »");
  console.log("     (alertes récentes NOX / PM25 / PM10)");
  console.log("");
  console.log("  Pages à capturer :");
  console.log("    • Vue d'ensemble  — KPI TD / EMJ / IPE / RCO₂ + historique");
  console.log("    • Historique      — 7 j / 30 j / 3 mois");
  console.log("    • Prédictions IA  — courbe +4 h" + (iaOk ? " (prêt)" : " (démarrer service IA)"));
  console.log("    • Alertes         — dépassements ouverts");
  console.log("    • Conformité      — scores par polluant");
  console.log("");
  if (!startLive) {
    console.log("  Flux live (optionnel) : npm run simulate");
  }
  console.log(`\n  Durée totale : ${elapsed}s | Agrégats : ${agg.daily} daily, ${agg.hourly} hourly`);
  console.log("═".repeat(62) + "\n");
}

main().catch((err) => {
  console.error("\n❌ demo-report failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
