/**
 * SERVICE : KPI
 * Calculs des 4 KPIs environnementaux selon norme Décret 2018-928
 *
 * KPI 1 : TD (Taux de Dépassement) - % mesures > VLE
 * KPI 2 : EMJ (Émission Moyenne par Jour) - kg/jour
 * KPI 3 : IPE (Indice Performance Environnementale) - Score /100
 * KPI 4 : RCO2 (Réduction CO2) - % réduction vs période précédente
 */

const readingRepository = require("../repositories/ReadingRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const siteConfigRepository = require("../repositories/SiteConfigRepository");

function normalizeRco2TargetValue(value, fallback = -5) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return n > 0 ? -n : n;
}
const sensorNodeRepository = require("../repositories/SensorNodeRepository");
const Reading = require("../models/Reading");

class KPIService {
  /**
   * Résout les IDs de nœuds pour une zone donnée.
   * Utilisé pour scoper les calculs KPI à une zone physique.
   * @param {String} zoneId - ID de la zone
   * @returns {Promise<Array<ObjectId>>} Array d'IDs de SensorNode
   */
  async getNodeIdsForZone(zoneId) {
    return await sensorNodeRepository.findNodeIdsByZone(zoneId);
  }

  /**
   * Normalize pollutant name to canonical form for weight/config lookups
   * Handles inconsistent naming: PM25 <-> PM2.5, NOX <-> NOx, etc.
   * @param {String} name - Pollutant name
   * @returns {String} Canonical form
   */
  normalizePollutantName(name) {
    if (!name) return null;
    const nameMap = {
      PM10: "PM10",
      pm10: "PM10",
      PM25: "PM2.5",
      pm25: "PM2.5",
      "PM2.5": "PM2.5",
      "pm2.5": "PM2.5",
      NOx: "NOx",
      nox: "NOx",
      NOX: "NOx",
      SO2: "SO2",
      so2: "SO2",
      COV: "COV",
      cov: "COV",
      CO2: "CO2",
      co2: "CO2",
      CO2e: "CO2e",
      co2e: "CO2e",
    };
    return nameMap[name] || name;
  }

  /**
   * Get weight for a pollutant, handling normalization
   * @param {String} pollutantName - Pollutant name
   * @param {Object} siteWeights - Weights from site config
   * @param {Number} defaultWeight - Fallback weight
   * @returns {Number} Resolved weight
   */
  resolvePollutantWeight(pollutantName, siteWeights = {}, defaultWeight = 0.1) {
    const normalized = this.normalizePollutantName(pollutantName);
    return (
      siteWeights[normalized] || siteWeights[pollutantName] || defaultWeight
    );
  }

  /**
   * CALCUL COMPLÉMENTAIRE : WARNINGCOUNT
   * Compte les mesures entre warningThreshold et regulatoryLimit (seuil d'alerte)
   *
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début période
   * @param {Date} periodEnd - Date fin période
   * @param {Array|null} nodeIdFilter - Optional array of nodeIds to scope calculation
   * @returns {Promise<Object>} { warningCount, totalCount }
   */
  async calculateWarningCount(
    polluantId,
    periodStart,
    periodEnd,
    nodeIdFilter = null,
  ) {
    try {
      const polluant = await polluantRepository.findById(polluantId);
      if (!polluant || !polluant.warningThreshold) {
        return { warningCount: 0, totalCount: 0 };
      }

      const warningThreshold = polluant.warningThreshold;

      // Build match for counts (optionally filter by nodeId)
      const baseMatch = {
        PolluantId: polluantId,
        timestamp: { $gte: periodStart, $lte: periodEnd },
        isValid: true,
      };
      if (
        nodeIdFilter &&
        Array.isArray(nodeIdFilter) &&
        nodeIdFilter.length > 0
      ) {
        baseMatch.nodeId = { $in: nodeIdFilter };
      }

      // Compter toutes les mesures valides
      const totalCount = await Reading.countDocuments(baseMatch);

      // Compter les avertissements (warningThreshold ≤ value < regulatoryLimit)
      const warningMatch = Object.assign({}, baseMatch, {
        value: {
          $gte: warningThreshold,
          $lt: polluant.regulatoryLimit || warningThreshold + 1,
        },
      });
      const warningCount = await Reading.countDocuments(warningMatch);

      return { warningCount, totalCount };
    } catch (error) {
      console.error("Erreur calcul warningCount:", error.message);
      throw error;
    }
  }

  /**
   * KPI 1 : TAUX DE DÉPASSEMENT (TD)
   * Formule : TD = (N_breach / N_total) × 100
   * Objectif : ≤ 2% / mois
   *
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début période
   * @param {Date} periodEnd - Date fin période
   * @returns {Promise<Object>} { tauxDepassement, breachCount, totalCount }
   */
  async calculateTD(polluantId, periodStart, periodEnd, nodeIdFilter = null) {
    try {
      const polluant = await polluantRepository.findById(polluantId);
      if (!polluant) {
        return { tauxDepassement: 0, breachCount: 0, totalCount: 0 };
      }

      if (!polluant.regulatoryLimit) {
        console.warn(
          `[TD] ${polluant.name}: missing regulatoryLimit, returning 0`,
        );
        return { tauxDepassement: 0, breachCount: 0, totalCount: 0 };
      }

      const vle = polluant.regulatoryLimit;

      // Build match for counts (optionally filter by nodeId)
      const baseMatch = {
        PolluantId: polluantId,
        timestamp: { $gte: periodStart, $lte: periodEnd },
        isValid: true,
      };
      if (
        nodeIdFilter &&
        Array.isArray(nodeIdFilter) &&
        nodeIdFilter.length > 0
      ) {
        baseMatch.nodeId = { $in: nodeIdFilter };
      }

      // Compter toutes les mesures valides
      const totalCount = await Reading.countDocuments(baseMatch);

      // Compter les dépassements (value > VLE)
      const breachMatch = Object.assign({}, baseMatch, {
        value: { $gt: vle },
      });
      const breachCount = await Reading.countDocuments(breachMatch);

      const tauxDepassement =
        totalCount > 0 ? (breachCount / totalCount) * 100 : 0;

      return {
        tauxDepassement: parseFloat(tauxDepassement.toFixed(2)),
        breachCount,
        totalCount,
      };
    } catch (error) {
      console.error("Erreur calcul TD:", error.message);
      throw error;
    }
  }

  /**
   * KPI 2 : ÉMISSION MOYENNE PAR JOUR (EMJ)
   * Formule : EMJ = C_moy × Q_air × 86400 × 10⁻⁶ (kg/jour)
   * Où :
   *   - C_moy = concentration moyenne (mg/Nm³)
   *   - Q_air = débit volumique (Nm³/s)
   *   - 86400 = secondes par jour
   *   - 10⁻⁶ = conversion mg → kg
   * Objectif : -10% / trimestre
   *
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début période
   * @param {Date} periodEnd - Date fin période
   * @param {Number} qAir - Débit d'air (Nm³/s), optionnel (lu depuis config)
   * @returns {Promise<Object>} { emissionKgDay, avgConcentration, qAir }
   */
  async calculateEMJ(
    polluantId,
    periodStart,
    periodEnd,
    qAir = null,
    nodeIdFilter = null,
  ) {
    try {
      // Récupérer Q_air depuis config si non fourni
      if (!qAir) {
        const config = await siteConfigRepository.getActiveConfig();
        qAir = config ? config.airflow : 2.0; // Défaut 2.0 Nm³/s
      }

      // Calculer concentration moyenne sur la période
      const stats = await readingRepository.aggregateByPolluantPeriod(
        polluantId,
        periodStart,
        periodEnd,
        nodeIdFilter,
      );

      if (!stats || stats.count === 0) {
        return { emissionKgDay: 0, avgConcentration: 0, qAir };
      }

      const cMoy = stats.avgValue; // mg/Nm³

      // EMJ = C_moy × Q_air × 86400 × 10⁻⁶
      const emissionKgDay = cMoy * qAir * 86400 * 1e-6;

      return {
        emissionKgDay: parseFloat(emissionKgDay.toFixed(4)),
        avgConcentration: parseFloat(cMoy.toFixed(2)),
        qAir,
      };
    } catch (error) {
      console.error("Erreur calcul EMJ:", error.message);
      throw error;
    }
  }

  /**
   * KPI 3 : INDICE DE PERFORMANCE ENVIRONNEMENTALE (IPE)
   * Formule : IPE = 100 × Σ(w_p × Score(p)) / P
   * Où :
   *   - w_p = poids réglementaire du polluant p
   *   - Score(p) = 1 si C_moy ≤ VLE, sinon max(0, 1 - (C_moy - VLE) / VLE)
   *   - P = nombre de polluants
   * Objectif : ≥ 95 / mois
   *
   * @param {Date} periodStart - Date début période
   * @param {Date} periodEnd - Date fin période
   * @param {Object} customWeights - Poids personnalisés (optionnel)
   * @param {Array|null} nodeIdFilter - Optional array of nodeIds to scope to a zone
   * @returns {Promise<Object>} { ipe, polluantScores, weights }
   */
  async calculateIPE(periodStart, periodEnd, customWeights = null, nodeIdFilter = null) {
    try {
      const polluants = await polluantRepository.findAll();

      // Récupérer poids depuis config ou utiliser poids personnalisés
      let siteWeights = customWeights;
      if (!siteWeights) {
        const config = await siteConfigRepository.getActiveConfig();
        siteWeights = config ? config.polluantWeights : {};
      }

      // Use defaults for canonical names
      const defaults = {
        NOx: 0.3,
        SO2: 0.25,
        "PM2.5": 0.15,
        PM25: 0.15,
        PM10: 0.10,
        COV: 0.15,
        CO2: 0.05,
      };

      let weightedScore = 0;
      let totalWeight = 0;
      const polluantScores = {};
      const missingLimits = [];

      for (const polluant of polluants) {
        const stats = await readingRepository.aggregateByPolluantPeriod(
          polluant._id,
          periodStart,
          periodEnd,
          nodeIdFilter,
        );

        if (!stats || stats.count === 0) continue;

        // Check for missing regulatory limit
        if (!polluant.regulatoryLimit) {
          missingLimits.push(polluant.name);
          console.warn(
            `[IPE] Skipping ${polluant.name}: missing regulatoryLimit`,
          );
          continue;
        }

        const cMoy = stats.avgValue;
        const vle = polluant.regulatoryLimit;

        const td = await this.calculateTD(
          polluant._id,
          periodStart,
          periodEnd,
          nodeIdFilter,
        );

        // Score : 1 si conforme, pénalité linéaire si dépassement moyen
        let score = cMoy <= vle ? 1 : Math.max(0, 1 - (cMoy - vle) / vle);
        // Pénalité complémentaire sur le taux de dépassement (lectures individuelles)
        const breachFactor = Math.max(0, 1 - (td.tauxDepassement ?? 0) / 100);
        score *= breachFactor;

        const normalized = this.normalizePollutantName(polluant.name);
        const weight = this.resolvePollutantWeight(
          polluant.name,
          siteWeights,
          defaults[normalized],
        );

        weightedScore += weight * score;
        totalWeight += weight;

        polluantScores[polluant.name] = {
          score: parseFloat((score * 100).toFixed(2)),
          avgConcentration: parseFloat(cMoy.toFixed(2)),
          vle,
          weight,
          tauxDepassement: td.tauxDepassement,
        };
      }

      const ipe =
        totalWeight > 0
          ? parseFloat(((weightedScore / totalWeight) * 100).toFixed(2))
          : 100;

      return { ipe, polluantScores, weights: siteWeights, missingLimits };
    } catch (error) {
      console.error("Erreur calcul IPE:", error.message);
      throw error;
    }
  }

  calculateRCO2GoalAttainment(reductionPct, targetReductionPct = -5) {
    const target = Math.abs(Number(targetReductionPct) || 5);
    if (target <= 0) return 100;
    const achievedReduction = -Number(reductionPct);
    if (!Number.isFinite(achievedReduction) || achievedReduction <= 0) return 0;
    return Math.min(
      100,
      parseFloat(((achievedReduction / target) * 100).toFixed(1)),
    );
  }

  /**
   * RCO₂ mensuel : variation EMJ (ou concentration moyenne) vs mois précédent.
   * Objectif typique : ≤ -5 % par rapport au mois M-1.
   */
  async calculateRCO2MonthOverMonth(
    polluantId,
    nodeIdFilter = null,
    referenceDate = new Date(),
  ) {
    const config = await siteConfigRepository.getActiveConfig();
    const goalTargetPct = normalizeRco2TargetValue(
      config?.targets?.reductionCO2,
      -5,
    );

    const currentStart = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      1,
    );
    const currentEnd = new Date(referenceDate);
    currentEnd.setHours(23, 59, 59, 999);

    const prevEnd = new Date(currentStart);
    prevEnd.setMilliseconds(-1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);

    const [currentStats, prevStats, rco2Result] = await Promise.all([
      readingRepository.aggregateByPolluantPeriod(
        polluantId,
        currentStart,
        currentEnd,
        nodeIdFilter,
      ),
      readingRepository.aggregateByPolluantPeriod(
        polluantId,
        prevStart,
        prevEnd,
        nodeIdFilter,
      ),
      this.calculateRCO2(
        polluantId,
        currentStart,
        currentEnd,
        prevStart,
        prevEnd,
        nodeIdFilter,
      ),
    ]);

    const currentAvg = currentStats?.avgValue ?? 0;
    const previousAvg = prevStats?.avgValue ?? 0;
    const goalAttainmentPct = this.calculateRCO2GoalAttainment(
      rco2Result.reductionPct,
      goalTargetPct,
    );

    return {
      reductionPct: rco2Result.reductionPct,
      goalAttainmentPct,
      goalTargetPct,
      currentAvg: parseFloat(Number(currentAvg).toFixed(2)),
      previousAvg: parseFloat(Number(previousAvg).toFixed(2)),
      currentEmission: rco2Result.currentEmission,
      referenceEmission: rco2Result.referenceEmission,
      reductionAbsolute: rco2Result.reductionAbsolute,
      currentPeriodStart: currentStart,
      currentPeriodEnd: currentEnd,
      referencePeriodStart: prevStart,
      referencePeriodEnd: prevEnd,
    };
  }

  /**
   * KPI 4 : RÉDUCTION ESTIMÉE CO2 (RCO2) — variation EMJ vs période précédente
   * Formule : RCO2 = [(EMJ(T) - EMJ(T0)) / EMJ(T0)] × 100
   * Où :
   *   - EMJ(T) = émission période actuelle
   *   - EMJ(T0) = émission période référence
   * Objectif : ≤ -5% / trimestre (réduction)
   *
   * @param {String} polluantId - ID du polluant (généralement CO2)
   * @param {Date} currentPeriodStart - Début période actuelle
   * @param {Date} currentPeriodEnd - Fin période actuelle
   * @param {Date} referencePeriodStart - Début période référence
   * @param {Date} referencePeriodEnd - Fin période référence
   * @param {Array|null} nodeIdFilter - Optional array of nodeIds to scope calculation
   * @returns {Promise<Object>} { reductionPct, currentEmission, referenceEmission, reductionAbsolute }
   */
  async calculateRCO2(
    polluantId,
    currentPeriodStart,
    currentPeriodEnd,
    referencePeriodStart,
    referencePeriodEnd,
    nodeIdFilter = null,
  ) {
    try {
      // Calculer EMJ période actuelle
      const currentEMJ = await this.calculateEMJ(
        polluantId,
        currentPeriodStart,
        currentPeriodEnd,
        null,
        nodeIdFilter,
      );

      // Calculer EMJ période référence
      const referenceEMJ = await this.calculateEMJ(
        polluantId,
        referencePeriodStart,
        referencePeriodEnd,
        null,
        nodeIdFilter,
      );

      if (referenceEMJ.emissionKgDay === 0) {
        return {
          reductionPct: 0,
          currentEmission: currentEMJ.emissionKgDay,
          referenceEmission: 0,
          reductionAbsolute: 0,
        };
      }

      // RCO2 = [(EMJ(T) - EMJ(T0)) / EMJ(T0)] × 100
      const reductionPct =
        ((currentEMJ.emissionKgDay - referenceEMJ.emissionKgDay) /
          referenceEMJ.emissionKgDay) *
        100;

      const reductionAbsolute =
        referenceEMJ.emissionKgDay - currentEMJ.emissionKgDay;

      return {
        reductionPct: parseFloat(reductionPct.toFixed(2)),
        currentEmission: currentEMJ.emissionKgDay,
        referenceEmission: referenceEMJ.emissionKgDay,
        reductionAbsolute: parseFloat(reductionAbsolute.toFixed(4)),
      };
    } catch (error) {
      console.error("Erreur calcul RCO2:", error.message);
      throw error;
    }
  }

  /**
   * Calcule tous les KPIs pour un polluant sur une période
   * @param {String} polluantId - ID du polluant
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Object>} Tous les KPIs
   */
  async calculateAllKPIs(polluantId, periodStart, periodEnd) {
    try {
      const [td, emj] = await Promise.all([
        this.calculateTD(polluantId, periodStart, periodEnd),
        this.calculateEMJ(polluantId, periodStart, periodEnd),
      ]);

      return {
        polluantId,
        periodStart,
        periodEnd,
        td,
        emj,
      };
    } catch (error) {
      console.error("Erreur calcul KPIs:", error.message);
      throw error;
    }
  }

  /**
   * Calcule la qualité des données sur une période
   * @param {Number} sampleCount - Nombre de mesures reçues
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {String} Qualité : EXCELLENT, GOOD, FAIR, POOR
   */
  async calculateDataQuality(
    sampleCount,
    periodStart,
    periodEnd,
    expectedSampleIntervalSeconds = null,
  ) {
    const duration = periodEnd - periodStart; // ms
    const hours = duration / (1000 * 60 * 60);

    let intervalSeconds = Number(expectedSampleIntervalSeconds);
    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
      const config = await siteConfigRepository.getActiveConfig();
      intervalSeconds = config?.getExpectedSampleIntervalSeconds?.() ?? config?.expectedSampleIntervalSeconds ?? 30;
    }

    const samplesPerHour = 3600 / intervalSeconds;
    const expectedCount = Math.floor(hours * samplesPerHour);
    const completeness = sampleCount / expectedCount;

    if (completeness >= 0.95) return "EXCELLENT";
    if (completeness >= 0.85) return "GOOD";
    if (completeness >= 0.7) return "FAIR";
    return "POOR";
  }

  /**
   * Historique journalier IPE recalculé depuis les lectures (formule actuelle + TD).
   */
  async buildLiveDailyIpeHistory(siteId, zoneId = null, limit = 45) {
    let nodeIdFilter = null;
    if (zoneId) {
      nodeIdFilter = await this.getNodeIdsForZone(zoneId);
      if (!nodeIdFilter.length) return [];
    }

    const rows = [];
    const periodEnd = new Date();
    const cursor = new Date(periodEnd);
    cursor.setUTCDate(cursor.getUTCDate() - Math.max(1, limit));
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor <= periodEnd) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(cursor);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const { ipe, polluantScores } = await this.calculateIPE(
        dayStart,
        dayEnd,
        null,
        nodeIdFilter,
      );

      const hasData = Object.keys(polluantScores || {}).length > 0;
      if (hasData) {
        rows.push({
          siteId,
          zoneId: zoneId || null,
          polluantId: null,
          period: "DAILY",
          periodStart: dayStart,
          periodEnd: dayEnd,
          overallScore: ipe,
          dataQuality: "LIVE",
        });
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return rows;
  }

  /**
   * Construit un historique journalier à partir des lectures brutes
   * lorsqu'aucune agrégation DAILY n'est encore disponible.
   */
  async buildLiveDailyHistory(polluantId, siteId, zoneId = null, limit = 45) {
    const polluant = await polluantRepository.findById(polluantId);
    if (!polluant) return [];

    let nodeIdFilter = null;
    if (zoneId) {
      nodeIdFilter = await this.getNodeIdsForZone(zoneId);
      if (!nodeIdFilter.length) return [];
    }

    const config = await siteConfigRepository.getActiveConfig();
    const qAir = config?.airflow ?? 2.0;
    const regulatoryLimit = polluant.regulatoryLimit;

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setUTCDate(periodStart.getUTCDate() - Math.max(1, limit));

    const dailyStats = await readingRepository.aggregateDailyByPolluant(
      polluantId,
      periodStart,
      periodEnd,
      nodeIdFilter,
      regulatoryLimit,
    );

    return dailyStats.map((row) => {
      const dayStart = new Date(`${row.day}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const tauxDepassement =
        row.count > 0 && row.breachCount != null
          ? parseFloat(((row.breachCount / row.count) * 100).toFixed(2))
          : 0;

      const emissionKgDay =
        row.avgValue != null
          ? parseFloat((row.avgValue * qAir * 86400 * 1e-6).toFixed(4))
          : null;

      return {
        polluantId,
        siteId,
        zoneId: zoneId || null,
        period: "DAILY",
        periodStart: dayStart,
        periodEnd: dayEnd,
        minValue: row.minValue,
        maxValue: row.maxValue,
        avgValue: row.avgValue,
        sampleCount: row.count,
        tauxDepassement: parseFloat(tauxDepassement.toFixed(2)),
        emissionKgDay,
        reductionPct: null,
        overallScore: null,
        dataQuality: "LIVE",
      };
    });
  }

  /**
   * Historique mensuel RCO₂ (variation vs mois précédent) à partir des lectures brutes.
   */
  async buildLiveMonthlyRco2History(
    polluantId,
    siteId,
    zoneId = null,
    limit = 12,
  ) {
    const polluant = await polluantRepository.findById(polluantId);
    if (!polluant) return [];

    let nodeIdFilter = null;
    if (zoneId) {
      nodeIdFilter = await this.getNodeIdsForZone(zoneId);
      if (!nodeIdFilter.length) return [];
    }

    const rows = [];
    const now = new Date();

    for (let i = 0; i < limit; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd =
        i === 0
          ? new Date(now)
          : new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      monthEnd.setHours(23, 59, 59, 999);

      const prevEnd = new Date(monthStart);
      prevEnd.setMilliseconds(-1);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);

      const [rco2, stats] = await Promise.all([
        this.calculateRCO2(
          polluantId,
          monthStart,
          monthEnd,
          prevStart,
          prevEnd,
          nodeIdFilter,
        ),
        readingRepository.aggregateByPolluantPeriod(
          polluantId,
          monthStart,
          monthEnd,
          nodeIdFilter,
        ),
      ]);

      if (!stats || stats.count === 0) continue;

      rows.push({
        polluantId,
        siteId,
        zoneId: zoneId || null,
        period: "MONTHLY",
        periodStart: monthStart,
        periodEnd: monthEnd,
        avgValue: stats.avgValue,
        emissionKgDay: rco2.currentEmission,
        reductionPct: rco2.reductionPct,
        dataQuality: "LIVE",
      });
    }

    return rows.reverse();
  }
}

module.exports = new KPIService();
