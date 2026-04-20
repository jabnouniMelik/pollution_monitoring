# python-ia/config.py
# Configuration centrale du module IA
# Tous les autres modules importent depuis ce fichier

import os
from pathlib import Path

# ─────────────────────────────────────────────
# CHEMINS
# ─────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)  # Crée le dossier si absent

# ─────────────────────────────────────────────
# MONGODB
# ─────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB  = os.getenv("MONGO_DB",  "pollution-monitoring")  # Nom exact de ta DB

# Noms exacts des collections MongoDB
COLLECTIONS = {
    "readings"           : "readings",
    "sensors"            : "sensors",
    "polluants"          : "polluants",
    "alerts"             : "alerts",
    "sensor_nodes"       : "sensornodes",
    "industries"         : "industries",
    "anomaly_detections" : "anomaly_detections",  # Nouvelle collection IA
    "predictions"        : "predictions",          # Nouvelle collection IA
    "ai_models"          : "ai_models",            # Metadata des modèles entraînés
}

# ─────────────────────────────────────────────
# POLLUANTS
# Chaque entrée contient :
#   db_name          → nom EXACT dans MongoDB (collection polluants + enum Sensor.js)
#   display_name     → nom lisible pour les logs et rapports
#   unit             → unité de mesure
#   physical_min/max → bornes physiques (valeurs impossibles en dehors)
#   frequency_s      → fréquence de collecte du capteur (secondes)
#   sensor_model     → modèle de capteur physique
#
# IMPORTANT : regulatory_limit et warning_threshold sont intentionnellement
# absents ici — le Python les lit TOUJOURS depuis MongoDB (collection polluants)
# pour rester synchronisé avec les seuils ANPE configurés par l'admin.
# ─────────────────────────────────────────────
POLLUTANT_CONFIG = {
    "CO2": {
        "db_name"      : "CO2",           # Correspond à Polluant.name en DB
        "display_name" : "Dioxyde de carbone",
        "unit"         : "ppm",
        "physical_min" : 300.0,           # CO2 ambiant minimum terrestre
        "physical_max" : 5000.0,
        "sensor_model" : "MH-Z19B",
        "frequency_s"  : 15,
    },
    "NOX": {
        "db_name"      : "NOX",           # Enum Sensor.js = "NOX" (pas "NOx")
        "display_name" : "Oxydes d'azote",
        "unit"         : "ppm",
        "physical_min" : 0.0,
        "physical_max" : 10.0,
        "sensor_model" : "NO2-A1",
        "frequency_s"  : 30,
    },
    "SO2": {
        "db_name"      : "SO2",
        "display_name" : "Dioxyde de soufre",
        "unit"         : "ppm",
        "physical_min" : 0.0,
        "physical_max" : 5.0,
        "sensor_model" : "SO2-B4",
        "frequency_s"  : 30,
    },
    "PM1": {
        "db_name"      : "PM1",
        "display_name" : "Particules fines PM1",
        "unit"         : "µg/m³",
        "physical_min" : 0.0,
        "physical_max" : 500.0,
        "sensor_model" : "PMS5003",
        "frequency_s"  : 15,
    },
    "PM25": {
        "db_name"      : "PM25",          # Enum Sensor.js = "PM25" (pas "PM2.5")
        "display_name" : "Particules fines PM2.5",
        "unit"         : "µg/m³",
        "physical_min" : 0.0,
        "physical_max" : 500.0,
        "sensor_model" : "PMS5003",
        "frequency_s"  : 15,
    },
    "COV": {
        "db_name"      : "COV",
        "display_name" : "Composés organiques volatils",
        "unit"         : "ppb",
        "physical_min" : 0.0,
        "physical_max" : 10000.0,
        "sensor_model" : "CCS811",
        "frequency_s"  : 30,
    },
    "TEMPERATURE": {
        "db_name"      : "TEMPERATURE",
        "display_name" : "Température",
        "unit"         : "°C",
        "physical_min" : -10.0,
        "physical_max" : 80.0,
        "sensor_model" : "SHT31",
        "frequency_s"  : 10,
        "contextual"   : True,            # Pas de seuil réglementaire
    },
    "HUMIDITY": {
        "db_name"      : "HUMIDITY",
        "display_name" : "Humidité relative",
        "unit"         : "%RH",
        "physical_min" : 0.0,
        "physical_max" : 100.0,
        "sensor_model" : "SHT31",
        "frequency_s"  : 10,
        "contextual"   : True,            # Pas de seuil réglementaire
    },
}

# Liste ordonnée — l'ORDRE EST CRITIQUE pour les tenseurs LSTM
# Toujours dans cet ordre : les colonnes du DataFrame et les features du réseau
POLLUTANT_NAMES = ["CO2", "NOX", "SO2", "PM1", "PM25", "COV", "TEMPERATURE", "HUMIDITY"]
N_FEATURES      = len(POLLUTANT_NAMES)  # 8

# Polluants sans seuil réglementaire (contextuels uniquement)
CONTEXTUAL_POLLUTANTS = {"TEMPERATURE", "HUMIDITY"}

# ─────────────────────────────────────────────
# PREPROCESSING
# ─────────────────────────────────────────────
PREPROCESSING = {
    # Interpolation linéaire si moins de 5 % de NaN consécutifs
    "max_nan_ratio"      : 0.05,

    # Détection outliers : Z-score absolu > 3.5 → suspect
    "zscore_threshold"   : 3.5,

    # Détection outliers : en dehors de [Q1 - 3×IQR, Q3 + 3×IQR] → suspect
    "iqr_multiplier"     : 3.0,

    # Lissage exponentiel (alpha faible = lissage fort)
    "ema_alpha"          : 0.3,

    # Fenêtre glissante 10 min (60 points à 10 s)
    "rolling_window_10m" : 60,

    # Fenêtre glissante 30 min (180 points à 10 s)
    "rolling_window_30m" : 180,

    # Fenêtre corrélation croisée CO2 ↔ NOX (5 min = 30 points)
    "cross_corr_window"  : 30,
}

# ─────────────────────────────────────────────
# ISOLATION FOREST — Détection d'anomalies
# ─────────────────────────────────────────────
ISOLATION_FOREST = {
    "n_estimators"         : 100,
    "contamination"        : 0.05,   # 5 % d'anomalies estimées dans les données
    "max_samples"          : "auto", # 256 par arbre (défaut sklearn)
    "random_state"         : 42,     # Reproductibilité garantie
    "max_features"         : 1.0,    # Toutes les features par arbre
    "retrain_window_days"  : 7,      # Réentraînement sur 7 jours glissants

    # Chemins des fichiers exportés
    "model_path"           : str(MODELS_DIR / "model_isolation_forest.pkl"),
    "scaler_path"          : str(MODELS_DIR / "scaler_isolation_forest.pkl"),

    # Seuil score : en dessous → anomalie confirmée
    # (decision_function retourne des valeurs négatives pour les anomalies)
    "score_threshold"      : -0.1,
}

# Seuil Z-score utilisé en PRÉ-FILTRE avant Isolation Forest
# Une valeur avec Z > 3.0 est déjà suspecte sans passer par le modèle
ZSCORE_ANOMALY_THRESHOLD = 3.0

# ─────────────────────────────────────────────
# LSTM — Prédiction des tendances
# ─────────────────────────────────────────────
LSTM_CONFIG = {
    # Fenêtre temporelle
    "lookback"               : 60,   # 60 timesteps d'entrée
    "horizon_short"          : 4,    # ≈ 1 heure de prédiction
    "horizon_long"           : 96,   # ≈ 24 heures de prédiction

    # Architecture réseau
    "units_layer1"           : 64,
    "units_layer2"           : 32,
    "dense_units"            : 16,
    "dropout_rate"           : 0.2,

    # Entraînement
    "batch_size"             : 32,
    "epochs"                 : 100,
    "early_stopping_patience": 10,   # Arrêt si val_loss ne s'améliore pas
    "learning_rate"          : 0.001,

    # Partitionnement temporel (ordre préservé — pas de shuffle)
    "train_ratio"            : 0.70,
    "val_ratio"              : 0.15,
    # test_ratio = 0.15 implicite

    # 1 modèle LSTM par polluant (spécialisation)
    # {pollutant} sera remplacé par ex. "CO2" → model_lstm_CO2.keras
    "model_path_template"    : str(MODELS_DIR / "model_lstm_{pollutant}.keras"),
    "scaler_path_template"   : str(MODELS_DIR / "scaler_lstm_{pollutant}.pkl"),

    # Réentraînement déclenché si RMSE dégradé de plus de 20 %
    "drift_rmse_threshold"   : 0.20,
}

# ─────────────────────────────────────────────
# ALERTES — Sévérités et types
# Utilisés pour communiquer avec Node.js
# (Node.js crée l'Alert en DB, Python fournit les données)
# ─────────────────────────────────────────────
ALERT_SEVERITY = {
    "CRITICAL" : "Critical",  # > regulatoryLimit × 1.5
    "HIGH"     : "High",      # > regulatoryLimit
    "MEDIUM"   : "Warning",   # > warningThreshold
    "LOW"      : "Warning",
}

ALERT_TYPE = {
    "THRESHOLD"    : "Threshold",    # Dépassement seuil réglementaire
    "ANOMALY"      : "Anomaly",      # Détecté par Isolation Forest
    "SENSOR_FAULT" : "SensorFault",  # Panne ou dérive capteur
}

# ─────────────────────────────────────────────
# MICROSERVICE FASTAPI
# ─────────────────────────────────────────────
API_HOST = os.getenv("IA_HOST", "0.0.0.0")
API_PORT = int(os.getenv("IA_PORT", "8000"))

# URL du backend Node.js (pour callbacks si nécessaire)
NODEJS_BACKEND_URL = os.getenv("NODEJS_URL", "http://localhost:5000")