/**
 * SCHEDULER : KPI
 * Calcul automatique des agrégations et KPIs
 * Exécution périodique via node-cron
 */

const cron = require("node-cron");
const aggregationService = require("../services/AggregationService");
const siteRepository = require("../repositories/SiteRepository");
const aiService = require("../services/AIService");

class KPIScheduler {
  constructor() {
    this.tasks = [];
  }

  /**
   * Démarre tous les schedulers
   */
  start() {
    console.log("🕐 Démarrage des schedulers KPI...");

    // Agrégation HOURLY : toutes les heures à H:05
    this.tasks.push(
      cron.schedule("5 * * * *", async () => {
        console.log("\n⏰ [HOURLY] Agrégation horaire démarrée");
        await this.runHourlyAggregation();
      }),
    );

    // Agrégation DAILY : tous les jours à 00:10
    this.tasks.push(
      cron.schedule("10 0 * * *", async () => {
        console.log("\n⏰ [DAILY] Agrégation quotidienne démarrée");
        await this.runDailyAggregation();
      }),
    );

    // Agrégation WEEKLY : tous les lundis à 00:20
    this.tasks.push(
      cron.schedule("20 0 * * 1", async () => {
        console.log("\n⏰ [WEEKLY] Agrégation hebdomadaire démarrée");
        await this.runWeeklyAggregation();
      }),
    );

    // Agrégation MONTHLY : le 1er de chaque mois à 00:30
    this.tasks.push(
      cron.schedule("30 0 1 * *", async () => {
        console.log("\n⏰ [MONTHLY] Agrégation mensuelle démarrée");
        await this.runMonthlyAggregation();
      }),
    );

    // Nettoyage : tous les dimanches à 03:00
    this.tasks.push(
      cron.schedule("0 3 * * 0", async () => {
        console.log("\n🧹 Nettoyage des anciennes agrégations");
        await aggregationService.cleanOldAggregates();
      }),
    );

    console.log("✓ Schedulers KPI actifs");
    console.log("  - HOURLY  : toutes les heures à H:05");
    console.log("  - DAILY   : tous les jours à 00:10");
    console.log("  - WEEKLY  : tous les lundis à 00:20");
    console.log("  - MONTHLY : le 1er du mois à 00:30");
    console.log("  - CLEANUP : tous les dimanches à 03:00");
  }

  /**
   * Arrête tous les schedulers
   */
  stop() {
    console.log("🛑 Arrêt des schedulers KPI...");
    this.tasks.forEach((task) => task.stop());
    this.tasks = [];
    console.log("✓ Schedulers arrêtés");
  }

  /**
   * Agrégation horaire (dernière heure complète)
   */
  async runHourlyAggregation() {
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMinutes(0, 0, 0); // Début de l'heure actuelle

      const periodStart = new Date(periodEnd);
      periodStart.setHours(periodStart.getHours() - 1); // Heure précédente

      console.log(
        `  Période: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`,
      );

      // Agrégation par site
      const sites = await siteRepository.findAll();
      console.log(`  Sites trouvés: ${sites.length}`);

      let totalResults = 0;
      for (const site of sites) {
        try {
          const results = await aggregationService.aggregateAllPolluants(
            "HOURLY",
            periodStart,
            periodEnd,
            site._id.toString(), // Pass siteId for site-scoped aggregation
          );
          totalResults += results.length;
        } catch (error) {
          console.error(
            `    ⚠️ Erreur pour site ${site.name}: ${error.message}`,
          );
        }
      }

      console.log(`✓ Agrégation HOURLY terminée: ${totalResults} agrégations`);

      if (aiService.isEnabled()) {
        console.log("  [IA] Détection anomalies (Isolation Forest)…");
        await aiService.runAnomalyDetectionForAllZones(periodEnd);

        console.log("  [IA] Lancement prévisions LSTM 4 h…");
        await aiService.runForecastsForAllZones(periodEnd);
      }
    } catch (error) {
      console.error("❌ Erreur agrégation HOURLY:", error.message);
    }
  }

  /**
   * Agrégation quotidienne (jour précédent)
   */
  async runDailyAggregation() {
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setHours(0, 0, 0, 0); // Début du jour actuel

      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 1); // Jour précédent

      console.log(
        `  Période: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`,
      );

      // Agrégation par site
      const sites = await siteRepository.findAll();
      console.log(`  Sites trouvés: ${sites.length}`);

      let totalResults = 0;
      for (const site of sites) {
        try {
          const results = await aggregationService.aggregateAllPolluants(
            "DAILY",
            periodStart,
            periodEnd,
            site._id.toString(),
          );
          totalResults += results.length;
        } catch (error) {
          console.error(
            `    ⚠️ Erreur pour site ${site.name}: ${error.message}`,
          );
        }
      }

      console.log(`✓ Agrégation DAILY terminée: ${totalResults} agrégations`);
    } catch (error) {
      console.error("❌ Erreur agrégation DAILY:", error.message);
    }
  }

  /**
   * Agrégation hebdomadaire (semaine précédente)
   */
  async runWeeklyAggregation() {
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      
      // Début de la semaine actuelle (lundi)
      const dayOfWeek = periodEnd.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodEnd.setDate(periodEnd.getDate() - daysToMonday);
      periodEnd.setHours(0, 0, 0, 0);

      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7); // Semaine précédente

      console.log(
        `  Période: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`,
      );

      // Agrégation par site
      const sites = await siteRepository.findAll();
      console.log(`  Sites trouvés: ${sites.length}`);

      let totalResults = 0;
      for (const site of sites) {
        try {
          const results = await aggregationService.aggregateAllPolluants(
            "WEEKLY",
            periodStart,
            periodEnd,
            site._id.toString(),
          );
          totalResults += results.length;
        } catch (error) {
          console.error(
            `    ⚠️ Erreur pour site ${site.name}: ${error.message}`,
          );
        }
      }

      console.log(`✓ Agrégation WEEKLY terminée: ${totalResults} agrégations`);
    } catch (error) {
      console.error("❌ Erreur agrégation WEEKLY:", error.message);
    }
  }

  /**
   * Agrégation mensuelle (mois précédent)
   */
  async runMonthlyAggregation() {
    try {
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // 1er du mois actuel
      const periodStart = new Date(periodEnd);
      periodStart.setMonth(periodStart.getMonth() - 1); // 1er du mois précédent

      console.log(
        `  Période: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`,
      );

      // Agrégation par site
      const sites = await siteRepository.findAll();
      console.log(`  Sites trouvés: ${sites.length}`);

      let totalResults = 0;
      for (const site of sites) {
        try {
          const results = await aggregationService.aggregateAllPolluants(
            "MONTHLY",
            periodStart,
            periodEnd,
            site._id.toString(),
          );
          totalResults += results.length;
        } catch (error) {
          console.error(
            `    ⚠️ Erreur pour site ${site.name}: ${error.message}`,
          );
        }
      }

      console.log(`✓ Agrégation MONTHLY terminée: ${totalResults} agrégations`);
    } catch (error) {
      console.error("❌ Erreur agrégation MONTHLY:", error.message);
    }
  }

  /**
   * Exécution manuelle immédiate (pour tests)
   * @param {String} period - Type période
   */
  async runNow(period) {
    console.log(`\n🚀 Exécution manuelle: ${period}`);

    switch (period) {
      case "HOURLY":
        await this.runHourlyAggregation();
        break;
      case "DAILY":
        await this.runDailyAggregation();
        break;
      case "WEEKLY":
        await this.runWeeklyAggregation();
        break;
      case "MONTHLY":
        await this.runMonthlyAggregation();
        break;
      default:
        console.error(`Période invalide: ${period}`);
    }
  }
}

module.exports = new KPIScheduler();
