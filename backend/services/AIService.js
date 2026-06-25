/**
 * SERVICE : IA
 * - LSTM 4 h : fenêtre 48 h → prévisions + collection LstmForecast
 * - Isolation Forest : vecteur horaire 6 polluants → anomalies + collection AnomalyDetection
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const aggregateDataRepository = require("../repositories/AggregateDataRepository");
const lstmForecastRepository = require("../repositories/LstmForecastRepository");
const anomalyDetectionRepository = require("../repositories/AnomalyDetectionRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const alertRepository = require("../repositories/AlertRepository");
const sensorRepository = require("../repositories/SensorRepository");
const sensorNodeRepository = require("../repositories/SensorNodeRepository");
const Reading = require("../models/Reading");
const {
  LSTM_FEATURE_ORDER,
  IF_FEATURE_ORDER,
  DB_POLLUTANT_TO_LSTM,
  LSTM_MISSING_DEFAULTS,
  IA_CONFIG,
} = require("../config/ia");
const { alert_types, alert_severity } = require("../utils/constants");

class AIService {
  constructor() {
    this._skillReportCache = null;
    this._pollutantByLstmName = null;
  }

  isEnabled() {
    return IA_CONFIG.enabled;
  }

  _loadSkillReport() {
    if (this._skillReportCache) return this._skillReportCache;
    const p = IA_CONFIG.skillReportPath;
    if (!fs.existsSync(p)) {
      return null;
    }
    try {
      this._skillReportCache = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      this._skillReportCache = null;
    }
    return this._skillReportCache;
  }

  async checkHealth() {
    if (!this.isEnabled()) {
      return { status: "disabled", enabled: false };
    }
    try {
      const { data } = await axios.get(`${IA_CONFIG.serviceUrl}/health`, {
        timeout: 5000,
      });
      return { enabled: true, ...data };
    } catch (err) {
      return {
        enabled: true,
        status: "unreachable",
        error: err.message,
      };
    }
  }

  async _resolveZoneContext(zoneId) {
    const Zone = require("../models/Zone");
    const zone = await Zone.findById(zoneId).select("siteId nom code").lean();
    if (!zone) {
      throw new Error(`Zone introuvable: ${zoneId}`);
    }
    const siteId = zone.siteId?.toString() || null;
    if (!siteId) {
      throw new Error(`Site manquant pour la zone ${zoneId}`);
    }
    return {
      zone,
      zoneId: zone._id.toString(),
      siteId,
      zoneName: zone.nom || zone.code || zoneId,
    };
  }

  async _assertZoneHasSensorNodes(zoneId) {
    const nodeIds = await sensorNodeRepository.findNodeIdsByZone(zoneId);
    if (!nodeIds?.length) {
      throw new Error(
        "Cette zone n'a aucun nœud capteur associé. Choisissez une zone équipée " +
          "(ex. « Zone Fours de Calcination ») ou assignez des capteurs à cette zone dans la configuration.",
      );
    }
    return nodeIds;
  }

  _hourKey(date) {
    const d = new Date(date);
    d.setUTCMinutes(0, 0, 0);
    return d.toISOString();
  }

  /**
   * Compte les heures distinctes avec lectures valides dans [anchor - lookback, anchor).
   */
  async _countReadingHoursInWindow(nodeIds, anchorEnd, lookbackHours) {
    const anchor = new Date(anchorEnd);
    const start = new Date(anchor);
    start.setHours(start.getHours() - lookbackHours);

    const rows = await Reading.aggregate([
      {
        $match: {
          nodeId: { $in: nodeIds },
          isValid: true,
          timestamp: { $gte: start, $lt: anchor },
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: { date: "$timestamp", unit: "hour", timezone: "UTC" },
          },
        },
      },
      { $count: "hours" },
    ]);

    return rows[0]?.hours ?? 0;
  }

  /**
   * Cherche l'ancrage le plus récent (≤ now) où la fenêtre lookback contient assez d'heures de mesures.
   * Utile quand le simulateur vient d'être relancé après une coupure.
   */
  async _findBestAnchorEnd(zoneId, lookbackHours, minFilled) {
    const nodeIds = await this._assertZoneHasSensorNodes(zoneId);
    const searchHours = parseInt(process.env.IA_ANCHOR_SEARCH_HOURS || "336", 10);
    const now = new Date();
    now.setMinutes(0, 0, 0);

    for (let offset = 0; offset <= searchHours; offset++) {
      const anchor = new Date(now);
      anchor.setHours(anchor.getHours() - offset);
      const filled = await this._countReadingHoursInWindow(
        nodeIds,
        anchor,
        lookbackHours,
      );
      if (filled >= minFilled) {
        return { anchor, filledHours: filled, offsetHours: offset };
      }
    }
    return null;
  }

  _minFilledHours(lookbackHours) {
    return (
      parseInt(process.env.IA_MIN_FILLED_HOURS || "", 10) ||
      Math.floor(lookbackHours * 0.9)
    );
  }

  /**
   * Exécute les prévisions pour toutes les zones actives (après agrégation HOURLY).
   * @param {Date} [anchorEnd] — fin de la dernière heure agrégée (défaut : heure courante tronquée)
   */
  async runForecastsForAllZones(anchorEnd = null) {
    if (!this.isEnabled()) {
      return { skipped: true, reason: "IA_ENABLED=false" };
    }

    const health = await this.checkHealth();
    if (health.status === "unreachable" || health.status === "disabled") {
      console.warn(`⚠️ [IA] Service indisponible: ${health.error || health.status}`);
      return { skipped: true, reason: "ia_unreachable", health };
    }

    if (!health.lstm?.loaded) {
      console.warn("⚠️ [IA] LSTM non chargé — prévisions ignorées");
      return { skipped: true, reason: "lstm_not_loaded", health };
    }

    if (!health.lstm?.go_deploy) {
      console.warn("⚠️ [IA] go_deploy=false — prévisions non exécutées");
      return { skipped: true, reason: "go_deploy_false", health };
    }

    const zoneRepository = require("../repositories/ZoneRepository");
    const siteRepository = require("../repositories/SiteRepository");
    const sites = await siteRepository.findAll();
    const results = [];

    for (const site of sites) {
      const zones = await zoneRepository.findBySite(site._id.toString());
      for (const zone of zones) {
        const zoneId = zone._id.toString();
        try {
          const doc = await this.runForecastForZone(zoneId, anchorEnd);
          results.push({
            siteId: site._id.toString(),
            zoneId,
            zoneName: zone.nom || zone.code,
            ok: Boolean(doc),
          });
        } catch (err) {
          console.error(
            `  ⚠️ [IA] Zone ${zone.nom || zoneId}: ${err.message}`,
          );
          results.push({
            siteId: site._id.toString(),
            zoneId,
            zoneName: zone.nom || zone.code,
            ok: false,
            error: err.message,
          });
        }
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    console.log(`✓ [IA] Prévisions 4 h: ${okCount}/${results.length} zones`);
    return { skipped: false, results, health };
  }

  /**
   * Recalcule les agrégats HOURLY pour une zone (plus ciblé que tout le site).
   */
  async syncHourlyAggregatesForZone(zoneId, siteId, anchorEnd = null, hoursBack = 48) {
    const aggregationService = require("./AggregationService");
    const end = anchorEnd ? new Date(anchorEnd) : new Date();
    end.setMinutes(0, 0, 0);

    let total = 0;
    for (let i = hoursBack; i >= 1; i--) {
      const periodStart = new Date(end);
      periodStart.setUTCHours(periodStart.getUTCHours() - i);
      const periodEnd = new Date(periodStart);
      periodEnd.setUTCHours(periodEnd.getUTCHours() + 1);

      try {
        const results = await aggregationService.aggregateAllPolluantsForZone(
          "HOURLY",
          periodStart,
          periodEnd,
          zoneId,
          siteId,
        );
        total += results?.length ?? 0;
      } catch (err) {
        console.warn(
          `[IA] Agrégation zone ${zoneId} ${periodStart.toISOString()}: ${err.message}`,
        );
      }
    }
    console.log(
      `[IA] Sync HOURLY zone ${zoneId}: ${total} agrégats sur ${hoursBack} h`,
    );
    return total;
  }

  /**
   * Recalcule les agrégats HOURLY à partir des lectures (simulateur MQTT).
   * L'IA lit AggregateData, pas les readings brutes — sans cette étape IF/LSTM voient 0 polluant.
   */
  async syncHourlyAggregatesForSite(siteId, anchorEnd = null, hoursBack = 48) {
    const aggregationService = require("./AggregationService");
    const end = anchorEnd ? new Date(anchorEnd) : new Date();
    end.setMinutes(0, 0, 0);

    let total = 0;
    for (let i = hoursBack; i >= 1; i--) {
      const periodStart = new Date(end);
      periodStart.setUTCHours(periodStart.getUTCHours() - i);
      const periodEnd = new Date(periodStart);
      periodEnd.setUTCHours(periodEnd.getUTCHours() + 1);

      try {
        const results = await aggregationService.aggregateAllPolluants(
          "HOURLY",
          periodStart,
          periodEnd,
          siteId,
        );
        total += results?.length ?? 0;
      } catch (err) {
        console.warn(
          `[IA] Agrégation ${periodStart.toISOString()}: ${err.message}`,
        );
      }
    }
    console.log(
      `[IA] Sync HOURLY site ${siteId}: ${total} agrégats sur ${hoursBack} h`,
    );
    return total;
  }

  /**
   * @param {String} zoneId
   * @param {Date} [anchorEnd]
   */
  async runForecastForZone(zoneId, anchorEnd = null) {
    const { siteId } = await this._resolveZoneContext(zoneId);
    await this._assertZoneHasSensorNodes(zoneId);
    const lookback = IA_CONFIG.lookbackHours;
    let end = anchorEnd ? new Date(anchorEnd) : new Date();
    end.setMinutes(0, 0, 0);

    const minFilled = this._minFilledHours(lookback);

    await this.syncHourlyAggregatesForZone(zoneId, siteId, end, lookback);

    let { matrix, timestamps, anchorPeriodStart, coverage } =
      await this.buildLookbackMatrix(zoneId, end, lookback);

    if (coverage.filledHours < minFilled) {
      const fallback = await this._findBestAnchorEnd(
        zoneId,
        lookback,
        minFilled,
      );
      if (fallback) {
        end = fallback.anchor;
        console.warn(
          `[IA] Fenêtre récente insuffisante (${coverage.filledHours}/${lookback} h) — ` +
            `ancrage historique ${end.toISOString()} (${fallback.filledHours} h de mesures, offset -${fallback.offsetHours} h)`,
        );
        await this.syncHourlyAggregatesForZone(zoneId, siteId, end, lookback);
        ({ matrix, timestamps, anchorPeriodStart, coverage } =
          await this.buildLookbackMatrix(zoneId, end, lookback));
      }
    }

    if (coverage.filledHours < minFilled) {
      throw new Error(
        `Données insuffisantes pour LSTM (${coverage.filledHours}/${lookback} h agrégées, min ${minFilled}). ` +
          `Lancez le simulateur (cd backend && npm run simulate) et attendez ${minFilled} h, ` +
          `ou définissez IA_MIN_FILLED_HOURS=4 dans backend/.env pour les tests courts.`,
      );
    }

    const iaResponse = await this.callPredict(matrix, timestamps);
    return this.persistForecast(siteId, zoneId, anchorPeriodStart, iaResponse);
  }

  /**
   * Agrégats HOURLY d'une zone → buckets par heure (clé ISO).
   */
  async _loadHourlyBuckets(zoneId, anchorEnd, lookbackHours) {
    const periodEnd = new Date(anchorEnd);
    const periodStart = new Date(periodEnd);
    periodStart.setUTCHours(periodStart.getUTCHours() - lookbackHours);

    const rows = await aggregateDataRepository.findHourlyByZone(
      zoneId,
      periodStart,
      periodEnd,
    );

    const hourBuckets = new Map();
    for (const row of rows) {
      const pName = row.polluantId?.name;
      if (!pName) continue;
      const lstmKey = DB_POLLUTANT_TO_LSTM[pName];
      if (!lstmKey) continue;

      const hourKey = this._hourKey(row.periodStart);
      if (!hourBuckets.has(hourKey)) {
        hourBuckets.set(hourKey, {});
      }
      const bucket = hourBuckets.get(hourKey);
      if (!bucket[lstmKey]) {
        bucket[lstmKey] = { sum: 0, count: 0 };
      }
      bucket[lstmKey].sum += row.avgValue;
      bucket[lstmKey].count += 1;
    }

    const hourKeys = [];
    for (let i = lookbackHours; i >= 1; i--) {
      const t = new Date(periodEnd);
      t.setUTCHours(t.getUTCHours() - i);
      hourKeys.push(this._hourKey(t));
    }

    return { hourBuckets, hourKeys, periodEnd };
  }

  _vectorFromBucket(bucket, lastVector = null) {
    return LSTM_FEATURE_ORDER.map((lstmName) => {
      if (bucket[lstmName]?.count > 0) {
        return bucket[lstmName].sum / bucket[lstmName].count;
      }
      if (lstmName === "PM10" && bucket.PM25?.count > 0) {
        return (bucket.PM25.sum / bucket.PM25.count) * 1.2;
      }
      if (LSTM_MISSING_DEFAULTS[lstmName] != null) {
        return LSTM_MISSING_DEFAULTS[lstmName];
      }
      if (lastVector) {
        return lastVector[LSTM_FEATURE_ORDER.indexOf(lstmName)];
      }
      return 0;
    });
  }

  /**
   * Série HOURLY d'une zone → matrice 48×8 pour le LSTM.
   */
  async buildLookbackMatrix(zoneId, anchorEnd, lookbackHours) {
    const { hourBuckets, hourKeys } = await this._loadHourlyBuckets(
      zoneId,
      anchorEnd,
      lookbackHours,
    );

    const matrix = [];
    const timestamps = [];
    let filledHours = 0;
    let lastVector = null;

    for (const hourKey of hourKeys) {
      const bucket = hourBuckets.get(hourKey) || {};
      const vector = this._vectorFromBucket(bucket, lastVector);

      const hasData = LSTM_FEATURE_ORDER.some(
        (n) => bucket[n]?.count > 0 || (n === "PM10" && bucket.PM25?.count > 0),
      );
      if (hasData) filledHours += 1;

      matrix.push(vector);
      timestamps.push(hourKey);
      lastVector = vector;
    }

    const anchorPeriodStart = new Date(hourKeys[hourKeys.length - 1]);

    return {
      matrix,
      timestamps,
      anchorPeriodStart,
      coverage: {
        filledHours,
        lookbackHours,
        complete: filledHours >= Math.floor(lookbackHours * 0.9),
      },
    };
  }

  _countIfFilledFeatures(bucket) {
    let filled = 0;
    for (const name of IF_FEATURE_ORDER) {
      const has =
        bucket[name]?.count > 0 ||
        (name === "PM10" && bucket.PM25?.count > 0);
      if (has) filled += 1;
    }
    return filled;
  }

  /**
   * Dernier créneau horaire avec assez de polluants → vecteur IF (6 features).
   * Parcourt les {ifLookbackHours} dernières heures (pas seulement l'heure courante).
   */
  async buildIfFeatureVector(zoneId, anchorEnd) {
    const lookback = IA_CONFIG.ifLookbackHours;
    const { hourBuckets, hourKeys } = await this._loadHourlyBuckets(
      zoneId,
      anchorEnd,
      lookback,
    );

    let hourKey = null;
    let bucket = {};
    let filled = 0;

    for (let i = hourKeys.length - 1; i >= 0; i--) {
      const candidate = hourBuckets.get(hourKeys[i]) || {};
      const candidateFilled = this._countIfFilledFeatures(candidate);
      if (candidateFilled >= IA_CONFIG.ifMinFeatures) {
        hourKey = hourKeys[i];
        bucket = candidate;
        filled = candidateFilled;
        break;
      }
    }

    if (!hourKey) {
      let lastPartialKey = null;
      let lastPartialFilled = 0;
      for (let i = hourKeys.length - 1; i >= 0; i--) {
        const candidate = hourBuckets.get(hourKeys[i]) || {};
        const n = this._countIfFilledFeatures(candidate);
        if (n > 0) {
          lastPartialKey = hourKeys[i];
          lastPartialFilled = n;
          break;
        }
      }

      const staleHint = lastPartialKey
        ? ` Dernier créneau partiel: ${lastPartialKey} (${lastPartialFilled}/${IA_CONFIG.ifMinFeatures} polluants).`
        : " Aucun agrégat HOURLY sur cette fenêtre.";

      throw new Error(
        `IF: trop peu de polluants (0/${IA_CONFIG.ifMinFeatures} min) sur les ${lookback} dernières heures.${staleHint} ` +
          `Lancez le simulateur (cd backend && npm run simulate), attendez 1–2 min, puis réessayez « Lancer IA ».`,
      );
    }

    const lstmVector = this._vectorFromBucket(bucket);
    const lstmByName = Object.fromEntries(
      LSTM_FEATURE_ORDER.map((n, i) => [n, lstmVector[i]]),
    );

    const values = [];
    for (const name of IF_FEATURE_ORDER) {
      values.push(lstmByName[name] ?? 0);
    }

    const targetHourKey = hourKeys[hourKeys.length - 1];
    const usedStaleHour = hourKey !== targetHourKey;

    return {
      featureCols: IF_FEATURE_ORDER,
      featureValues: values,
      periodStart: new Date(hourKey),
      filledFeatures: filled,
      complete: true,
      usedStaleHour,
      anchorHourKey: targetHourKey,
    };
  }

  async callDetect(featureValues, featureCols) {
    const { data } = await axios.post(
      `${IA_CONFIG.serviceUrl}/detect`,
      { feature_values: featureValues, feature_cols: featureCols },
      { timeout: IA_CONFIG.requestTimeoutMs },
    );
    return data;
  }

  async runAnomalyDetectionForAllZones(anchorEnd = null) {
    if (!this.isEnabled() || !IA_CONFIG.ifEnabled) {
      return { skipped: true, reason: "if_disabled" };
    }

    const health = await this.checkHealth();
    if (health.status === "unreachable") {
      return { skipped: true, reason: "ia_unreachable", health };
    }
    if (!health.isolation_forest?.loaded) {
      console.warn("⚠️ [IA] Isolation Forest non chargé — détection ignorée");
      return { skipped: true, reason: "if_not_loaded", health };
    }

    const zoneRepository = require("../repositories/ZoneRepository");
    const siteRepository = require("../repositories/SiteRepository");
    const sites = await siteRepository.findAll();
    const results = [];

    for (const site of sites) {
      const zones = await zoneRepository.findBySite(site._id.toString());
      for (const zone of zones) {
        const zoneId = zone._id.toString();
        try {
          const doc = await this.runAnomalyDetectionForZone(zoneId, anchorEnd);
          results.push({
            siteId: site._id.toString(),
            zoneId,
            zoneName: zone.nom || zone.code,
            ok: Boolean(doc),
            isAnomaly: doc?.isAnomaly,
          });
        } catch (err) {
          console.error(`  ⚠️ [IA-IF] Zone ${zone.nom || zoneId}: ${err.message}`);
          results.push({
            siteId: site._id.toString(),
            zoneId,
            zoneName: zone.nom || zone.code,
            ok: false,
            error: err.message,
          });
        }
      }
    }

    const anomalies = results.filter((r) => r.isAnomaly).length;
    console.log(
      `✓ [IA-IF] Détection anomalies: ${anomalies} zone(s) signalée(s) / ${results.length}`,
    );
    return { skipped: false, results, health };
  }

  async runAnomalyDetectionForZone(zoneId, anchorEnd = null) {
    const { siteId } = await this._resolveZoneContext(zoneId);
    await this._assertZoneHasSensorNodes(zoneId);
    const end = anchorEnd ? new Date(anchorEnd) : new Date();
    end.setMinutes(0, 0, 0);

    await this.syncHourlyAggregatesForZone(
      zoneId,
      siteId,
      end,
      IA_CONFIG.ifSyncHours,
    );

    const { featureValues, featureCols, periodStart, usedStaleHour, anchorHourKey } =
      await this.buildIfFeatureVector(zoneId, end);

    if (usedStaleHour) {
      console.warn(
        `[IA-IF] Zone ${zoneId}: créneau ${periodStart.toISOString()} ` +
          `(pas de données pour ${anchorHourKey})`,
      );
    }

    const iaResponse = await this.callDetect(featureValues, featureCols);
    return this.persistAnomalyDetection(
      siteId,
      zoneId,
      periodStart,
      iaResponse,
    );
  }

  async persistAnomalyDetection(siteId, zoneId, periodStart, iaResponse) {
    const existing = await anomalyDetectionRepository.findByZoneAndPeriod(
      zoneId,
      periodStart,
    );
    if (existing) {
      return existing;
    }

    let alertId = null;
    if (iaResponse.is_anomaly && IA_CONFIG.createAnomalyAlerts) {
      alertId = await this._createAnomalyAlert(
        siteId,
        zoneId,
        periodStart,
        iaResponse,
      );
    }

    return anomalyDetectionRepository.create({
      siteId,
      zoneId,
      periodStart,
      isAnomaly: Boolean(iaResponse.is_anomaly),
      anomalyScore: iaResponse.anomaly_score,
      prediction: iaResponse.prediction,
      scoreThreshold: iaResponse.score_threshold,
      severity: iaResponse.severity || null,
      featureCols: iaResponse.feature_cols,
      featureValues: iaResponse.feature_values,
      alertSource: iaResponse.alert_source || "ISOLATION_FOREST",
      alertId,
    });
  }

  async _createAnomalyAlert(siteId, zoneId, periodStart, iaResponse) {
    const pollutantMap = await this._ensurePollutantMap();
    const primary = pollutantMap.CO2 || pollutantMap.NOX || Object.values(pollutantMap)[0];
    if (!primary) return null;

    const ctx = await this._resolveAlertContext(zoneId, primary._id);
    if (!ctx) return null;

    const score = iaResponse.anomaly_score;
    const severity =
      iaResponse.severity ||
      alert_severity.Warning;

    const message = `[Anomalie IF] Profil multivarié atypique sur la période horaire — score ${score.toFixed(3)} (seuil ${iaResponse.score_threshold})`;

    const alert = await alertRepository.create({
      PolluantId: primary._id,
      SensorId: ctx.sensorId,
      ReadingId: ctx.readingId,
      severity,
      type: alert_types.Anomaly,
      value: score,
      threshold: iaResponse.score_threshold,
      message,
      timestamp: periodStart,
      isAcknowledged: false,
    });

    return alert._id;
  }

  async getAnomalyHistory(zoneId, limit = 20) {
    return anomalyDetectionRepository.findLatestByZone(zoneId, limit);
  }

  async callPredict(lookbackValues, timestampsUtc) {
    const { data } = await axios.post(
      `${IA_CONFIG.serviceUrl}/predict`,
      {
        horizon_hours: IA_CONFIG.horizonHours,
        lookback_values: lookbackValues,
        timestamps_utc: timestampsUtc,
      },
      { timeout: IA_CONFIG.requestTimeoutMs },
    );
    return data;
  }

  async _ensurePollutantMap() {
    if (this._pollutantByLstmName) return this._pollutantByLstmName;
    const all = await polluantRepository.findAll();
    const map = {};
    for (const p of all) {
      const lstm = DB_POLLUTANT_TO_LSTM[p.name];
      if (lstm) map[lstm] = p;
      if (p.name === "SO2") map.SOX = p;
    }
    this._pollutantByLstmName = map;
    return map;
  }

  async persistForecast(siteId, zoneId, anchorPeriodStart, iaResponse) {
    const pollutantMap = await this._ensurePollutantMap();
    const anchor = new Date(anchorPeriodStart);

    const steps = (iaResponse.forecasts || []).map((step, idx) => {
      const stepHours = idx + 1;
      const targetTime = new Date(anchor);
      targetTime.setHours(targetTime.getHours() + stepHours);

      const pollutants = LSTM_FEATURE_ORDER.map((name) => {
        const raw = step.pollutants?.[name] || {};
        const polluant = pollutantMap[name];
        const valuePhysical = raw.value_physical ?? raw.value_normalized ?? 0;
        const limit = polluant?.regulatoryLimit ?? null;
        let exceedsRegulatory = false;
        let severity = null;

        if (limit != null && valuePhysical > limit) {
          exceedsRegulatory = true;
          const ratio = valuePhysical / limit;
          if (ratio >= 1.2) severity = alert_severity.Critical;
          else if (ratio >= 1.05) severity = alert_severity.High;
          else severity = alert_severity.Warning;
        }

        return {
          name,
          valuePhysical,
          valueNormalized: raw.value_normalized ?? 0,
          predictionSource: raw.prediction_source || "PERSISTENCE",
          skillAtTrain: raw.skill_at_train ?? 0,
          unit: polluant?.unit ?? null,
          regulatoryLimit: limit,
          exceedsRegulatory,
          severity,
        };
      });

      return {
        stepHours,
        stepLabel: step.step || `+${stepHours}h`,
        targetTime,
        pollutants,
      };
    });

    const doc = await lstmForecastRepository.create({
      siteId,
      zoneId,
      anchorPeriodStart: anchor,
      goDeploy: Boolean(iaResponse.go_deploy),
      alertSource: iaResponse.alert_source || "LSTM_4H",
      horizonHours: iaResponse.horizon_hours || IA_CONFIG.horizonHours,
      lookbackHours: iaResponse.lookback_hours || IA_CONFIG.lookbackHours,
      steps,
      iaHealth: { go_deploy: iaResponse.go_deploy },
    });

    if (IA_CONFIG.createForecastAlerts) {
      await this._createForecastAlerts(zoneId, steps, pollutantMap);
    }

    return doc;
  }

  async _createForecastAlerts(zoneId, steps, pollutantMap) {
    for (const step of steps) {
      for (const p of step.pollutants) {
        if (!p.exceedsRegulatory || !p.severity) continue;

        const polluant = pollutantMap[p.name];
        if (!polluant) continue;

        const ctx = await this._resolveAlertContext(zoneId, polluant._id);
        if (!ctx) continue;

        const message = `[Prévision +${step.stepHours}h] ${p.name} — ${p.valuePhysical.toFixed(2)} ${p.unit || ""} (seuil ${p.regulatoryLimit}) — source ${p.predictionSource}`;

        await alertRepository.create({
          PolluantId: polluant._id,
          SensorId: ctx.sensorId,
          ReadingId: ctx.readingId,
          severity: p.severity,
          type: alert_types.Forecast,
          value: p.valuePhysical,
          threshold: p.regulatoryLimit,
          message,
          timestamp: step.targetTime,
          isAcknowledged: false,
        });
      }
    }
  }

  async _resolveAlertContext(zoneId, polluantId) {
    const sensors = await sensorRepository.findAll({});
    const siteNodes = await sensorNodeRepository.findAll({});
    const nodeIdsForZone = new Set(
      siteNodes
        .filter((n) => n.zoneId?.toString() === zoneId)
        .map((n) => n._id.toString()),
    );

    const sensor = sensors.find(
      (s) =>
        s.PolluantId?.toString() === polluantId.toString() &&
        nodeIdsForZone.has(s.sensorNodeId?.toString()),
    );
    if (!sensor) return null;

    const reading = await Reading.findOne({
      sensorId: sensor._id,
      PolluantId: polluantId,
      isValid: true,
    })
      .sort({ timestamp: -1 })
      .select("_id")
      .lean();

    if (!reading) return null;

    return { sensorId: sensor._id, readingId: reading._id };
  }

  async getLatestForecast(zoneId) {
    const rows = await lstmForecastRepository.findLatestByZone(zoneId, 1);
    return rows[0] || null;
  }

  getSkillSummary() {
    const report = this._loadSkillReport();
    if (!report) return null;
    return {
      acceptance: report.acceptance ?? null,
      global_skill: report.global?.skill ?? report.global_skill ?? null,
      per_pollutant_skill: report.per_pollutant_skill ?? {},
    };
  }
}

module.exports = new AIService();
