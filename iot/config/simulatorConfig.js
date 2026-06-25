// CONFIGURATION DU SIMULATEUR IoT
// Définit tous les capteurs, fréquences et plages de valeurs
//
// Seuils réglementaires de référence : Décret 2018-928, Annexe 1 (valeurs générales)
// Applicables à toutes sources fixes industrielles tunisiennes :
//   NOX  : 500 mg/Nm³ (Annexe 1, §4 — flux > 25 kg/h)
//   SO₂  : 300 mg/Nm³ (Annexe 1, §3 — flux > 25 kg/h)
//   PM   :  40 mg/m³  (Annexe 1, §1 — flux > 1 kg/h)
//   COV  : 110 mg/Nm³ (Annexe 1, §7 — flux > 2 kg/h)
//   CO₂  : 800 ppm    (seuil interne — pas de VLE réglementaire)
//
// Chaque capteur a :
// - topic MQTT : chemin de publication
// - interval : fréquence d'envoi en millisecondes
// - unit : unité de mesure
// - range : plage de valeurs normales (min/max ≈ 80% VLE)
// - thresholds : warning (80% VLE) / high (100% VLE) / critical (120% VLE)
// - model : modèle physique du capteur

require("dotenv").config();

const SIMULATOR_CONFIG = {
  // ── Connexion MQTT ─────────────────────────────────────────
  mqtt: {
    broker: process.env.MQTT_BROKER || "mqtt://localhost:1883",
    clientId: process.env.MQTT_CLIENTsensorId || "pollution-simulator",
    options: {
      keepalive: 60,
      reconnectPeriod: 1000, // reconnexion auto toutes les 1s
      connectTimeout: 30000,
    },
  },

  // ── Informations du nœud simulé ───────────────────────────
  // Correspond à un vrai nœud ESP32 en production
  node: {
    name: "Station-Sfax-01",
    zone: "Zone-A",
    location: { latitude: 34.74, longitude: 10.76 },
  },

  // Zones simulées pour générer des alertes dans plusieurs zones.
  nodes: [
    {
      name: "Station-Sfax-01",
      zone: "Zone-A",
      location: { latitude: 34.74, longitude: 10.76 },
    },
    {
      name: "Station-Sfax-02",
      zone: "Zone-B",
      location: { latitude: 34.76, longitude: 10.78 },
    },
  ],

  // ── Configuration des capteurs ─────────────────────────────
  sensors: {
    // CO₂ — MH-Z19B — toutes les 10 secondes
    co2: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "MH-Z19B",
      type: "CO2",
      topic: "emissions/Zone-A/CO2",
      interval: 10000, // 10 secondes
      unit: "ppm",
      range: {
        min: 400, // air extérieur normal
        max: 800, // concentration normale en milieu industriel
      },
      thresholds: {
        warning: {
          min: 640, // 80% de max (approche)
          max: 800,
        },
        high: {
          min: 800, // dépasse le max
          max: 960, // max + 20%
        },
        critical: {
          min: 960, // dépasse max de 20%
          max: 1200, // max + 50%
        },
      },
    },

    // NOx — MQ-131 — toutes les 30 secondes
    nox: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "MQ-131",
      type: "NOX",
      topic: "emissions/Zone-A/NOX",
      interval: 30000, // 30 secondes
      unit: "mg/Nm³",
      range: {
        min: 50,
        max: 400,  // ≈ 80% VLE (500 mg/Nm³ — Annexe 1, §4)
      },
      thresholds: {
        warning: {
          min: 400,  // 80% VLE
          max: 500,  // VLE
        },
        high: {
          min: 500,  // dépasse VLE
          max: 600,  // VLE + 20%
        },
        critical: {
          min: 600,  // VLE + 20%
          max: 750,  // VLE + 50%
        },
      },
    },

    // SO₂ — MQ-136 — toutes les 30 secondes
    so2: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "MQ-136",
      type: "SO2",
      topic: "emissions/Zone-A/SO2",
      interval: 30000, // 30 secondes
      unit: "mg/Nm³",
      range: {
        min: 20,
        max: 240,  // ≈ 80% VLE (300 mg/Nm³ — Annexe 1, §3)
      },
      thresholds: {
        warning: {
          min: 240,  // 80% VLE
          max: 300,  // VLE
        },
        high: {
          min: 300,  // dépasse VLE
          max: 360,  // VLE + 20%
        },
        critical: {
          min: 360,  // VLE + 20%
          max: 450,  // VLE + 50%
        },
      },
    },

    // PM2.5 — SDS011 — toutes les 15 secondes
    // Note : SDS011 mesure en µg/m³ (max ~999 µg/m³ ≈ 1 mg/m³).
    // La VLE industrielle (40 mg/m³ = 40 000 µg/m³) est hors portée du capteur.
    // Seuils indicatifs basés sur les recommandations OMS 2021 (air ambiant).
    pm25: {
      model: "SDS011",
      type: "PM25",
      topic: "emissions/Zone-A/PM25",
      interval: 15000, // 15 secondes
      unit: "µg/m³",
      range: {
        min: 5,
        max: 25,   // OMS 2021 : 25 µg/m³ (24h)
      },
      thresholds: {
        warning: {
          min: 12,   // OMS 2021 : 15 µg/m³ annuel
          max: 25,
        },
        high: {
          min: 25,   // dépasse recommandation 24h OMS
          max: 50,
        },
        critical: {
          min: 50,
          max: 150,
        },
      },
    },

    // COV — SGP30 — toutes les 30 secondes
    cov: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "SGP30",
      type: "COV",
      topic: "emissions/Zone-A/COV",
      interval: 30000, // 30 secondes
      unit: "mg/Nm³",
      range: {
        min: 5,
        max: 88,   // ≈ 80% VLE (110 mg/Nm³ — Annexe 1, §7)
      },
      thresholds: {
        warning: {
          min: 88,   // 80% VLE
          max: 110,  // VLE
        },
        high: {
          min: 110,  // dépasse VLE
          max: 132,  // VLE + 20%
        },
        critical: {
          min: 132,  // VLE + 20%
          max: 165,  // VLE + 50%
        },
      },
    },

    // Température — DHT22 — toutes les 10 secondes
    temperature: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "DHT22",
      type: "TEMPERATURE",
      topic: "emissions/Zone-A/TEMPERATURE",
      interval: 10000, // 10 secondes
      unit: "°C",
      range: {
        min: 18, // température ambiante normale
        max: 35,
      },
      thresholds: {
        warning: {
          min: 28, // 80% de max
          max: 35,
        },
        high: {
          min: 35, // dépasse le max
          max: 42, // max + 20%
        },
        critical: {
          min: 42, // dépasse max de 20%
          max: 52.5, // max + 50%
        },
      },
    },

    // Humidité — DHT22 — toutes les 10 secondes
    humidity: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "DHT22",
      type: "HUMIDITY",
      topic: "emissions/Zone-A/HUMIDITY",
      interval: 10000, // 10 secondes
      unit: "%RH",
      range: {
        min: 30, // humidité relative normale
        max: 60,
      },
      thresholds: {
        warning: {
          min: 48, // 80% de max
          max: 60,
        },
        high: {
          min: 60, // dépasse le max
          max: 72, // max + 20%
        },
        critical: {
          min: 72, // dépasse max de 20%
          max: 90, // max + 50%
        },
      },
    },
  },

  // ── Scénarios de simulation ────────────────────────────────
  // Permet de simuler différentes situations
  scenarios: {
    NORMAL: "normal", // valeurs dans la plage normale
    WARNING: "warning", // valeurs dans la plage d'avertissement
    CRITICAL: "critical", // valeurs en dépassement critique
    RANDOM: "random", // alternance aléatoire (défaut)
  },
};

module.exports = SIMULATOR_CONFIG;
