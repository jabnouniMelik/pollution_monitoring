/**
 * SERVICE : READING
 * Logique métier pour les mesures de capteurs
 * Inclut le moteur d'alertes automatique
 */

const readingRepository = require("../repositories/ReadingRepository");
const sensorRepository = require("../repositories/SensorRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const alertRepository = require("../repositories/AlertRepository");
const Alert = require("../models/Alert");
const { alert_severity, alert_types } = require("../utils/constants");

// Verbose per-reading logs are only enabled when DEBUG_INGEST=true.
const DEBUG_INGEST = process.env.DEBUG_INGEST === "true";
const dlog = DEBUG_INGEST ? console.log.bind(console) : () => {};

// ============================================================
// ALERT ENGINE CONFIGURATION
// ============================================================
// UPDATE_WINDOW_MS: minimum interval between refreshing an active
// alert's value/timestamp while the breach continues.
// Default 30 s. Set via ALERT_UPDATE_WINDOW_MS env var.
const UPDATE_WINDOW_MS =
  Number(process.env.ALERT_UPDATE_WINDOW_MS) || 30 * 1000;

// Severity rank for escalation detection
const SEVERITY_RANK = { Warning: 1, High: 2, Critical: 3 };

class ReadingService {
  constructor() {
    // In-memory cache of the current open alert per (sensorId:polluantId).
    // Key  : `${sensorId}:${polluantId}`  — both lowercase ObjectId strings
    // Value: { alertId, severity, lastUpdatedAt (ms) }
    //
    // The cache is the primary deduplication guard. It is populated:
    //   a) at startup via _warmUpCache (awaited before first ingest)
    //   b) whenever a new alert is created or an existing one is updated
    //   c) whenever an alert is auto-resolved (entry deleted)
    this._activeAlerts = new Map();

    // Promise that resolves once the warm-up DB query completes.
    // ingestReading awaits this before processing the first reading so
    // the cache is never empty on the first tick after a restart.
    this._warmUpPromise = this._warmUpCache();
  }

  async _warmUpCache() {
    try {
      // "Open" means not yet resolved — regardless of acknowledgement status.
      // An acknowledged-but-unresolved alert must still suppress duplicates.
      const openAlerts = await Alert.find({ resolvedAt: null })
        .select("_id SensorId PolluantId severity timestamp")
        .lean();

      for (const a of openAlerts) {
        // Both sides of the key must use the same field casing.
        // Alert model stores SensorId (capital S) and PolluantId (capital P).
        // We normalise to lowercase strings here so the key always matches
        // what ingestReading builds from the reading document.
        const key = `${String(a.SensorId)}:${String(a.PolluantId)}`;
        this._activeAlerts.set(key, {
          alertId: a._id,
          severity: a.severity,
          lastUpdatedAt: new Date(a.timestamp).getTime(),
        });
      }
      console.log(`[AlertEngine] Cache warmed: ${openAlerts.length} open alert(s) loaded`);
    } catch (e) {
      // Non-fatal — cache starts empty, duplicates may appear until next restart
      console.warn("[AlertEngine] Cache warm-up failed:", e.message);
    }
  }

  // ── Alert engine ────────────────────────────────────────────
  /**
   * Core deduplication logic:
   *   - value within limits  → auto-resolve any open alert, remove from cache
   *   - value breaches limit → no cached alert  → create new alert, add to cache
   *                          → cached alert, same/lower severity, window active → skip
   *                          → cached alert, same/lower severity, window expired → update in place
   *                          → cached alert, higher severity (escalation) → update immediately
   *
   * The cache key is `${sensorId}:${polluantId}` using the lowercase ObjectId
   * strings from the Reading document — matching exactly what _warmUpCache stores.
   */
  async checkAndCreateAlert(reading, polluant) {
    try {
      const hasRegulatoryLimit =
        typeof polluant.regulatoryLimit === "number" &&
        Number.isFinite(polluant.regulatoryLimit);
      const hasWarningThreshold =
        typeof polluant.warningThreshold === "number" &&
        Number.isFinite(polluant.warningThreshold);

      if (!hasRegulatoryLimit || !hasWarningThreshold) return null;

      const readingValue = reading.value;

      // Cache key: lowercase sensorId + polluantId strings.
      // reading.sensorId  comes from the create() call in ingestReading (lowercase field).
      // reading.PolluantId comes from the schema (capital P) — normalise here.
      const sensorKey = `${String(reading.sensorId)}:${String(reading.PolluantId)}`;
      const now = Date.now();

      // Determine current severity
      let severity = null;
      if (readingValue > polluant.regulatoryLimit * 1.5) {
        severity = alert_severity.Critical;
      } else if (readingValue > polluant.regulatoryLimit) {
        severity = alert_severity.High;
      } else if (readingValue > polluant.warningThreshold) {
        severity = alert_severity.Warning;
      }

      const cached = this._activeAlerts.get(sensorKey);

      // ── Case 1: Value back within limits ──────────────────
      if (!severity) {
        if (cached) {
          await alertRepository.autoResolve(
            cached.alertId,
            "Valeur revenue dans les limites réglementaires",
          );
          this._activeAlerts.delete(sensorKey);
          dlog(`   ✅ Alert auto-resolved — ${polluant.name}: ${readingValue}`);
        }
        return null;
      }

      // ── Case 2: No cached open alert ──────────────────────
      // Before creating, do a DB check to guard against cache misses
      // (e.g. first reading after a crash before warm-up completed).
      if (!cached) {
        const existingOpen = await Alert.findOne({
          SensorId: reading.sensorId,
          PolluantId: reading.PolluantId,
          resolvedAt: null,
        }).select("_id severity timestamp").lean();

        if (existingOpen) {
          // Cache was stale — repopulate and fall through to Case 3
          this._activeAlerts.set(sensorKey, {
            alertId: existingOpen._id,
            severity: existingOpen.severity,
            lastUpdatedAt: new Date(existingOpen.timestamp).getTime(),
          });
          // Fall through to Case 3 below
        } else {
          // Genuinely no open alert — create one
          const alert = await this._createAlert(reading, polluant, severity);
          this._activeAlerts.set(sensorKey, {
            alertId: alert._id,
            severity,
            lastUpdatedAt: now,
          });
          console.log(`🚨 Alerte ${severity} créée — ${polluant.name}: ${readingValue} ${polluant.unit}`);
          return alert;
        }
      }

      // ── Case 3: Open alert exists in cache ────────────────
      const current = this._activeAlerts.get(sensorKey);
      const cachedRank = SEVERITY_RANK[current.severity] || 0;
      const newRank = SEVERITY_RANK[severity] || 0;
      const windowExpired = now - current.lastUpdatedAt >= UPDATE_WINDOW_MS;
      const escalated = newRank > cachedRank;

      if (!escalated && !windowExpired) {
        dlog(`   🔕 Skipped (${Math.round((now - current.lastUpdatedAt) / 1000)}s < ${UPDATE_WINDOW_MS / 1000}s window)`);
        return null;
      }

      // Update the existing alert in place — no new document created
      const { message } = this._buildMessage(readingValue, polluant, severity);
      const updated = await alertRepository.updateActive(current.alertId, {
        severity,
        value: readingValue,
        ReadingId: reading._id,
        message,
        timestamp: reading.timestamp,
      });

      this._activeAlerts.set(sensorKey, {
        alertId: current.alertId,
        severity,
        lastUpdatedAt: now,
      });

      if (escalated) {
        console.log(`⬆️  Alerte escaladée ${current.severity}→${severity} — ${polluant.name}: ${readingValue}`);
      } else {
        dlog(`   🔄 Alert updated — ${polluant.name}: ${readingValue}`);
      }

      return updated;
    } catch (error) {
      console.error("Erreur moteur alertes:", error.message);
      return null;
    }
  }

  async _createAlert(reading, polluant, severity) {
    const { message } = this._buildMessage(reading.value, polluant, severity);

    return await alertRepository.create({
      PolluantId: reading.PolluantId,
      SensorId: reading.sensorId,
      ReadingId: reading._id,
      severity,
      type: alert_types.Threshold,
      value: reading.value,
      threshold: polluant.regulatoryLimit,
      message,
      timestamp: reading.timestamp,
      isAcknowledged: false,
    });
  }

  _buildMessage(value, polluant, severity) {
    const limit = polluant.regulatoryLimit;
    const diff = value - limit;
    const pct = ((diff / limit) * 100).toFixed(2);
    const sign = diff >= 0 ? "+" : "";

    if (severity === alert_severity.Warning) {
      return {
        message: `${polluant.name} approche le seuil réglementaire ANPE (Décret 2018-928) — Risque de dépassement : ${sign}${pct}%`,
        exceedance: pct,
      };
    }
    return {
      message: `${polluant.name} dépasse le seuil réglementaire ANPE (Décret 2018-928) — Dépassement : ${sign}${pct}%`,
      exceedance: pct,
    };
  }

  /**
   * Ingère une nouvelle mesure de capteur
   * Appel principal: ESP32 → MQTT → /ingest
   */
  async ingestReading(data) {
    // Await warm-up so the cache is never empty on the first reading
    await this._warmUpPromise;

    const { sensorId, polluantId, nodeId, value, unit, rawValue, timestamp } = data;

    dlog(`\n📥 [READING] Ingesting:`, { sensorId, polluantId, value, unit });

    const sensor = await sensorRepository.findById(sensorId);
    if (!sensor) {
      const err = new Error("Capteur non trouvé");
      err.statusCode = 404;
      throw err;
    }
    if (sensor.isActive === false) {
      const err = new Error("Le capteur est inactif");
      err.statusCode = 400;
      throw err;
    }

    const polluant = await polluantRepository.findById(polluantId);
    if (!polluant) {
      const err = new Error("Polluant non trouvé");
      err.statusCode = 404;
      throw err;
    }

    dlog(`   Polluant:`, {
      name: polluant.name,
      regulatoryLimit: polluant.regulatoryLimit,
      warningThreshold: polluant.warningThreshold,
    });

    // Reject values that are clearly sensor faults (> 10× the regulatory limit)
    const validityMax = polluant.regulatoryLimit
      ? polluant.regulatoryLimit * 10
      : 10000;
    const isValid = value >= 0 && value <= validityMax;

    const reading = await readingRepository.create({
      sensorId,
      PolluantId: polluantId,
      nodeId: nodeId || sensor.sensorNodeId,
      value,
      unit,
      rawValue: rawValue || value,
      isValid,
      timestamp: timestamp || new Date(),
    });

    let alert = null;
    if (isValid) {
      alert = await this.checkAndCreateAlert(reading, polluant);
    }

    return {
      reading,
      alert: alert
        ? { id: alert._id, severity: alert.severity, type: alert.type, message: alert.message }
        : null,
    };
  }

  async getAllReadings(filters = {}, limit = 100) {
    return await readingRepository.findAll(filters, limit);
  }

  async getReadingById(id) {
    const reading = await readingRepository.findById(id);
    if (!reading) {
      const err = new Error("Mesure non trouvée");
      err.statusCode = 404;
      throw err;
    }
    return reading;
  }

  async getLatestReadings(nodeId = null) {
    const filter = nodeId ? { nodeId } : {};
    return await readingRepository.getLatestByAllSensors(filter);
  }

  async getInvalidReadingsCount(periodStart, periodEnd) {
    return await readingRepository.countInvalid(periodStart, periodEnd);
  }

  async reEvaluateReading(readingId) {
    const reading = await readingRepository.findById(readingId);
    if (!reading) {
      const err = new Error("Mesure non trouvée");
      err.statusCode = 404;
      throw err;
    }
    const polluant = await polluantRepository.findById(reading.PolluantId._id);
    return await this.checkAndCreateAlert(reading, polluant);
  }
}

module.exports = new ReadingService();
