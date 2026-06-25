/**
 * REPOSITORY : SITE_CONFIG
 * Gère les opérations DB pour la configuration du site
 */

const SiteConfig = require("../models/SiteConfig");

const WEIGHT_KEY_TO_BACKEND = {
  NOX: "NOx",
  "PM2.5": "PM25",
};

const WEIGHT_KEY_TO_FRONTEND = {
  NOx: "NOX",
};

function configNotFoundError() {
  const err = new Error(
    "Configuration active non trouvée. Exécutez: npm run init:kpi",
  );
  err.statusCode = 404;
  return err;
}

function normalizeWeightKeysForStorage(weights) {
  const normalized = {};
  for (const [name, weight] of Object.entries(weights || {})) {
    const key = WEIGHT_KEY_TO_BACKEND[name] ?? name.replace(".", "");
    normalized[key] = Number(weight);
  }
  return normalized;
}

function normalizeTargetsForStorage(targets) {
  const next = {};
  const src = targets || {};

  if (src.TD !== undefined && src.TD !== null) {
    next.tauxDepassement = Number(src.TD);
  } else if (src.tauxDepassement !== undefined && src.tauxDepassement !== null) {
    next.tauxDepassement = Number(src.tauxDepassement);
  }

  if (src.IPE !== undefined && src.IPE !== null) {
    next.ipe = Number(src.IPE);
  } else if (src.ipe !== undefined && src.ipe !== null) {
    next.ipe = Number(src.ipe);
  }

  if (src.RCO2 !== undefined && src.RCO2 !== null) {
    next.reductionCO2 = Number(src.RCO2);
  } else if (src.reductionCO2 !== undefined && src.reductionCO2 !== null) {
    next.reductionCO2 = Number(src.reductionCO2);
  }

  if (src.EMJ !== undefined) {
    next.EMJ = src.EMJ === null || src.EMJ === "" ? null : Number(src.EMJ);
  }

  return next;
}

class SiteConfigRepository {
  async getActiveConfig() {
    return await SiteConfig.findOne({ isActive: true });
  }

  async create(data) {
    return await SiteConfig.create(data);
  }

  async update(id, data) {
    return await SiteConfig.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    });
  }

  async updateAirflow(airflow, userId) {
    const config = await this.getActiveConfig();
    if (!config) throw configNotFoundError();

    const value = Number(airflow);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      const err = new Error("airflow doit être entre 0.1 et 100 Nm³/s");
      err.statusCode = 400;
      throw err;
    }

    config.airflow = value;
    config.lastModifiedBy = userId;
    return await config.save();
  }

  async updateBaselineCo2(baselineCo2, userId) {
    const config = await this.getActiveConfig();
    if (!config) throw configNotFoundError();

    const value = Number(baselineCo2);
    if (!Number.isFinite(value) || value < 0) {
      const err = new Error("baselineCo2 doit être ≥ 0");
      err.statusCode = 400;
      throw err;
    }

    config.baselineCo2 = value;
    config.lastModifiedBy = userId;
    return await config.save();
  }

  async updateSampleInterval(seconds, userId) {
    const config = await this.getActiveConfig();
    if (!config) throw configNotFoundError();

    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 1 || value > 3600) {
      const err = new Error(
        "expectedSampleIntervalSeconds doit être entre 1 et 3600",
      );
      err.statusCode = 400;
      throw err;
    }

    config.expectedSampleIntervalSeconds = value;
    config.lastModifiedBy = userId;
    return await config.save();
  }

  async updatePolluantWeights(weights, userId) {
    const config = await this.getActiveConfig();
    if (!config) throw configNotFoundError();

    const normalizedWeights = normalizeWeightKeysForStorage(weights);

    const totalWeight = Object.values(normalizedWeights).reduce(
      (sum, w) => sum + w,
      0,
    );
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      const err = new Error(
        `La somme des poids doit être 1.0 (actuel: ${totalWeight.toFixed(2)})`,
      );
      err.statusCode = 400;
      throw err;
    }

    config.polluantWeights = normalizedWeights;
    config.lastModifiedBy = userId;
    return await config.save();
  }

  async updateTargets(targets, userId) {
    const config = await this.getActiveConfig();
    if (!config) throw configNotFoundError();

    const normalized = normalizeTargetsForStorage(targets);
    config.targets = {
      ...(config.targets?.toObject?.() ?? config.targets ?? {}),
      ...normalized,
    };
    config.lastModifiedBy = userId;
    return await config.save();
  }

  async findAll() {
    return await SiteConfig.find().sort({ createdAt: -1 });
  }

  async findById(id) {
    return await SiteConfig.findById(id);
  }

  mapWeightsForApi(polluantWeights) {
    const raw = polluantWeights?.toObject?.() ?? polluantWeights ?? {};
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
      const frontKey = WEIGHT_KEY_TO_FRONTEND[key] ?? key;
      out[frontKey] = value;
    }
    return out;
  }

  mapTargetsForApi(targets) {
    const t = targets?.toObject?.() ?? targets ?? {};
    return {
      TD: t.tauxDepassement ?? 2,
      IPE: t.ipe ?? 95,
      RCO2: t.reductionCO2 ?? -5,
      EMJ: t.EMJ ?? null,
      tauxDepassement: t.tauxDepassement ?? 2,
      ipe: t.ipe ?? 95,
      reductionCO2: t.reductionCO2 ?? -5,
    };
  }
}

module.exports = new SiteConfigRepository();
