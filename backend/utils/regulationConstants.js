/**
 * Références réglementaires tunisiennes — sources fixes industrielles.
 * Décret gouvernemental n° 2018-928 (modifiant les VLE à la source).
 */

const DECRET_REF = "Décret gouvernemental n° 2018-928";
const DECRET_REF_SHORT = "Décret 2018-928";
const DECRET_ANNEX = "Annexe 1 — Valeurs générales, toutes sources fixes industrielles";

function annexRef(section, label) {
  return `${DECRET_REF_SHORT}, ${DECRET_ANNEX}, ${section} — ${label}`;
}

module.exports = {
  DECRET_REF,
  DECRET_REF_SHORT,
  DECRET_ANNEX,
  DECRET_FULL_NAME:
    `${DECRET_REF} du 7 novembre 2018 — ${DECRET_ANNEX}`,
  DECRET_URL:
    "https://9anoun.tn/fr/kb/jorts/jort-2018-093-e609f/decret-gouvernemental-ndeg-2018-928-du-7-novembre-2018-modifiant-et-completant-le-decret-ndeg-2010-2519-du-28-septembre-2010-fixant-les-valeurs-limite-a-la-source-des-polluants-de--1dc9e59f98307752eb7906d3927ecaf3",
  annexRef,
  THRESHOLD_CONFIG_NAME: `Sources fixes — ${DECRET_REF_SHORT} (${DECRET_ANNEX})`,
};
