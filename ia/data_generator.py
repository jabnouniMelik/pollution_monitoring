# python-ia/data_generator.py
# Générateur de données synthétiques réalistes pour l'entraînement des modèles IA
# Simule 30 jours de mesures multi-capteurs avec :
#   - Tendances journalières (pics matin/soir)
#   - Variations saisonnières (température)
#   - Anomalies injectées (5 % des données)
#   - Bruit de capteur réaliste
#   - Corrélations inter-polluants (CO2 ↑ → NOX ↑)

import numpy as np
import pandas as pd
from config import POLLUTANT_NAMES, POLLUTANT_CONFIG, PREPROCESSING
import os

# Graine fixe pour reproductibilité (même données à chaque run)
np.random.seed(42)


# ─────────────────────────────────────────────
# PARAMÈTRES DE SIMULATION
# Valeurs de base typiques pour une zone industrielle tunisienne
# ─────────────────────────────────────────────
BASE_VALUES = {
    "CO2"         : 600.0,    # ppm  — zone industrielle active
    "NOX"         : 80.0,     # ppm  — légèrement sous le seuil
    "SO2"         : 0.012,    # ppm  — sous le seuil OMS
    "PM1"         : 8.0,      # µg/m³
    "PM25"        : 15.0,     # µg/m³ — proche seuil OMS 25
    "COV"         : 300.0,    # ppb  — sous le seuil 500
    "TEMPERATURE" : 28.0,     # °C   — climat tunisien
    "HUMIDITY"    : 55.0,     # %RH
}

# Amplitude des variations normales (bruit de capteur + cycle journalier)
NORMAL_VARIATION = {
    "CO2"         : 80.0,
    "NOX"         : 20.0,
    "SO2"         : 0.004,
    "PM1"         : 3.0,
    "PM25"        : 5.0,
    "COV"         : 60.0,
    "TEMPERATURE" : 5.0,
    "HUMIDITY"    : 10.0,
}

# Amplitude des pics (dépassements simulés)
PEAK_MULTIPLIER = {
    "CO2"         : 1.8,   # Jusqu'à 1080 ppm (dépasse seuil 800)
    "NOX"         : 2.0,   # Jusqu'à 160 — dépasse seuil
    "SO2"         : 2.5,   # Jusqu'à 0.030 ppm
    "PM1"         : 3.0,
    "PM25"        : 2.5,   # Jusqu'à 37.5 µg/m³ — dépasse seuil 25
    "COV"         : 2.2,   # Jusqu'à 660 ppb — dépasse seuil 500
    "TEMPERATURE" : 1.3,
    "HUMIDITY"    : 1.2,
}


def generate_daily_pattern(hours: np.ndarray, day_of_week: np.ndarray = None) -> np.ndarray:
    """
    Génère un pattern journalier typique d'une zone industrielle.
    
    Deux pics d'activité :
      - Matin  (8h–11h)  : démarrage des équipements
      - Soir   (17h–20h) : fin de production
    
    Variation weekday/weekend :
      - Lundi–Vendredi : activité industrielle complète
      - Samedi–Dimanche : ~50 % réduit
    
    Args:
        hours       : tableau numpy des heures (0–23)
        day_of_week : tableau numpy (0=Monday, 6=Sunday); None = tous les jours
    
    Returns:
        tableau de multiplicateurs [0.3, 1.0] — bas la nuit/week-end, haut le jour
    """
    # Pic matin centré à 9h30, pic soir centré à 18h30
    morning_peak = np.exp(-0.5 * ((hours - 9.5) / 1.5) ** 2)
    evening_peak = np.exp(-0.5 * ((hours - 18.5) / 1.5) ** 2)
    
    # Activité de base + deux pics
    pattern = 0.6 + 0.4 * (morning_peak + 0.7 * evening_peak)
    
    # Réduction week-end si day_of_week fourni
    if day_of_week is not None:
        weekend_mask = day_of_week >= 5  # Samedi=5, Dimanche=6
        pattern = np.where(weekend_mask, pattern * 0.5, pattern)
    
    return pattern


def apply_sensor_lag(series: np.ndarray, lag_seconds: int = 15, freq_seconds: int = 10) -> np.ndarray:
    """
    Simule le délai de réponse réaliste des capteurs.
    Réponse temps typique : 5–30 secondes (utilise lissage exponentiel).
    
    Args:
        series       : tableau de valeurs du capteur
        lag_seconds  : délai de réponse en secondes
        freq_seconds : fréquence d'échantillonnage en secondes
    
    Returns:
        tableau avec lag appliqué (lissage simple)
    """
    lag_points = max(2, int(lag_seconds / freq_seconds))
    
    # Kernel de convolution triangulaire (réponse réaliste progressive)
    kernel = np.linspace(0, 1, lag_points)
    kernel = kernel / kernel.sum() if kernel.sum() > 0 else kernel  # Normaliser sûrement
    
    # Appliquer convolution (bord avec mode='same')
    lagged = np.convolve(series, kernel, mode='same')
    return lagged


def add_correlations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ajoute des corrélations réalistes entre polluants.
    
    Dans une zone industrielle :
      - CO2 ↑ → NOX ↑ (combustion simultanée)
      - NOX ↑ → SO2 légèrement ↑ (mêmes sources)
      - PM25 corrèle avec PM1 (même capteur PMS5003)
    
    Args:
        df: DataFrame avec colonnes POLLUTANT_NAMES
    
    Returns:
        DataFrame avec corrélations appliquées
    """
    df = df.copy()
    
    # Normaliser CO2 pour créer un signal de corrélation [0, 1]
    co2_norm = (df["CO2"] - df["CO2"].min()) / (df["CO2"].max() - df["CO2"].min())
    
    # CO2 ↑ 10 % → NOX ↑ ~5 % (corrélation partielle)
    df["NOX"] = df["NOX"] + co2_norm * BASE_VALUES["NOX"] * 0.15
    
    # NOX ↑ → SO2 légèrement ↑
    nox_norm = (df["NOX"] - df["NOX"].min()) / (df["NOX"].max() - df["NOX"].min())
    df["SO2"] = df["SO2"] + nox_norm * BASE_VALUES["SO2"] * 0.10
    
    # PM1 et PM25 très corrélés (même capteur)
    df["PM1"] = df["PM25"] * 0.55 + np.random.normal(0, 0.5, len(df))
    df["PM1"] = df["PM1"].clip(lower=0)
    
    # Humidité inverse avec température (loi physique)
    temp_norm = (df["TEMPERATURE"] - df["TEMPERATURE"].min()) / \
                (df["TEMPERATURE"].max() - df["TEMPERATURE"].min())
    df["HUMIDITY"] = df["HUMIDITY"] - temp_norm * 10.0
    df["HUMIDITY"] = df["HUMIDITY"].clip(0, 100)
    
    return df


def inject_anomalies(df: pd.DataFrame, anomaly_ratio: float = 0.05, freq_seconds: int = 10) -> tuple:
    """
    Injecte des anomalies réalistes dans le dataset.
    
    3 types d'anomalies injectées :
      1. Pic soudain   : augmentation brutale (décroissance Gaussienne)
      2. Dérive lente  : montée progressive sur 30–60 min
      3. Incohérence   : PM25 élevé mais CO2/NOX normaux
    
    Anomalies en cascade :
      - Si CO2 spike → NOX spike aussi (source commune)
      - Si PM25 spike → peut être suivi de SO2 (co-émission)
    
    Args:
        df            : DataFrame des données normales
        anomaly_ratio : proportion d'anomalies (0.05 = 5 %)
        freq_seconds  : fréquence d'échantillonnage
    
    Returns:
        (df_with_anomalies, labels, anomaly_metadata)
        labels                : Series booléenne, True = point anormal
        anomaly_metadata      : Dict avec type, severity (0-1), duration
    """
    df = df.copy()
    n = len(df)
    n_anomalies = int(n * anomaly_ratio)
    
    # Labels et métadonnées
    labels = pd.Series(False, index=df.index)
    anomaly_metadata = pd.DataFrame({
        "index": range(n),
        "type": "",
        "severity": 0.0,
        "duration_points": 0
    }).set_index("index")
    
    # Indices aléatoires pour anomalies (espacés d'au moins 100 points)
    anomaly_indices = np.random.choice(
        range(150, n - 150),
        size=n_anomalies,
        replace=False
    )
    
    for idx in anomaly_indices:
        anomaly_type = np.random.choice(["sudden_spike", "drift", "incoherence"],
                                         p=[0.5, 0.3, 0.2])
        
        if anomaly_type == "sudden_spike":
            # Pic avec décroissance Gaussienne (réaliste)
            spike_len = np.random.randint(10, 25)  # 100–250 secondes
            pollutant = np.random.choice(["CO2", "NOX", "PM25", "COV"])
            severity = np.random.uniform(2.0, 3.5)
            end_idx = min(idx + spike_len, n)
            actual_len = end_idx - idx
            
            # Décroissance Gaussienne smooth
            x = np.linspace(-1, 1, actual_len)
            gaussian_decay = np.exp(-0.5 * x ** 2)
            spike_factor = 1 + (severity - 1) * gaussian_decay
            
            df.loc[df.index[idx:end_idx], pollutant] = df.loc[df.index[idx:end_idx], pollutant].values * spike_factor
            labels.iloc[idx:end_idx] = True
            
            # Métadonnées
            anomaly_metadata.loc[idx:end_idx-1, "type"] = anomaly_type
            anomaly_metadata.loc[idx:end_idx-1, "severity"] = (severity - 1) / 2.5
            anomaly_metadata.loc[idx:end_idx-1, "duration_points"] = end_idx - idx
            
            # ANOMALIE EN CASCADE : Si CO2 spike → NOX spike aussi
            if pollutant == "CO2":
                nox_cascade = min(idx + spike_len + 5, n)
                nox_len = nox_cascade - idx
                nox_x = np.linspace(-1, 1, nox_len)
                nox_decay = np.exp(-0.5 * nox_x ** 2)
                nox_factor = 1 + (severity - 1) * 0.6 * nox_decay
                df.loc[df.index[idx:nox_cascade], "NOX"] = df.loc[df.index[idx:nox_cascade], "NOX"].values * nox_factor
                labels.iloc[idx:nox_cascade] = True
        
        elif anomaly_type == "drift":
            # Dérive progressive (rampe linéaire puis plateau)
            drift_len = np.random.randint(40, 80)  # 400–800 secondes / 6–13 min
            pollutant = np.random.choice(["CO2", "SO2", "COV"])
            severity = np.random.uniform(1.8, 2.5)
            end_idx = min(idx + drift_len, n)
            
            drift_factor = np.linspace(1.0, severity, end_idx - idx)
            df.loc[df.index[idx:end_idx], pollutant] = df.loc[df.index[idx:end_idx], pollutant].values * drift_factor
            labels.iloc[idx:end_idx] = True
            
            anomaly_metadata.loc[idx:end_idx-1, "type"] = anomaly_type
            anomaly_metadata.loc[idx:end_idx-1, "severity"] = (severity - 1) / 1.5
            anomaly_metadata.loc[idx:end_idx-1, "duration_points"] = end_idx - idx
        
        elif anomaly_type == "incoherence":
            # Incohérence avec cascades
            spike_len = np.random.randint(8, 25)
            end_idx = min(idx + spike_len, n)
            severity = np.random.uniform(3.0, 5.0)
            
            # PM25 élevé, CO2 normal → incohérence
            df.loc[df.index[idx:end_idx], "PM25"] = df.loc[df.index[idx:end_idx], "PM25"].values * severity
            labels.iloc[idx:end_idx] = True
            
            # CASCADE optionnelle : PM25 → SO2 (particules liées au SO2)
            if np.random.random() > 0.5:
                so2_end = min(idx + spike_len // 2, n)
                df.loc[df.index[idx:so2_end], "SO2"] = df.loc[df.index[idx:so2_end], "SO2"].values * 1.5
                labels.iloc[idx:so2_end] = True
            
            anomaly_metadata.loc[idx:end_idx-1, "type"] = anomaly_type
            anomaly_metadata.loc[idx:end_idx-1, "severity"] = (severity - 1) / 4.0
            anomaly_metadata.loc[idx:end_idx-1, "duration_points"] = end_idx - idx
    
    # Clipper APRÈS anomalies (mais avant corrélations)
    for pollutant in POLLUTANT_NAMES:
        p_config = POLLUTANT_CONFIG[pollutant]
        df[pollutant] = df[pollutant].clip(
            lower=p_config["physical_min"],
            upper=p_config["physical_max"]
        )
    
    return df, labels, anomaly_metadata


def generate_dataset(
    days: int = 30,
    freq_seconds: int = 10,
    include_anomalies: bool = True,
    anomaly_ratio: float = 0.05
) -> tuple:
    """
    Génère le dataset complet d'entraînement.
    
    Améliorations :
      - Timestamps optimisés (pd.date_range)
      - Pattern journalier avec variation week-end
      - Sensor lag simulé (réponse capteur réaliste)
      - Anomalies en cascade avec décroissance Gaussienne
      - Métadonnées de sévérité pour chaque anomalie
    
    Args:
        days              : nombre de jours simulés (30 par défaut)
        freq_seconds      : fréquence d'échantillonnage en secondes (10 s)
        include_anomalies : injecter des anomalies ou non
        anomaly_ratio     : proportion d'anomalies (0.05 = 5 %)
    
    Returns:
        (df, labels, anomaly_metadata) si include_anomalies=True
        (df, None, None) sinon
        df                 : DataFrame avec colonnes POLLUTANT_NAMES
        labels             : Series booléenne (True = anomalie)
        anomaly_metadata   : DataFrame (type, severity, duration_points)
    
    Exemple :
        df, labels, meta = generate_dataset(days=30)
        print(df.shape)  # (259200, 8) pour 30j à 10s
    """
    print(f"[INFO] Génération de {days} jours de données "
          f"(fréquence : {freq_seconds}s)...")
    
    # ── 1. Créer l'index temporel (optimisé) ──────────────────
    start_time = pd.Timestamp("2025-01-01 00:00:00")
    timestamps = pd.date_range(start_time, periods=int(days * 24 * 3600 / freq_seconds),
                               freq=f"{freq_seconds}s")
    total_points = len(timestamps)
    
    # ── 2. Extraire les heures et jours de semaine ────────────
    hours = np.array([t.hour + t.minute / 60.0 for t in timestamps])
    day_of_week = np.array([t.dayofweek for t in timestamps])  # 0=Mon, 6=Sun
    
    # ── 3. Pattern journalier + variation week-end ─────────────
    daily_pattern = generate_daily_pattern(hours, day_of_week)
    
    # ── 4. Générer chaque polluant ─────────────────────────────
    data = {}
    
    for pollutant in POLLUTANT_NAMES:
        base = BASE_VALUES[pollutant]
        variation = NORMAL_VARIATION[pollutant]
        
        # Signal de base avec pattern journalier
        signal = base * daily_pattern
        
        # Bruit gaussien (simulation bruit capteur)
        noise = np.random.normal(0, variation * 0.3, total_points)
        
        # Variation sinusoïdale lente (tendance sur plusieurs jours)
        days_array = np.arange(total_points) / (24 * 3600 / freq_seconds)
        slow_trend = variation * 0.5 * np.sin(2 * np.pi * days_array / 7)
        
        values = signal + noise + slow_trend
        
        # ── 5a. Appliquer le délai de réponse capteur (sensor lag) ──
        values = apply_sensor_lag(values, lag_seconds=15, freq_seconds=freq_seconds)
        
        # ── 5b. Clipper aux bornes physiques ───────────────────────
        p_config = POLLUTANT_CONFIG[pollutant]
        values = np.clip(values, p_config["physical_min"], p_config["physical_max"])
        
        data[pollutant] = values
    
    df = pd.DataFrame(data, index=timestamps)
    
    # ── 6. Ajouter les corrélations inter-polluants ────────────
    df = add_correlations(df)
    
    # ── 7. Injecter les anomalies avec métadonnées ─────────────
    labels = None
    anomaly_metadata = None
    if include_anomalies:
        df, labels, anomaly_metadata = inject_anomalies(df, anomaly_ratio, freq_seconds)
        n_anomalies = labels.sum()
        print(f"[INFO] {n_anomalies} points anormaux injectés "
              f"({n_anomalies/len(df)*100:.2f} %)")
        
        # Statistiques sur les anomalies
        unique_types = anomaly_metadata["type"].value_counts()
        print(f"[INFO] Types d'anomalies : {dict(unique_types)}")
    
    print(f"[INFO] Dataset généré : {len(df)} points — "
          f"colonnes : {list(df.columns)}")
    
    return df, labels, anomaly_metadata


def save_dataset(df: pd.DataFrame, labels: pd.Series = None,
                 anomaly_metadata: pd.DataFrame = None,
                 output_dir: str = "data") -> None:
    """
    Sauvegarde le dataset complet avec métadonnées.
    
    Fichiers générés :
      - synthetic_dataset.csv : données brutes
      - anomaly_labels.csv    : labels booléens (True = anomalie)
      - anomaly_metadata.csv  : type, severity, duration pour chaque point
      - dataset_stats.csv     : statistiques descriptives
    
    Args:
        df                : DataFrame des données
        labels            : Series des labels d'anomalie (optionnel)
        anomaly_metadata  : DataFrame des métadonnées d'anomalie (optionnel)
        output_dir        : dossier de sortie
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Données brutes
    data_path = os.path.join(output_dir, "synthetic_dataset.csv")
    df.to_csv(data_path)
    print(f"[INFO] Dataset sauvegardé → {data_path}")
    
    # Labels d'anomalie
    if labels is not None:
        labels_path = os.path.join(output_dir, "anomaly_labels.csv")
        labels.to_csv(labels_path, header=["is_anomaly"])
        print(f"[INFO] Labels sauvegardés  → {labels_path}")
    
    # Métadonnées d'anomalies (type, severity, duration)
    if anomaly_metadata is not None:
        meta_path = os.path.join(output_dir, "anomaly_metadata.csv")
        anomaly_metadata.to_csv(meta_path)
        print(f"[INFO] Métadonnées        → {meta_path}")
    
    # Statistiques descriptives
    stats_path = os.path.join(output_dir, "dataset_stats.csv")
    df.describe().to_csv(stats_path)
    print(f"[INFO] Statistiques        → {stats_path}")


# ─────────────────────────────────────────────
# EXÉCUTION DIRECTE (test rapide)
# python data_generator.py
# ─────────────────────────────────────────────
if __name__ == "__main__":
    df, labels, anomaly_metadata = generate_dataset(
        days=30,
        freq_seconds=10,
        include_anomalies=True,
        anomaly_ratio=0.05
    )
    
    save_dataset(df, labels, anomaly_metadata, output_dir="data")
    
    # Afficher un aperçu
    print("\n── Aperçu des 3 premières lignes ──")
    print(df.head(3).to_string())
    
    print("\n── Statistiques descriptives ──")
    print(df.describe().round(2).to_string())
    
    # Anomalies injectées
    if anomaly_metadata is not None:
        print("\n── Résumé des anomalies ──")
        print(f"Total points anormaux : {labels.sum()} / {len(labels)}")
        print(f"Sévérité moyenne : {anomaly_metadata['severity'].mean():.3f}")
        print(f"\nDuration moyenne (points) : {anomaly_metadata['duration_points'].mean():.1f}")
        print(f"\nTypes d'anomalies :")
        print(anomaly_metadata["type"].value_counts())