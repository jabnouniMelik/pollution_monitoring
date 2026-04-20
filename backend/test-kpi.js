/**
 * SCRIPT DE TEST : KPI
 * Teste les calculs KPI sans démarrer le serveur
 * Usage: node test-kpi.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const kpiService = require("./services/KPIService");
const aggregationService = require("./services/AggregationService");
const polluantRepository = require("./repositories/PolluantRepository");

async function testKPISystem() {
  try {
    console.log("🧪 TEST SYSTÈME KPI\n");
    console.log("=".repeat(60));

    // Connexion MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ Connecté à MongoDB\n");

    // Récupérer un polluant pour les tests
    const polluants = await polluantRepository.findAll();
    if (polluants.length === 0) {
      console.log("❌ Aucun polluant trouvé. Exécutez d'abord init:simulator");
      process.exit(1);
    }

    const testPolluant = polluants[0];
    console.log(`📊 Polluant de test: ${testPolluant.name}`);
    console.log(`   VLE: ${testPolluant.regulatoryLimit} ${testPolluant.unit}`);
    console.log(`   Poids IPE: ${testPolluant.weight || 0.1}\n`);

    // Définir période de test (dernières 24h)
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 1);

    console.log("📅 Période de test:");
    console.log(`   Début: ${periodStart.toISOString()}`);
    console.log(`   Fin:   ${periodEnd.toISOString()}\n`);

    console.log("=".repeat(60));
    console.log("TEST 1 : TAUX DE DÉPASSEMENT (TD)");
    console.log("=".repeat(60));

    try {
      const td = await kpiService.calculateTD(
        testPolluant._id,
        periodStart,
        periodEnd,
      );

      console.log("✓ Calcul TD réussi:");
      console.log(`   Taux de dépassement: ${td.tauxDepassement}%`);
      console.log(`   Dépassements: ${td.breachCount}`);
      console.log(`   Total mesures: ${td.totalCount}`);
      console.log(
        `   Conformité: ${td.tauxDepassement <= 2.0 ? "✅ OUI" : "❌ NON"} (objectif ≤ 2%)\n`,
      );
    } catch (error) {
      console.log(`❌ Erreur TD: ${error.message}\n`);
    }

    console.log("=".repeat(60));
    console.log("TEST 2 : ÉMISSION MOYENNE PAR JOUR (EMJ)");
    console.log("=".repeat(60));

    try {
      const emj = await kpiService.calculateEMJ(
        testPolluant._id,
        periodStart,
        periodEnd,
      );

      console.log("✓ Calcul EMJ réussi:");
      console.log(`   Émission: ${emj.emissionKgDay} kg/jour`);
      console.log(`   Concentration moyenne: ${emj.avgConcentration} mg/Nm³`);
      console.log(`   Débit d'air (Q_air): ${emj.qAir} Nm³/s\n`);
    } catch (error) {
      console.log(`❌ Erreur EMJ: ${error.message}\n`);
    }

    console.log("=".repeat(60));
    console.log("TEST 3 : INDICE PERFORMANCE ENVIRONNEMENTALE (IPE)");
    console.log("=".repeat(60));

    try {
      const ipe = await kpiService.calculateIPE(periodStart, periodEnd);

      console.log("✓ Calcul IPE réussi:");
      console.log(`   IPE global: ${ipe.ipe}/100`);
      console.log(
        `   Conformité: ${ipe.ipe >= 95 ? "✅ OUI" : "❌ NON"} (objectif ≥ 95)\n`,
      );

      console.log("   Scores par polluant:");
      for (const [name, data] of Object.entries(ipe.polluantScores)) {
        console.log(
          `   • ${name}: ${data.score}/100 (C_moy=${data.avgConcentration}, VLE=${data.vle})`,
        );
      }
      console.log();
    } catch (error) {
      console.log(`❌ Erreur IPE: ${error.message}\n`);
    }

    console.log("=".repeat(60));
    console.log("TEST 4 : AGRÉGATION COMPLÈTE");
    console.log("=".repeat(60));

    try {
      console.log("⏳ Agrégation de tous les polluants...");

      const results = await aggregationService.aggregateAllPolluants(
        "DAILY",
        periodStart,
        periodEnd,
      );

      console.log(`✓ Agrégation terminée: ${results.length} polluants`);

      if (results.length > 0) {
        console.log("\n   Résumé:");
        for (const result of results) {
          if (result.polluantId) {
            console.log(
              `   • ${result.polluantId.name}: TD=${result.tauxDepassement}%, EMJ=${result.emissionKgDay} kg/j`,
            );
          }
        }
      }
      console.log();
    } catch (error) {
      console.log(`❌ Erreur agrégation: ${error.message}\n`);
    }

    console.log("=".repeat(60));
    console.log("TEST 5 : RÉCUPÉRATION RÉSUMÉ KPI");
    console.log("=".repeat(60));

    try {
      const summary = await aggregationService.getKPISummary(
        "DAILY",
        periodStart,
        periodEnd,
      );

      console.log("✓ Résumé KPI récupéré:");
      console.log(`   IPE global: ${summary.globalIPE || "N/A"}/100`);
      console.log(`   Polluants: ${summary.polluants.length}`);

      if (summary.polluants.length > 0) {
        console.log("\n   Détails:");
        for (const p of summary.polluants) {
          console.log(
            `   • ${p.name}: TD=${p.tauxDepassement}%, EMJ=${p.emissionKgDay} kg/j, Qualité=${p.dataQuality}`,
          );
        }
      }
      console.log();
    } catch (error) {
      console.log(`❌ Erreur résumé: ${error.message}\n`);
    }

    console.log("=".repeat(60));
    console.log("✅ TESTS TERMINÉS");
    console.log("=".repeat(60));

    console.log("\n💡 Prochaines étapes:");
    console.log("   1. Démarrer le serveur: npm start");
    console.log("   2. Tester les endpoints API");
    console.log("   3. Vérifier les schedulers automatiques");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erreur test:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécution
testKPISystem();
