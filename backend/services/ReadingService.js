/**
 * SERVICE : READING
 * Logique métier pour les mesures de capteurs
 * Inclut le moteur d'alertes automatique
 */

const readingRepository = require("../repositories/ReadingRepository");
const sensorRepository = require("../repositories/SensorRepository");
const polluantRepository = require("../repositories/PolluantRepository");
const alertRepository = require("../repositories/AlertRepository");
const { alert_severity, alert_types } = require("../utils/constants");

// Verbose per-reading logs are only enabled when DEBUG_INGEST=true.
// In production / default dev they are silenced to avoid stdout back-pressure
// and memory growth from high-rate MQTT ingestion.
const DEBUG_INGEST = process.env.DEBUG_INGEST === "true";
const dlog = DEBUG_INGEST ? console.log.bind(console) : () => {};

// ============================================================
// ALERT ENGINE CONFIGURATION
// ============================================================
// UPDATE_WINDOW_MS: how often an active alert's value/timestamp
// is refreshed while the breach continues. Default 30 seconds.
// Set via ALERT_UPDATE_WINDOW_MS env var.
const UPDATE_WINDOW_MS =
  Number(process.env.ALERT_UPDATE_WINDOW_MS) || 30 * 1000; // 30 s

// Severity rank for escalation detection
const SEVERITY_RANK = { Warning: 1, High: 2, Critical: 3 };

class ReadingService {
  constructor() {
    // In-memory cache of the current open alert per (sensorId:polluantId).
    // Key: `${sensorId}:${polluantId}`
    // Value: { alertId, severity, lastUpdatedAt (ms) }
    // This avoids a DB lookup on every reading.
    this._activeAlerts = new Map();
    // Warm up cache from DB on startup (async, non-blocking)
    this._warmUpCache();
  }

  async _warmUpCache() {
    try {
      const Alert = require("../models/Alert");
      // Load all open (non-resolved, non-acknowledged) alerts
      const openAlerts = await Alert.find({
        isAcknowledged: false,
        resolvedAt: null,
      }).select("_id SensorId PolluantId severity timestamp").lean();

      for (const a of openAlerts) {
        const key = `${String(a.SensorId)}:${String(a.PolluantId)}`;
        this._activeAlerts.set(key, {
          alertId: a._id,
          severity: a.severity,
          lastUpdatedAt: new Date(a.timestamp).getTime(),
        });
      }
      dlog(`[AlertEngine] Cache warmed: ${openAlerts.length} open alerts loaded`);
    } catch (e) {
      // Non-fatal — cache starts empty, will rebuild from readings
      console.warn("[AlertEngine] Cache warm-up failed:", e.message);
    }
  }

  // ── Alert engine ────────────────────────────────────────────
  /**
   * Core alert logic:
   *   - If value is within limits → auto-resolve any open alert
   *   - If value exceeds threshold:
   *       • No open alert → create one
   *       • Open alert, same/lower severity, within update window → skip
   *       • Open alert, same/lower severity, window expired → update value/timestamp
   *       • Open alert, higher severity → update severity + value immediately
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
          // Auto-resolve: value dropped below threshold — mark as resolved
          // but do NOT set isAcknowledged (operator may not have seen it yet)
          await alertRepository.autoResolve(
            cached.alertId,
            "Valeur revenue dans les limites réglementaires"
          );
          this._activeAlerts.delete(sensorKey);
          dlog(`   ✅ Alert auto-resolved — ${polluant.name}: ${readingValue}`);
        }
        return null;
      }

      // ── Case 2: No open alert → create one ────────────────
      if (!cached) {
        const alert = await this._createAlert(reading, polluant, severity);
        this._activeAlerts.set(sensorKey, {
          alertId: alert._id,
          severity,
          lastUpdatedAt: now,
        });
        console.log(`🚨 Alerte ${severity} créée — ${polluant.name}: ${readingValue} ${polluant.unit}`);
        return alert;
      }

      // ── Case 3: Open alert exists ─────────────────────────
      const cachedRank = SEVERITY_RANK[cached.severity] || 0;
      const newRank = SEVERITY_RANK[severity] || 0;
      const windowExpired = now - cached.lastUpdatedAt >= UPDATE_WINDOW_MS;
      const escalated = newRank > cachedRank;

      if (!escalated && !windowExpired) {
        // Still within update window, same severity → skip
        dlog(`   🔕 Alert update skipped (window: ${Math.round((now - cached.lastUpdatedAt) / 1000)}s < ${UPDATE_WINDOW_MS / 1000}s)`);
        return null;
      }

      // Update the existing alert in place
      const { message } = this._buildMessage(readingValue, polluant, severity);

      const updated = await alertRepository.updateActive(cached.alertId, {
        severity,
        value: readingValue,
        ReadingId: reading._id,
        message,
        timestamp: reading.timestamp,
      });

      this._activeAlerts.set(sensorKey, {
        alertId: cached.alertId,
        severity,
        lastUpdatedAt: now,
      });

      if (escalated) {
        console.log(`⬆️  Alerte escaladée ${cached.severity}→${severity} — ${polluant.name}: ${readingValue}`);
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
    const { message, exceedance } = this._buildMessage(reading.value, polluant, severity);

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

  /**
   * Build a human-readable alert message with the correct sign and context.
   *
   * Warning  (value > warningThreshold but ≤ regulatoryLimit):
   *   "NOX approche le seuil réglementaire — Risque de dépassement : -12.50%"
   *   (negative % = still X% below the limit)
   *
   * High / Critical (value > regulatoryLimit):
   *   "NOX dépasse le seuil réglementaire ANPE (NT 106.04) — Dépassement : +18.30%"
   *   (positive % = X% above the limit)
   */
  _buildMessage(value, polluant, severity) {
    const limit = polluant.regulatoryLimit;
    const diff = value - limit;
    const pct = ((diff / limit) * 100).toFixed(2);
    const sign = diff >= 0 ? "+" : "";   // negative numbers already carry "-"

    if (severity === alert_severity.Warning) {
      // Value is between warningThreshold and regulatoryLimit → approaching
      return {
        message: `${polluant.name} approche le seuil réglementaire ANPE (NT 106.04) — Risque de dépassement : ${sign}${pct}%`,
        exceedance: pct,
      };
    }

    // High or Critical → already exceeded
    return {
      message: `${polluant.name} dépasse le seuil réglementaire ANPE (NT 106.04) — Dépassement : ${sign}${pct}%`,
      exceedance: pct,
    };
  }

  /**
   * Ingère une nouvelle mesure de capteur
   * Appel principal: ESP32 → MQTT → /ingest
   * @param {Object} data - Données mesure
   * @returns {Promise<Object>} Mesure créée + alerte optionnelle
   */
  async ingestReading(data) {
    const { sensorId, polluantId, nodeId, value, unit, rawValue, timestamp } =
      data;

    dlog(`\n📥 [READING] Ingesting reading:`, {
      sensorId,
      polluantId,
      value,
      unit,
    });

    // Vérifier que le capteur existe et est actif
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

    // Récupérer les seuils du polluant
    const polluant = await polluantRepository.findById(polluantId);
    if (!polluant) {
      const err = new Error("Polluant non trouvé");
      err.statusCode = 404;
      throw err;
    }

    dlog(`   Fetched polluant:`, {
      _id: polluant._id,
      name: polluant.name,
      regulatoryLimit: polluant.regulatoryLimit,
      warningThreshold: polluant.warningThreshold,
    });

    // Valider la mesure - marquer comme invalide si aberrante
    const isValid = value >= 0 && value <= 1000;

    // Créer la mesure
    const reading = await readingRepository.create({
      sensorId,
      PolluantId: polluantId, // Use capital P to match schema
      nodeId: nodeId || sensor.sensorNodeId,
      value,
      unit,
      rawValue: rawValue || value,
      isValid,
      timestamp: timestamp || new Date(),
    });

    // Déclencher le moteur d'alertes
    let alert = null;
    if (isValid) {
      alert = await this.checkAndCreateAlert(reading, polluant);
    }

    return {
      reading,
      alert: alert
        ? {
            id: alert._id,
            severity: alert.severity,
            type: alert.type,
            message: alert.message,
          }
        : null,
    };
  }

  /**
   * Récupère l'historique des mesures avec filtres
   * @param {Object} filters - Filtres (sensorId, polluantId, nodeId, isValid, date range)
   * @param {Number} limit - Max résultats
   * @returns {Promise<Array>} Mesures
   */
  async getAllReadings(filters = {}, limit = 100) {
    return await readingRepository.findAll(filters, limit);
  }

  /**
   * Récupère une mesure par ID
   * @param {String} id - ID mesure
   * @returns {Promise<Object>} Mesure
   */
  async getReadingById(id) {
    const reading = await readingRepository.findById(id);
    if (!reading) {
      const err = new Error("Mesure non trouvée");
      err.statusCode = 404;
      throw err;
    }
    return reading;
  }

  /**
   * Récupère la dernière mesure de chaque capteur
   * Utilisé par le Dashboard pour données temps réel
   * @param {String} nodeId - ID nœud optionnel
   * @returns {Promise<Array>} Dernières mesures par capteur
   */
  async getLatestReadings(nodeId = null) {
    const filter = nodeId ? { nodeId } : {};
    return await readingRepository.getLatestByAllSensors(filter);
  }

  /**
   * Récupère les statistiques de mesures invalides
   * @param {Date} periodStart - Date début
   * @param {Date} periodEnd - Date fin
   * @returns {Promise<Number>} Nombre de mesures invalides
   */
  async getInvalidReadingsCount(periodStart, periodEnd) {
    return await readingRepository.countInvalid(periodStart, periodEnd);
  }

  /**
   * Ré-évalue les alertes si elles n'ont pas été créées correctement
   * Fonction utilitaire pour maintenance
   * @param {String} readingId - ID mesure
   * @returns {Promise<Object|null>} Alerte créée ou null
   */
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
