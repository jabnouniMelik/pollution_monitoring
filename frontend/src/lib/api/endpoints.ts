/**
 * Centralized API paths aligned with `backend/routes/*.js` and `backend/server.js`.
 * If you add a route on the server, add it here and document it in `docs/API_CONTRACT.md`.
 */

export const endpoints = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    register: '/api/auth/register',
  },

  users: {
    base: '/api/users',
    byId: (id: string) => `/api/users/${id}`,
    /** GET — SUPER_ADMIN */
    byRole: (role: string) => `/api/users/role/${role}`,
    /** PUT — SUPER_ADMIN */
    role: (id: string) => `/api/users/${id}/role`,
    /** POST assign sites — SUPER_ADMIN */
    assignSites: (id: string) => `/api/users/${id}/sites`,
    /** POST assign zones — SUPER_ADMIN | SITE_SUPERVISOR */
    assignZones: (id: string) => `/api/users/${id}/zones`,
  },

  sites: {
    base: '/api/sites',
    byId: (id: string) => `/api/sites/${id}`,
    pending: '/api/sites/pending',
    myRequests: '/api/sites/my-requests',
    approve: (id: string) => `/api/sites/${id}/approve`,
    reject: (id: string) => `/api/sites/${id}/reject`,
    prepare: (id: string) => `/api/sites/${id}/prepare`,
    /** PUT — SUPER_ADMIN */
    supervisor: (id: string) => `/api/sites/${id}/supervisor`,
    byIndustry: (industrieId: string) => `/api/sites/industrie/${industrieId}`,
    zonesCount: (id: string) => `/api/sites/${id}/zones-count`,
  },

  zones: {
    base: '/api/zones',
    byId: (id: string) => `/api/zones/${id}`,
    pending: '/api/zones/pending',
    approve: (id: string) => `/api/zones/${id}/approve`,
    reject: (id: string) => `/api/zones/${id}/reject`,
    prepare: (id: string) => `/api/zones/${id}/prepare`,
    bySite: (siteId: string) => `/api/zones/site/${siteId}`,
    /** POST assign operators */
    assignOperators: (id: string) => `/api/zones/${id}/operators`,
    removeOperator: (zoneId: string, operatorId: string) =>
      `/api/zones/${zoneId}/operators/${operatorId}`,
    sensorsCount: (id: string) => `/api/zones/${id}/sensors-count`,
  },

  readings: {
    base: '/api/readings',
    latest: '/api/readings/latest',
    history: '/api/readings/history',   // aggregated time-series for charts
    ingest: '/api/readings/ingest',
    byId: (id: string) => `/api/readings/${id}`,
  },

  alerts: {
    base: '/api/alerts',
    stats: '/api/alerts/stats',
    byId: (id: string) => `/api/alerts/${id}`,
    acknowledge: (id: string) => `/api/alerts/${id}/acknowledge`,
    escalate: (id: string) => `/api/alerts/${id}/escalate`,
    resolve: (id: string) => `/api/alerts/${id}/resolve`,
  },

  kpi: {
    td: (polluantId: string) => `/api/kpi/td/${polluantId}`,
    emj: (polluantId: string) => `/api/kpi/emj/${polluantId}`,
    ipe: '/api/kpi/ipe',
    rco2: (polluantId: string) => `/api/kpi/rco2/${polluantId}`,
    summary: '/api/kpi/summary',
    history: (polluantId: string) => `/api/kpi/history/${polluantId}`,
    config: '/api/kpi/config',
    configAirflow: '/api/kpi/config/airflow',
    configBaseline: '/api/kpi/config/baseline',
    configSampleInterval: '/api/kpi/config/sample-interval',
    configWeights: '/api/kpi/config/weights',
    configTargets: '/api/kpi/config/targets',
    aggregate: '/api/kpi/aggregate',
  },

  /**
   * `thresholdConfigManagementRoutes.js` — no `GET /site/:siteId` (use active config only).
   */
  thresholds: {
    base: '/api/thresholds',
    all: '/api/thresholds/all',
    pollutant: (pollutantName: string) => `/api/thresholds/pollutant/${pollutantName}`,
    complianceReport: '/api/thresholds/report',
    byId: (id: string) => `/api/thresholds/${id}`,
    pollutantLimits: (id: string, pollutantName: string) =>
      `/api/thresholds/${id}/pollutant/${pollutantName}`,
    offsets: (id: string) => `/api/thresholds/${id}/offsets`,
    allPollutants: (id: string) => `/api/thresholds/${id}/all-pollutants`,
    clone: (id: string) => `/api/thresholds/${id}/clone`,
    reset: (id: string) => `/api/thresholds/${id}/reset`,
  },

  /** `siteConfigManagementRoutes.js` — parallel to parts of `/api/kpi/config` */
  siteConfig: {
    base: '/api/site-config',
    targets: '/api/site-config/targets',
    weights: '/api/site-config/weights',
    airflow: '/api/site-config/airflow',
    updateAirflow: (id: string) => `/api/site-config/${id}/airflow`,
    updateWeights: (id: string) => `/api/site-config/${id}/weights`,
    updateTargets: (id: string) => `/api/site-config/${id}/targets`,
    updateComplete: (id: string) => `/api/site-config/${id}`,
  },

  industries: {
    base: '/api/industries',
    byId: (id: string) => `/api/industries/${id}`,
    register: '/api/industries/register',
    pending: '/api/industries/pending',
    prepare: (id: string) => `/api/industries/${id}/prepare`,
    approve: (id: string) => `/api/industries/${id}/approve`,
    reject: (id: string) => `/api/industries/${id}/reject`,
  },

  polluants: {
    base: '/api/polluants',
    byId: (id: string) => `/api/polluants/${id}`,
    seuils: (id: string) => `/api/polluants/${id}/seuils`,
  },

  sensors: {
    base: '/api/sensors',
    byId: (id: string) => `/api/sensors/${id}`,
    calibrate: (id: string) => `/api/sensors/${id}/calibrate`,
  },

  sensorNodes: {
    base: '/api/sensor-nodes',
    byId: (id: string) => `/api/sensor-nodes/${id}`,
    status: (id: string) => `/api/sensor-nodes/${id}/status`,
  },

  reports: {
    base: '/api/reports',
    byId: (id: string) => `/api/reports/${id}`,
    generate: '/api/reports/generate',
    submit: (id: string) => `/api/reports/${id}/submit`,
    approve: (id: string) => `/api/reports/${id}/approve`,
    reject: (id: string) => `/api/reports/${id}/reject`,
  },

  websocket: {
    stats: '/api/ws/stats',
  },

  ia: {
    health: '/api/ia/health',
    forecastLatest: (zoneId: string) => `/api/ia/zone/${zoneId}/forecasts/latest`,
    anomalyHistory: (zoneId: string) => `/api/ia/zone/${zoneId}/anomalies/history`,
    runForecast: (zoneId: string) => `/api/ia/zone/${zoneId}/forecasts/run`,
    runDetect: (zoneId: string) => `/api/ia/zone/${zoneId}/anomalies/detect`,
    retrainPrepareDataset: '/api/ia/retrain/dataset/prepare',
    retrainLatestDataset: '/api/ia/retrain/dataset/latest',
    retrainStart: '/api/ia/retrain/start',
    retrainLatestJob: '/api/ia/retrain/jobs/latest',
    retrainJobById: (jobId: string) => `/api/ia/retrain/jobs/${jobId}`,
  },
} as const
