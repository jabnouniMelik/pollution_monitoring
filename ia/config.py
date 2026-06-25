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
        "sensor_model" : "ME4-NO2",       # électrochimique — remplace MQ-131
        "frequency_s"  : 30,
    },
    "SO2": {
        "db_name"      : "SO2",
        "display_name" : "Dioxyde de soufre",
        "unit"         : "ppm",
        "physical_min" : 0.0,
        "physical_max" : 5.0,
        "sensor_model" : "ME4-SO2",       # électrochimique — remplace MQ-136
        "frequency_s"  : 30,
    },
    "PM1": {
        "db_name"      : "PM1",
        "display_name" : "Particules fines PM1",
        "unit"         : "µg/m³",
        "physical_min" : 0.0,
        "physical_max" : 500.0,
        "sensor_model" : "PMS5003",  # PM1 — capteur externe non retenu dans le prototype
        "frequency_s"  : 15,
    },
    "PM25": {
        "db_name"      : "PM25",          # Enum Sensor.js = "PM25" (pas "PM2.5")
        "display_name" : "Particules fines PM2.5",
        "unit"         : "µg/m³",
        "physical_min" : 0.0,
        "physical_max" : 500.0,
        "sensor_model" : "SDS011",
        "frequency_s"  : 15,
    },
    "COV": {
        "db_name"      : "COV",
        "display_name" : "Composés organiques volatils",
        "unit"         : "ppb",
        "physical_min" : 0.0,
        "physical_max" : 10000.0,
        "sensor_model" : "SGP30",
        "frequency_s"  : 30,
    },
    "TEMPERATURE": {
        "db_name"      : "TEMPERATURE",
        "display_name" : "Température",
        "unit"         : "°C",
        "physical_min" : -10.0,
        "physical_max" : 80.0,
        "sensor_model" : "DHT22",
        "frequency_s"  : 10,
        "contextual"   : True,            # Pas de seuil réglementaire
    },
    "HUMIDITY": {
        "db_name"      : "HUMIDITY",
        "display_name" : "Humidité relative",
        "unit"         : "%RH",
        "physical_min" : 0.0,
        "physical_max" : 100.0,
        "sensor_model" : "DHT22",
        "frequency_s"  : 10,
        "contextual"   : True,            # Pas de seuil réglementaire
    },
}

# Liste ordonnée — capteurs MongoDB / data_generator (PM1, SO2 en base)
POLLUTANT_NAMES = ["CO2", "NOX", "SO2", "PM1", "PM25", "COV", "TEMPERATURE", "HUMIDITY"]

# Colonnes des tenseurs LSTM (notebooks 05–07) — alignées sur training_dataset.csv
# SOX (pas SO2), PM10 (pas PM1), T/RH depuis temperature_c / humidity_percent
LSTM_FEATURE_NAMES = ["CO2", "NOX", "SOX", "PM25", "PM10", "COV", "TEMPERATURE", "HUMIDITY"]
N_OUTPUT_FEATURES = len(LSTM_FEATURE_NAMES)  # 8 — cibles / sortie modèle
N_FEATURES = N_OUTPUT_FEATURES  # alias notebooks (sortie)

LSTM_CALENDAR_FEATURE_NAMES = ["hour_sin", "hour_cos", "dow_sin", "dow_cos"]

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
    "scaler_path"          : str(MODELS_DIR / "if_scaler.pkl"),
    "metrics_path"         : str(MODELS_DIR / "if_metrics.json"),

    # Seuil score : en dessous → anomalie confirmée
    # (decision_function retourne des valeurs négatives pour les anomalies)
    "score_threshold"      : -0.20,
}

# Ordre des colonnes à l'entraînement (notebook 04) — pivot horaire site
IF_FEATURE_NAMES = ["NOX", "SOX", "PM25", "PM10", "CO2", "COV"]

IF_INTEGRATION = {
    "alert_source"   : "ISOLATION_FOREST",
    "min_features"   : 4,  # minimum de polluants renseignés pour lancer /detect
}

# Seuil Z-score utilisé en PRÉ-FILTRE avant Isolation Forest
# Une valeur avec Z > 3.0 est déjà suspecte sans passer par le modèle
ZSCORE_ANOMALY_THRESHOLD = 3.0

# ─────────────────────────────────────────────
# LSTM — Prédiction des tendances
# ─────────────────────────────────────────────
LSTM_CONFIG = {
    # Cadence canonique (alignée KPI HOURLY + datasets publics horaires)
    # Voir ia/TRAINING_PLAN.md § « Cadence temporelle »
    "timestep_minutes"       : 60,

    # Fenêtre temporelle (en nombre de pas horaires)
    "lookback"               : 48,   # 48 h d'historique (2 cycles jour/nuit)
    "horizon_short"          : 4,    # 4 h — seul horizon MVP (alertes shift / KPI)
    "horizons_hourly"        : [4],  # Notebook 05/06 — 2 h retiré (R² test dégradé)

    # Architecture réseau (relu + MSE : meilleur R² test 4 h sur ce jeu)
    "units_layer1"           : 64,
    "units_layer2"           : 32,
    "dense_units"            : 16,
    "dropout_rate"           : 0.2,
    "recurrent_dropout"      : 0.0,
    "lstm_activation"        : "relu",

    # Entraînement (Sprint 2 — skill-oriented)
    "loss"                   : "huber",
    "use_weighted_loss"      : True,
    "loss_weights"           : {
        "CO2"         : 2.0,
        "PM10"        : 2.0,
        "TEMPERATURE" : 1.2,
        "NOX"         : 0.3,
        "SOX"         : 0.3,
        "PM25"        : 0.3,
        "COV"         : 0.5,
        "HUMIDITY"    : 0.5,
    },
    "huber_delta"            : 0.05,
    "early_stopping_monitor" : "val_skill",
    "skill_val_max_samples"  : 4000,
    "gradient_clip_norm"     : 1.0,
    "batch_size"             : 32,
    "epochs"                 : 100,
    "early_stopping_patience": 15,
    "learning_rate"          : 0.001,
    "lr_reduce_factor"       : 0.5,
    "lr_reduce_patience"     : 4,
    "min_learning_rate"      : 1e-5,

    # Partitionnement temporel (ordre préservé — pas de shuffle)
    "train_ratio"            : 0.70,
    "val_ratio"              : 0.15,
    # test_ratio = 0.15 implicite

    # Modèle exporté (notebook 06)
    "model_path_4h"          : str(MODELS_DIR / "model_lstm_4h.h5"),

    # Préparation tenseurs (notebook 05) — Sprint 3
    "use_calendar_features"  : False,  # MVP phase 2 — réactiver seulement après test sur données MongoDB
    "winsorize_lower_pct"    : 1.0,
    "winsorize_upper_pct"    : 99.0,

    # 1 modèle LSTM par polluant (option fine-tuning local)
    # {pollutant} sera remplacé par ex. "CO2" → model_lstm_CO2.keras
    "model_path_template"    : str(MODELS_DIR / "model_lstm_{pollutant}.keras"),
    "scaler_path_template"   : str(MODELS_DIR / "scaler_lstm_{pollutant}.pkl"),

    # Réentraînement déclenché si RMSE dégradé de plus de 20 %
    "drift_rmse_threshold"   : 0.20,
}

# Critères go/no-go déploiement MVP (Sprint 1 — skill vs persistance)
# Voir ia/docs/LSTM_IMPROVEMENT_STRATEGY.md
LSTM_ACCEPTANCE = {
    "min_global_skill"        : 0.02,
    "min_pollutant_skill"     : {
        "CO2"         : 0.05,
        "PM10"        : 0.08,
        "TEMPERATURE" : 0.02,
    },
    "max_horizon_step_mae_ratio": {
        "+1h": 1.15,
    },
    # Réduire la part de persistance : on ne fallback que pour l’instable.
    "allow_fallback_pollutants": [
        "HUMIDITY",
    ],
    "deploy_if_fallback_only" : True,
}

# Inférence / alertes MVP — modèle unique 4 h (voir ia/docs/TRAINING_PLAN.md)
LSTM_INTEGRATION = {
    4: {
        "horizon_hours"  : 4,
        "model_path"     : LSTM_CONFIG["model_path_4h"],
        "metrics_path"   : str(MODELS_DIR / "lstm_4h_metrics.json"),
        "skill_report_path": str(MODELS_DIR / "lstm_4h_skill_report.json"),
        "scaler_key"     : 4,
        "alert_source"   : "LSTM_4H",
        "usage"          : "shift_planning",
        "summary"        : "Anticipation opérationnelle +1…+4 h (agrégat horaire)",
        "fallback_pollutants": LSTM_ACCEPTANCE["allow_fallback_pollutants"],
        "blend_alpha_by_pollutant": {
            "CO2": 1.0,
            "PM10": 1.0,
            "TEMPERATURE": 0.85,
            "NOX": 1.0,
            "SOX": 1.0,
            "PM25": 1.0,
            "COV": 1.0,
            "HUMIDITY": 0.0,
        },
    },
}


def lstm_input_feature_count() -> int:
    """Entrée LSTM : polluants + éventuellement features calendrier."""
    n = N_OUTPUT_FEATURES
    if LSTM_CONFIG.get("use_calendar_features"):
        n += len(LSTM_CALENDAR_FEATURE_NAMES)
    return n

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