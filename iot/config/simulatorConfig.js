// CONFIGURATION DU SIMULATEUR IoT
// Définit tous les capteurs, fréquences et plages de valeurs
//
// Chaque capteur a :
// - topic MQTT : chemin de publication
// - interval : fréquence d'envoi en millisecondes
// - unit : unité de mesure
// - range : plage de valeurs normales (min/max)
// - warningRange : plage de valeurs d'avertissement
// - criticalRange : plage de dépassement critique
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

    // NOx — MQ-135 — toutes les 30 secondes
    nox: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "MQ-135",
      type: "NOX",
      topic: "emissions/Zone-A/NOX",
      interval: 30000, // 30 secondes
      unit: "mg/Nm³",
      range: {
        min: 20,
        max: 120,
      },
      thresholds: {
        warning: {
          min: 96, // 80% de max
          max: 120,
        },
        high: {
          min: 120, // dépasse le max
          max: 144, // max + 20%
        },
        critical: {
          min: 144, // dépasse max de 20%
          max: 180, // max + 50%
        },
      },
    },

    // SO₂ — Alphasense SO2-B4 — toutes les 30 secondes
    so2: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "Alphasense SO2-B4",
      type: "SO2",
      topic: "emissions/Zone-A/SO2",
      interval: 30000, // 30 secondes
      unit: "mg/Nm³",
      range: {
        min: 10,
        max: 120,
      },
      thresholds: {
        warning: {
          min: 96, // 80% de max
          max: 120,
        },
        high: {
          min: 120, // dépasse le max
          max: 144, // max + 20%
        },
        critical: {
          min: 144, // dépasse max de 20%
          max: 180, // max + 50%
        },
      },
    },

    // PM2.5 — Plantower PMS5003 — toutes les 15 secondes
    pm25: {
      model: "Plantower PMS5003",
      type: "PM25",
      topic: "emissions/Zone-A/PM25",
      interval: 15000, // 15 secondes
      unit: "µg/m³",
      range: {
        min: 5,
        max: 12,
      },
      thresholds: {
        warning: {
          min: 9.6, // 80% de max
          max: 12,
        },
        high: {
          min: 12, // dépasse le max
          max: 14.4, // max + 20%
        },
        critical: {
          min: 14.4, // dépasse max de 20%
          max: 18, // max + 50%
        },
      },
    },

    // COV — CCS811 — toutes les 30 secondes
    cov: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "CCS811",
      type: "COV",
      topic: "emissions/Zone-A/COV",
      interval: 30000, // 30 secondes
      unit: "mg/Nm³",
      range: {
        min: 5,
        max: 30,
      },
      thresholds: {
        warning: {
          min: 24, // 80% de max
          max: 30,
        },
        high: {
          min: 30, // dépasse le max
          max: 36, // max + 20%
        },
        critical: {
          min: 36, // dépasse max de 20%
          max: 45, // max + 50%
        },
      },
    },

    // Température — SHT31 — toutes les 10 secondes
    temperature: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "SHT31",
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

    // Humidité — SHT31 — toutes les 10 secondes
    humidity: {
      sensorId: "69cd3d0efa3af876ed1e6c2a",
      model: "SHT31",
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
