const fs = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");

const AggregateData = require("../models/AggregateData");
const IADatasetSnapshot = require("../models/IADatasetSnapshot");
const IARetrainJob = require("../models/IARetrainJob");
const { LSTM_FEATURE_ORDER, DB_POLLUTANT_TO_LSTM } = require("../config/ia");

class IARetrainService {
  constructor() {
    this.iaRoot = path.join(__dirname, "../../ia");
    this.modelsDir = path.join(this.iaRoot, "models");
    this.dataDir = path.join(this.iaRoot, "data");
    this.trainingDatasetsDir = path.join(this.dataDir, "training_datasets");
    this.jobsDir = path.join(this.iaRoot, "jobs");
  }

  _utcHourKey(date) {
    const d = new Date(date);
    d.setUTCMinutes(0, 0, 0);
    return d.toISOString();
  }

  _formatTimestampForFile(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mm = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  _csvEscape(value) {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  _datasetHeader() {
    return ["timestamp_utc", "site_id", "zone_id", ...LSTM_FEATURE_ORDER];
  }

  _manifestPathForCsv(csvPath) {
    return csvPath.replace(/\.csv$/i, ".manifest.json");
  }

  _artifactPaths() {
    return {
      model: path.join(this.modelsDir, "model_lstm_4h.h5"),
      scalers: path.join(this.modelsDir, "lstm_scalers.pkl"),
      skill: path.join(this.modelsDir, "lstm_4h_skill_report.json"),
      metrics: path.join(this.modelsDir, "lstm_4h_metrics.json"),
    };
  }

  async _ensureDirs() {
    await fs.mkdir(this.trainingDatasetsDir, { recursive: true });
    await fs.mkdir(this.jobsDir, { recursive: true });
  }

  async _readJsonSafe(filePath) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async prepareDataset({
    periodStart,
    periodEnd,
    siteId = null,
    zoneId = null,
    createdBy = null,
  }) {
    if (!periodStart || !periodEnd) {
      throw new Error("periodStart et periodEnd sont requis");
    }
    if (!siteId && !zoneId) {
      throw new Error("siteId ou zoneId est requis pour préparer un dataset");
    }

    await this._ensureDirs();

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Dates invalides");
    }
    if (start >= end) {
      throw new Error("periodStart doit être avant periodEnd");
    }

    const filter = {
      period: "HOURLY",
      sensorNodeId: null,
      polluantId: { $ne: null },
      periodStart: { $gte: start, $lte: end },
    };
    if (zoneId) filter.zoneId = zoneId;
    if (siteId) filter.siteId = siteId;

    const rows = await AggregateData.find(filter)
      .populate("polluantId", "name")
      .sort({ periodStart: 1 })
      .lean();

    const hourlyMap = new Map();
    for (const row of rows) {
      const polluantName = row.polluantId?.name;
      const lstmName = DB_POLLUTANT_TO_LSTM[polluantName];
      if (!lstmName || !LSTM_FEATURE_ORDER.includes(lstmName)) continue;

      const key = `${this._utcHourKey(row.periodStart)}|${row.siteId?.toString() || ""}|${row.zoneId?.toString() || ""}`;
      if (!hourlyMap.has(key)) {
        const base = {
          timestamp_utc: this._utcHourKey(row.periodStart),
          site_id: row.siteId?.toString() || "",
          zone_id: row.zoneId?.toString() || "",
        };
        for (const feature of LSTM_FEATURE_ORDER) base[feature] = null;
        hourlyMap.set(key, base);
      }

      hourlyMap.get(key)[lstmName] = Number(row.avgValue);
    }

    const datasetRows = Array.from(hourlyMap.values()).sort((a, b) =>
      a.timestamp_utc.localeCompare(b.timestamp_utc),
    );

    const totalCells = datasetRows.length * LSTM_FEATURE_ORDER.length;
    let missingCells = 0;
    for (const row of datasetRows) {
      for (const feature of LSTM_FEATURE_ORDER) {
        if (!Number.isFinite(row[feature])) missingCells += 1;
      }
    }
    const missingRatio = totalCells > 0 ? missingCells / totalCells : 1;

    const minRows = parseInt(process.env.IA_RETRAIN_MIN_ROWS || "240", 10);
    const maxMissingRatio = parseFloat(process.env.IA_RETRAIN_MAX_MISSING_RATIO || "0.35");
    const reasons = [];
    if (datasetRows.length < minRows) {
      reasons.push(`rows=${datasetRows.length} < minRows=${minRows}`);
    }
    if (missingRatio > maxMissingRatio) {
      reasons.push(
        `missingRatio=${missingRatio.toFixed(3)} > maxMissingRatio=${maxMissingRatio}`,
      );
    }

    const stamp = this._formatTimestampForFile();
    const datasetCsvPath = path.join(this.trainingDatasetsDir, `train_${stamp}.csv`);
    const manifestJsonPath = this._manifestPathForCsv(datasetCsvPath);

    const header = this._datasetHeader();
    const lines = [header.join(",")];
    for (const row of datasetRows) {
      const values = header.map((col) => {
        const v = row[col];
        if (v === null || v === undefined || Number.isNaN(v)) return "";
        return this._csvEscape(v);
      });
      lines.push(values.join(","));
    }
    await fs.writeFile(datasetCsvPath, lines.join("\n"), "utf8");

    const manifest = {
      created_at: new Date().toISOString(),
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      scope: { site_id: siteId, zone_id: zoneId },
      row_count: datasetRows.length,
      feature_columns: LSTM_FEATURE_ORDER,
      missing_ratio: missingRatio,
      min_rows: minRows,
      max_missing_ratio: maxMissingRatio,
      valid_for_training: reasons.length === 0,
      quality_reasons: reasons,
      dataset_csv_path: datasetCsvPath,
    };
    await fs.writeFile(manifestJsonPath, JSON.stringify(manifest, null, 2), "utf8");

    const snapshot = await IADatasetSnapshot.create({
      createdBy,
      status: reasons.length ? "invalid" : "ready",
      scope: { siteId, zoneId },
      periodStart: start,
      periodEnd: end,
      rowCount: datasetRows.length,
      featureColumns: LSTM_FEATURE_ORDER,
      missingRatio,
      paths: { datasetCsv: datasetCsvPath, manifestJson: manifestJsonPath },
      quality: {
        minRows,
        maxMissingRatio,
        validForTraining: reasons.length === 0,
        reasons,
      },
    });

    return { snapshot, manifest };
  }

  async getLatestDataset(scope = {}) {
    const filter = {};
    if (scope.zoneId) filter["scope.zoneId"] = scope.zoneId;
    if (scope.siteId) filter["scope.siteId"] = scope.siteId;
    return IADatasetSnapshot.findOne(filter).sort({ createdAt: -1 }).lean();
  }

  async getLatestJob() {
    return IARetrainJob.findOne().sort({ createdAt: -1 }).populate("datasetId").lean();
  }

  async getJobById(jobId) {
    return IARetrainJob.findById(jobId).populate("datasetId").lean();
  }

  async startRetrain({ datasetId, createdBy = null }) {
    const snapshot = datasetId
      ? await IADatasetSnapshot.findById(datasetId)
      : await IADatasetSnapshot.findOne().sort({ createdAt: -1 });

    if (!snapshot) {
      throw new Error("Aucun dataset préparé. Lancez d'abord la préparation dataset.");
    }
    if (!snapshot.quality?.validForTraining) {
      throw new Error(
        `Dataset invalide pour entraînement: ${(snapshot.quality?.reasons || []).join("; ")}`,
      );
    }

    await this._ensureDirs();

    const logFile = path.join(this.jobsDir, `retrain_${this._formatTimestampForFile()}.log`);
    const job = await IARetrainJob.create({
      createdBy,
      status: "queued",
      progressPct: 0,
      stage: "queued",
      datasetId: snapshot._id,
      paths: { logFile },
      logsTail: ["Job créé et mis en file d'attente."],
    });

    this._runJob(job._id.toString()).catch(async (err) => {
      await IARetrainJob.findByIdAndUpdate(job._id, {
        status: "failed",
        progressPct: 100,
        stage: "failed",
        errorMessage: err.message,
      });
    });

    return job;
  }

  async _appendLog(jobId, message) {
    const job = await IARetrainJob.findById(jobId);
    if (!job) return;
    const line = `[${new Date().toISOString()}] ${message}`;
    const tail = [...(job.logsTail || []), line].slice(-200);
    job.logsTail = tail;
    await job.save();
    if (job.paths?.logFile) {
      await fs.appendFile(job.paths.logFile, `${line}\n`, "utf8").catch(() => {});
    }
  }

  async _copyIfExists(src, dst) {
    try {
      await fs.copyFile(src, dst);
      return true;
    } catch {
      return false;
    }
  }

  async _runJob(jobId) {
    const job = await IARetrainJob.findById(jobId).populate("datasetId");
    if (!job) return;
    const snapshot = job.datasetId;

    const artifacts = this._artifactPaths();
    const beforeSkill = await this._readJsonSafe(artifacts.skill);
    const previousGlobalSkill = Number(beforeSkill?.global?.skill ?? beforeSkill?.global_skill ?? 0);

    const backupDir = path.join(this.jobsDir, `backup_${jobId}`);
    await fs.mkdir(backupDir, { recursive: true });
    await this._copyIfExists(artifacts.model, path.join(backupDir, "model_lstm_4h.h5"));
    await this._copyIfExists(artifacts.scalers, path.join(backupDir, "lstm_scalers.pkl"));
    await this._copyIfExists(artifacts.skill, path.join(backupDir, "lstm_4h_skill_report.json"));
    await this._copyIfExists(artifacts.metrics, path.join(backupDir, "lstm_4h_metrics.json"));

    await IARetrainJob.findByIdAndUpdate(jobId, {
      status: "running",
      stage: "copy_dataset",
      progressPct: 8,
      "process.startedAt": new Date(),
      "paths.backupDir": backupDir,
      "metrics.previousGlobalSkill": previousGlobalSkill,
    });
    await this._appendLog(jobId, `Dataset source: ${snapshot.paths.datasetCsv}`);

    const trainingDatasetPath = path.join(this.dataDir, "training_dataset.csv");
    await fs.copyFile(snapshot.paths.datasetCsv, trainingDatasetPath);
    await this._appendLog(jobId, `Dataset copié vers ${trainingDatasetPath}`);

    await IARetrainJob.findByIdAndUpdate(jobId, {
      stage: "training",
      progressPct: 20,
    });

    const scriptPath = path.join("scripts", "retrain_lstm.py");
    const proc = spawn("python", [scriptPath], {
      cwd: this.iaRoot,
      env: process.env,
      detached: false,
    });

    await IARetrainJob.findByIdAndUpdate(jobId, {
      "process.pid": proc.pid,
    });

    proc.stdout.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (!text) return;
      this._appendLog(jobId, text).catch(() => {});
    });
    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (!text) return;
      this._appendLog(jobId, `[stderr] ${text}`).catch(() => {});
    });

    const exitCode = await new Promise((resolve) => {
      proc.on("close", (code) => resolve(code ?? 1));
    });

    await IARetrainJob.findByIdAndUpdate(jobId, {
      "process.exitCode": exitCode,
      "process.finishedAt": new Date(),
    });

    if (exitCode !== 0) {
      await IARetrainJob.findByIdAndUpdate(jobId, {
        status: "failed",
        stage: "failed",
        progressPct: 100,
        errorMessage: `retrain_lstm.py a quitté avec code ${exitCode}`,
      });
      await this._appendLog(jobId, `Échec entraînement (exit=${exitCode}).`);
      return;
    }

    const afterSkill = await this._readJsonSafe(artifacts.skill);
    const newGlobalSkill = Number(afterSkill?.global?.skill ?? afterSkill?.global_skill ?? 0);
    const skillDelta = newGlobalSkill - previousGlobalSkill;
    const deploySuggested = skillDelta >= 0;

    if (!deploySuggested) {
      await this._appendLog(
        jobId,
        `Régression détectée (delta=${skillDelta.toFixed(4)}). Restauration backup.`,
      );
      await this._copyIfExists(path.join(backupDir, "model_lstm_4h.h5"), artifacts.model);
      await this._copyIfExists(path.join(backupDir, "lstm_scalers.pkl"), artifacts.scalers);
      await this._copyIfExists(path.join(backupDir, "lstm_4h_skill_report.json"), artifacts.skill);
      await this._copyIfExists(path.join(backupDir, "lstm_4h_metrics.json"), artifacts.metrics);

      await IARetrainJob.findByIdAndUpdate(jobId, {
        status: "rolled_back",
        stage: "rollback_done",
        progressPct: 100,
        metrics: {
          previousGlobalSkill,
          newGlobalSkill,
          skillDelta,
          deploySuggested: false,
          rollbackApplied: true,
        },
        errorMessage:
          "Nouveau modèle plus faible que la baseline précédente. Artefacts restaurés automatiquement.",
      });
      return;
    }

    await IARetrainJob.findByIdAndUpdate(jobId, {
      status: "success",
      stage: "completed",
      progressPct: 100,
      metrics: {
        previousGlobalSkill,
        newGlobalSkill,
        skillDelta,
        deploySuggested: true,
        rollbackApplied: false,
      },
    });
    await this._appendLog(jobId, `Succès entraînement. skill delta=${skillDelta.toFixed(4)}.`);
  }
}

module.exports = new IARetrainService();
