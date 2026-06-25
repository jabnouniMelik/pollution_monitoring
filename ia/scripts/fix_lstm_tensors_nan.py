"""
Régénère lstm_train_val_test.pkl sans NaN.
Cause : SO2/PM1 absents du CSV, T/H non fusionnés ; MinMaxScaler sur colonnes NaN.
"""
from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import LSTM_CONFIG, LSTM_FEATURE_NAMES, N_FEATURES
from lstm_training import (
    concat_splits,
    fit_winsor_bounds,
    scale_splits,
    temporal_split,
    winsorize_array,
)

DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"

LOOKBACK = LSTM_CONFIG["lookback"]
HORIZONS = LSTM_CONFIG.get("horizons_hourly", [LSTM_CONFIG["horizon_short"]])
TIMESTEP_MINUTES = LSTM_CONFIG["timestep_minutes"]

POLLUTANT_ALIASES = {
    "NO2": "NOX", "NOx": "NOX", "NOX": "NOX",
    "SO2": "SOX", "SOX": "SOX", "SULFUR DIOXIDE": "SOX",
    "PM2.5": "PM25", "PM25": "PM25", "PM10": "PM10", "PM1": "PM25",
    "CO2": "CO2", "COV": "COV", "VOC": "COV", "NMOC": "COV",
    "TEMPERATURE": "TEMPERATURE", "TEMP": "TEMPERATURE", "T": "TEMPERATURE",
    "HUMIDITY": "HUMIDITY", "RH": "HUMIDITY",
}


def load_hourly_wide(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
    df["pollutant"] = df["pollutant"].astype(str).str.upper().replace(POLLUTANT_ALIASES)

    if "site_id" not in df.columns:
        df["site_id"] = "default"

    frames = []
    for site_id, site_df in df.groupby("site_id"):
        wide = site_df.pivot_table(
            index="timestamp_utc", columns="pollutant", values="value", aggfunc="mean"
        )
        wide = wide.resample("1h").mean()

        if "temperature_c" in site_df.columns:
            meteo = site_df.groupby("timestamp_utc").agg(
                temperature_c=("temperature_c", "mean"),
                humidity_percent=("humidity_percent", "mean"),
            )
            meteo = meteo.resample("1h").mean()
            wide["TEMPERATURE"] = meteo["temperature_c"]
            wide["HUMIDITY"] = meteo["humidity_percent"]

        for col in LSTM_FEATURE_NAMES:
            if col not in wide.columns:
                wide[col] = np.nan

        wide = wide[LSTM_FEATURE_NAMES]
        wide = wide.interpolate(method="linear", limit=6).ffill().bfill()
        for col in LSTM_FEATURE_NAMES:
            med = wide[col].median()
            wide[col] = wide[col].fillna(med if pd.notna(med) else 0.0)

        wide["site_id"] = str(site_id)
        frames.append(wide.reset_index())

    return pd.concat(frames, ignore_index=True)


def build_windows(matrix: np.ndarray, lookback: int, horizon: int):
    X, y = [], []
    n = len(matrix)
    for i in range(n - lookback - horizon + 1):
        window_x = matrix[i : i + lookback]
        window_y = matrix[i + lookback : i + lookback + horizon]
        if np.isfinite(window_x).all() and np.isfinite(window_y).all():
            X.append(window_x)
            y.append(window_y)
    if not X:
        return (
            np.empty((0, lookback, matrix.shape[1]), dtype=np.float32),
            np.empty((0, horizon, matrix.shape[1]), dtype=np.float32),
        )
    return np.asarray(X, dtype=np.float32), np.asarray(y, dtype=np.float32)


def main():
    input_file = DATA_DIR / "training_dataset.csv"
    output_file = DATA_DIR / "lstm_train_val_test.pkl"
    metadata_file = DATA_DIR / "lstm_metadata.json"
    scalers_file = MODELS_DIR / "lstm_scalers.pkl"

    print("Chargement", input_file)
    hourly_df = load_hourly_wide(input_file)
    print(f"Lignes: {len(hourly_df):,} | Sites: {hourly_df['site_id'].nunique()}")

    scalers = {}
    combined_tensors = {}
    window_counts = {}

    train_ratio = LSTM_CONFIG["train_ratio"]
    val_ratio = LSTM_CONFIG["val_ratio"]
    winsor_lo = LSTM_CONFIG.get("winsorize_lower_pct", 1.0)
    winsor_hi = LSTM_CONFIG.get("winsorize_upper_pct", 99.0)

    for horizon in HORIZONS:
        splits_per_site = []
        window_counts[horizon] = {}
        for site_id, site_df in hourly_df.groupby("site_id"):
            matrix = site_df[LSTM_FEATURE_NAMES].values.astype(np.float32)
            X_s, y_s = build_windows(matrix, LOOKBACK, horizon)
            if len(X_s) < 100:
                continue
            splits_per_site.append(temporal_split(X_s, y_s, train_ratio, val_ratio))
            window_counts[horizon][site_id] = len(X_s)

        if not splits_per_site:
            raise ValueError(f"Pas assez de fenêtres pour horizon={horizon}h")

        (X_train, y_train), (X_val, y_val), (X_test, y_test) = concat_splits(splits_per_site)
        assert np.isfinite(X_train).all() and np.isfinite(y_train).all()

        bounds = fit_winsor_bounds([X_train, y_train], N_FEATURES, winsor_lo, winsor_hi)
        X_train = winsorize_array(X_train, *bounds, N_FEATURES)
        y_train = winsorize_array(y_train, *bounds, N_FEATURES)
        X_val = winsorize_array(X_val, *bounds, N_FEATURES)
        y_val = winsorize_array(y_val, *bounds, N_FEATURES)
        X_test = winsorize_array(X_test, *bounds, N_FEATURES)
        y_test = winsorize_array(y_test, *bounds, N_FEATURES)

        X_train, y_train, X_val, y_val, X_test, y_test, scaler = scale_splits(
            X_train, y_train, X_val, y_val, X_test, y_test, N_FEATURES
        )
        scalers[horizon] = scaler
        combined_tensors[horizon] = {
            "train": (X_train, y_train),
            "val": (X_val, y_val),
            "test": (X_test, y_test),
        }
        print(f"Horizon {horizon}h: train={X_train.shape}")

    metadata = {
        "timestep_minutes": TIMESTEP_MINUTES,
        "lookback": LOOKBACK,
        "horizons": HORIZONS,
        "pollutant_names": LSTM_FEATURE_NAMES,
        "n_features": N_FEATURES,
        "window_counts": window_counts,
    }
    lstm_data = {
        "combined_tensors": combined_tensors,
        "scalers": scalers,
        "lookback": LOOKBACK,
        "horizons": HORIZONS,
        "timestep_minutes": TIMESTEP_MINUTES,
        "pollutant_names": LSTM_FEATURE_NAMES,
        "metadata": metadata,
    }

    h = HORIZONS[0]
    joblib.dump({"scaler": scalers[h], "winsor_bounds": bounds}, scalers_file)
    with open(output_file, "wb") as f:
        pickle.dump(lstm_data, f)
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("OK", output_file)


if __name__ == "__main__":
    main()
