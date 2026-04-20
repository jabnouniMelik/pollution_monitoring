/**
 * Centralized API endpoint map. Keep one source of truth per backend route.
 * Backend mount points (see backend/server.js):
 *   /api/auth, /api/users, /api/sites, /api/zones,
 *   /api/industries, /api/sensors, /api/sensor-nodes, /api/polluants,
 *   /api/readings, /api/alerts, /api/reports, /api/kpi,
 *   /api/ws/stats
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
    role: (id: string) => `/api/users/${id}/role`,
    sites: (id: string) => `/api/users/${id}/sites`,
    zones: (id: string) => `/api/users/${id}/zones`,
  },
  sites: {
    base: '/api/sites',
    byId: (id: string) => `/api/sites/${id}`,
    supervisor: (id: string) => `/api/sites/${id}/supervisor`,
    byIndustry: (industryId: string) => `/api/sites/industrie/${industryId}`,
    zonesCount: (id: string) => `/api/sites/${id}/zones-count`,
  },
  zones: {
    base: '/api/zones',
    byId: (id: string) => `/api/zones/${id}`,
    operator: (id: string) => `/api/zones/${id}/operator`,
    bySite: (siteId: string) => `/api/zones/site/${siteId}`,
  },
  readings: {
    base: '/api/readings',
    latest: '/api/readings/latest',
    history: '/api/readings/history',
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
    td: (pollutantId: string) => `/api/kpi/td/${pollutantId}`,
    emj: (pollutantId: string) => `/api/kpi/emj/${pollutantId}`,
    ipe: '/api/kpi/ipe',
    rco2: (pollutantId: string) => `/api/kpi/rco2/${pollutantId}`,
    summary: '/api/kpi/summary',
    history: (pollutantId: string) => `/api/kpi/history/${pollutantId}`,
    config: '/api/kpi/config',
    configAirflow: '/api/kpi/config/airflow',
    configWeights: '/api/kpi/config/weights',
    configTargets: '/api/kpi/config/targets',
    aggregate: '/api/kpi/aggregate',
  },
  thresholds: {
    base: '/api/thresholds',
    byId: (id: string) => `/api/thresholds/${id}`,
    bySite: (siteId: string) => `/api/thresholds/site/${siteId}`,
  },
  reports: {
    base: '/api/reports',
    byId: (id: string) => `/api/reports/${id}`,
    generate: '/api/reports/generate',
    export: (id: string) => `/api/reports/${id}/export`,
  },
  websocket: {
    stats: '/api/ws/stats',
  },
} as const
