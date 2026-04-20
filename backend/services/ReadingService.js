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

// Alert debounce window (ms). Within this window, an already-alerted
// sensor+polluant pair will NOT create a new alert at the same severity.
// A new alert is still produced immediately if the severity escalates
// (Warning → High → Critical).
const ALERT_DEBOUNCE_MS =
  Number(process.env.ALERT_DEBOUNCE_MS) || 5 * 60 * 1000; // default 5 min

// Severity rank for escalation detection
const SEVERITY_RANK = { Warning: 1, High: 2, Critical: 3 };

class ReadingService {
  constructor() {
    // In-memory debounce state.
    // Key: `${sensorId}:${polluantId}` — bounded by sensor×polluant combinations.
    // Value: { severity: string, at: number (ms since epoch) }
    this._lastAlertBySensorPolluant = new Map();
  }

  _shouldCreateAlert(sensorId, polluantId, severity) {
    const key = `${sensorId}:${polluantId}`;
    const last = this._lastAlertBySensorPolluant.get(key);
    const now = Date.now();
    if (!last) return true;
    const lastRank = SEVERITY_RANK[last.severity] || 0;
    const newRank = SEVERITY_RANK[severity] || 0;
    // Always alert on severity escalation
    if (newRank > lastRank) return true;
    // Otherwise respect the cooldown
    return now - last.at >= ALERT_DEBOUNCE_MS;
  }

  _rememberAlert(sensorId, polluantId, severity) {
    const key = `${sensorId}:${polluantId}`;
    this._lastAlertBySensorPolluant.set(key, {
      severity,
      at: Date.now(),
    });
  }
  /**
   * Moteur d'alertes interne
   * Détermine la sévérité et crée une alerte si nécessaire
   * @param {Object} reading - Mesure créée
   * @param {Object} polluant - Données du polluant
   * @returns {Promise<Object|null>} Alerte créée ou null
   */
  async checkAndCreateAlert(reading, polluant) {
    try {
      dlog(`\n🔍 [ALERT] Vérification des seuils pour ${polluant.name}`);
      dlog(`   Polluant data:`, {
        name: polluant.name,
        regulatoryLimit: polluant.regulatoryLimit,
        warningThreshold: polluant.warningThreshold,
      });
      dlog(`   Reading data:`, {
        value: reading.value,
        unit: reading.unit,
      });

      const hasRegulatoryLimit =
        typeof polluant.regulatoryLimit === "number" &&
        Number.isFinite(polluant.regulatoryLimit);
      const hasWarningThreshold =
        typeof polluant.warningThreshold === "number" &&
        Number.isFinite(polluant.warningThreshold);

      dlog(
        `   Thresholds exist? regulatory=${hasRegulatoryLimit}, warning=${hasWarningThreshold}`,
      );

      // Les métriques environnementales sans seuils réglementaires (ex: température, humidité)
      // ne doivent pas générer d'alertes de type "Threshold".
      if (!hasRegulatoryLimit || !hasWarningThreshold) {
        dlog(`   ⚠️  No thresholds defined, skipping alert`);
        return null;
      }

      let severity = null;
      const readingValue = reading.value;

      dlog(`   Threshold checks:`);
      dlog(
        `     Critical? ${readingValue} > ${polluant.regulatoryLimit * 1.5} = ${readingValue > polluant.regulatoryLimit * 1.5}`,
      );
      dlog(
        `     High?     ${readingValue} > ${polluant.regulatoryLimit} = ${readingValue > polluant.regulatoryLimit}`,
      );
      dlog(
        `     Warning?  ${readingValue} > ${polluant.warningThreshold} = ${readingValue > polluant.warningThreshold}`,
      );

      if (readingValue > polluant.regulatoryLimit * 1.5) {
        severity = alert_severity.Critical;
      } else if (readingValue > polluant.regulatoryLimit) {
        severity = alert_severity.High;
      } else if (readingValue > polluant.warningThreshold) {
        severity = alert_severity.Warning;
      }

      if (!severity) {
        dlog(`   ✅ No alert needed (value is within acceptable range)`);
        return null;
      }

      // Debounce: suppress repeated alerts for the same (sensor, polluant)
      // at the same or lower severity within the cooldown window.
      const sensorKey = String(reading.sensorId);
      const polluantKey = String(reading.PolluantId);
      if (!this._shouldCreateAlert(sensorKey, polluantKey, severity)) {
        dlog(`   🔕 ALERT SUPPRESSED (debounced): ${severity} ${polluant.name}`);
        return null;
      }

      dlog(`   ⚠️  ALERT TRIGGERED: ${severity}`);

      const exceedancePercentage = (
        ((readingValue - polluant.regulatoryLimit) / polluant.regulatoryLimit) *
        100
      ).toFixed(2);

      const alert = await alertRepository.create({
        PolluantId: reading.PolluantId,
        SensorId: reading.sensorId,
        ReadingId: reading._id,
        severity,
        type: alert_types.Threshold,
        value: reading.value,
        threshold: polluant.regulatoryLimit,
        message: `${polluant.name} dépasse le seuil réglementaire ANPE (NT 106.04) — Dépassement : +${exceedancePercentage}%`,
        timestamp: reading.timestamp,
      });

      this._rememberAlert(sensorKey, polluantKey, severity);

      console.log(
        `Alerte ${severity} créée — ${polluant.name}: ${reading.value} ${polluant.unit}`,
      );
      return alert;
    } catch (error) {
      console.error(
        "Erreur lors de la création de l'alerte automatique:",
        error,
      );
      return null;
    }
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
      throw new Error("Capteur non trouvé");
    }
    if (sensor.isActive === false) {
      throw new Error("Le capteur est inactif");
    }

    // Récupérer les seuils du polluant
    const polluant = await polluantRepository.findById(polluantId);
    if (!polluant) {
      throw new Error("Polluant non trouvé");
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
      throw new Error("Mesure non trouvée");
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
      throw new Error("Mesure non trouvée");
    }

    const polluant = await polluantRepository.findById(reading.PolluantId._id);
    return await this.checkAndCreateAlert(reading, polluant);
  }
}

module.exports = new ReadingService();
