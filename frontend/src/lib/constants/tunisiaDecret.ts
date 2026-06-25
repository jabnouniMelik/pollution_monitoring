/**

 * Décret gouvernemental n° 2018-928 du 7 novembre 2018.

 * Annexe 1 — Valeurs limites générales à la source des polluants de l'air

 * Applicables à toutes sources fixes industrielles en l'absence de valeur

 * spécifique plus contraignante.

 *

 * Source : JORT n° 2018-093

 *

 * IMPORTANT: These values are advisory defaults for the frontend display.

 * The backend `ThresholdConfig` is authoritative. Always prefer

 * server-provided thresholds when available.

 */



const DECRET_SECTION = 'Décret 2018-928, Annexe 1'



export const TUNISIA_DECRET_LIMITS = {

  NOX: {

    limit: 500,

    warning: 400,

    critical: 600,

    unit: 'mg/Nm³',

    reference: `${DECRET_SECTION}, §4 — NOₓ (flux > 25 kg/h)`,

  },

  SO2: {

    limit: 300,

    warning: 240,

    critical: 360,

    unit: 'mg/Nm³',

    reference: `${DECRET_SECTION}, §3 — SO₂ (flux > 25 kg/h)`,

  },

  PM: {

    limit: 40,

    warning: 32,

    critical: 48,

    unit: 'mg/m³',

    reference: `${DECRET_SECTION}, §1 — Poussières (flux > 1 kg/h)`,

  },

  PM25: {

    limit: 40,

    warning: 32,

    critical: 48,

    unit: 'µg/m³',

    reference: `${DECRET_SECTION}, §1 — Poussières (flux > 1 kg/h)`,

  },

  PM10: {

    limit: 48,

    warning: 38,

    critical: 58,

    unit: 'µg/m³',

    reference: `${DECRET_SECTION}, §1 — Poussières (flux > 1 kg/h)`,

  },

  COV: {

    limit: 110,

    warning: 88,

    critical: 132,

    unit: 'mg/Nm³',

    reference: `${DECRET_SECTION}, §7 — COV (flux > 2 kg/h, carbone total)`,

  },

  CO2: {

    limit: 800,

    warning: 640,

    critical: 960,

    unit: 'ppm',

    reference: 'Suivi interne — pas de VLE réglementaire (Décret 2018-928)',

  },

} as const



export const DECRET_NAME = 'Décret gouvernemental n° 2018-928'



export const DECRET_FULL_NAME =

  'Décret gouvernemental n° 2018-928 du 7 novembre 2018 — ' +

  'Annexe 1 (valeurs générales, toutes sources fixes industrielles)'



export const DECRET_URL =

  'https://9anoun.tn/fr/kb/jorts/jort-2018-093-e609f/decret-gouvernemental-ndeg-2018-928-du-7-novembre-2018-modifiant-et-completant-le-decret-ndeg-2010-2519-du-28-septembre-2010-fixant-les-valeurs-limite-a-la-source-des-polluants-de--1dc9e59f98307752eb7906d3927ecaf3'



export const DECRET_ANNEX = 'Annexe 1 — Valeurs générales, toutes sources fixes industrielles'



export const DECRET_O2_REF = 'Conditions normales : 0°C, 101,325 kPa (gaz sec)'


