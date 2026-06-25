"""
Retrain LSTM 4h model on the new industrial dataset.
Equivalent to running notebooks 05 + 06 sequentially.
"""
from __future__ import annotations

import importlib
import json
import pickle
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import config as config_module
import lstm_training as lstm_training_module

importlib.reload(config_module)
importlib.reload(lstm_training_module)

from config import (
    LSTM_CONFIG,
    LSTM_FEATURE_NAMES,
    N_OUTPUT_FEATURES,
    lstm_input_feature_count,
)
from lstm_training import (
    build_windows,
    concat_splits_with_test_sites,
    fit_winsor_bounds,
    scale_splits,
    temporal_split,
    winsorize_X_pollutants,
    winsorize_array,
    build_lstm_model,
    compile_lstm_model,
    training_callbacks,
    persistence_baseline,
    clip_predictions,
    build_skill_report,
    evaluate_forecast,
    artifact_paths_4h,
    plot_skill_mae_bars,
)

DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
POLLUTANT_NAMES = LSTM_FEATURE_NAMES
N_INPUT_FEATURES = lstm_input_feature_count()
USE_CALENDAR = LSTM_CONFIG.get("use_calendar_features", False)

LOOKBACK = LSTM_CONFIG["lookback"]
HORIZON = LSTM_CONFIG["horizon_short"]
WINSOR_LO = LSTM_CONFIG.get("winsorize_lower_pct", 1.0)
WINSOR_HI = LSTM_CONFIG.get("winsorize_upper_pct", 99.0)

POLLUTANT_ALIASES = {
    "NO2": "NOX", "NOx": "NOX", "NOX": "NOX",
    "SO2": "SOX", "SOX": "SOX",
    "PM2.5": "PM25", "PM25": "PM25", "PM10": "PM10",
    "CO2": "CO2", "COV": "COV", "VOC": "COV",
    "TEMPERATURE": "TEMPERATURE", "TEMP": "TEMPERATURE",
    "HUMIDITY": "HUMIDITY", "RH": "HUMIDITY",
}


def load_hourly_wide(csv_path: Path) -> pd.DataFrame:
    """Long format -> pivot -> hourly resample per site."""
    df = pd.read_csv(csv_path)
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
    df["pollutant"] = df["pollutant"].astype(str).str.upper().replace(POLLUTANT_ALIASES)

    site_col = "site_id" if "site_id" in df.columns else None
    if site_col is None:
        df["site_id"] = "default"
        site_col = "site_id"

    frames = []
    for site_id, site_df in df.groupby(site_col):
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

        for col in POLLUTANT_NAMES:
            if col not in wide.columns:
                wide[col] = np.nan
        wide = wide[POLLUTANT_NAMES]
        wide = wide.interpolate(method="linear", limit=6).ffill().bfill()
        for col in POLLUTANT_NAMES:
            med = wide[col].median()
            wide[col] = wide[col].fillna(med if pd.notna(med) else 0.0)
        wide["site_id"] = str(site_id)
        frames.append(wide.reset_index())

    return pd.concat(frames, ignore_index=True)


def main():
    print("=" * 60)
    print("PHASE 1: TENSOR PREPARATION (notebook 05)")
    print("=" * 60)

    input_file = DATA_DIR / "training_dataset.csv"
    print(f"Loading: {input_file}")
    hourly_df = load_hourly_wide(input_file)
    print(f"Hourly rows: {len(hourly_df):,} | Sites: {hourly_df['site_id'].nunique()}")

    train_ratio = LSTM_CONFIG["train_ratio"]
    val_ratio = LSTM_CONFIG["val_ratio"]

    splits_per_site = []
    site_ids_order = []
    window_counts = {}

    for site_id, site_df in hourly_df.groupby("site_id"):
        site_df = site_df.sort_values("timestamp_utc")
        matrix = site_df[POLLUTANT_NAMES].values.astype(np.float32)
        ts = site_df["timestamp_utc"].values if USE_CALENDAR else None
        X_s, y_s = build_windows(
            matrix, LOOKBACK, HORIZON, timestamps=ts, n_pollutant_features=N_OUTPUT_FEATURES
        )
        if len(X_s) < 100:
            print(f"  Skip {site_id} ({len(X_s)} windows < 100)")
            continue
        site_ids_order.append(str(site_id))
        splits_per_site.append(temporal_split(X_s, y_s, train_ratio, val_ratio))
        window_counts[site_id] = len(X_s)

    if not splits_per_site:
        raise ValueError("Not enough windows for training!")

    (X_train, y_train), (X_val, y_val), (X_test, y_test), test_site_ids = (
        concat_splits_with_test_sites(splits_per_site, site_ids_order)
    )

    bounds = fit_winsor_bounds(
        [X_train[:, :, :N_OUTPUT_FEATURES], y_train],
        N_OUTPUT_FEATURES,
        lower_q=WINSOR_LO,
        upper_q=WINSOR_HI,
    )
    X_train = winsorize_X_pollutants(X_train, *bounds, N_OUTPUT_FEATURES)
    y_train = winsorize_array(y_train, *bounds, N_OUTPUT_FEATURES)
    X_val = winsorize_X_pollutants(X_val, *bounds, N_OUTPUT_FEATURES)
    y_val = winsorize_array(y_val, *bounds, N_OUTPUT_FEATURES)
    X_test = winsorize_X_pollutants(X_test, *bounds, N_OUTPUT_FEATURES)
    y_test = winsorize_array(y_test, *bounds, N_OUTPUT_FEATURES)

    X_train, y_train, X_val, y_val, X_test, y_test, scaler = scale_splits(
        X_train, y_train, X_val, y_val, X_test, y_test, N_OUTPUT_FEATURES
    )
    print(f"Tensors: train={X_train.shape}, val={X_val.shape}, test={X_test.shape}")
    print(f"  NaN in train: {np.isnan(X_train).sum()}")

    scalers_file = MODELS_DIR / "lstm_scalers.pkl"
    joblib.dump({"scaler": scaler, "winsor_bounds": bounds}, scalers_file)
    print(f"Saved scalers: {scalers_file}")

    # Save tensors for potential later use
    pkl_file = DATA_DIR / "lstm_train_val_test.pkl"
    with open(pkl_file, "wb") as f:
        pickle.dump(
            {
                "combined_tensors": {
                    HORIZON: {
                        "train": (X_train, y_train),
                        "val": (X_val, y_val),
                        "test": (X_test, y_test),
                        "test_site_ids": test_site_ids,
                    }
                }
            },
            f,
            protocol=4,
        )
    print(f"Saved tensors: {pkl_file} ({pkl_file.stat().st_size / 1e6:.1f} MB)")

    # Metadata
    metadata = {
        "lookback": LOOKBACK,
        "horizons": [HORIZON],
        "pollutant_names": POLLUTANT_NAMES,
        "n_output_features": N_OUTPUT_FEATURES,
        "n_input_features": N_INPUT_FEATURES,
        "n_sites": len(site_ids_order),
        "sites": site_ids_order,
        "dataset": "industrial_hybrid_tunisian",
    }
    meta_file = DATA_DIR / "lstm_metadata.json"
    with open(meta_file, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata: {meta_file}")

    # ──────────────────────────────────────────
    print("\n" + "=" * 60)
    print("PHASE 2: LSTM TRAINING (notebook 06)")
    print("=" * 60)

    import tensorflow as tf
    print(f"TensorFlow: {tf.__version__}")
    print(f"GPU available: {len(tf.config.list_physical_devices('GPU'))}")

    model = build_lstm_model(
        lookback=LOOKBACK,
        horizon=HORIZON,
        n_input_features=N_INPUT_FEATURES,
        n_output_features=N_OUTPUT_FEATURES,
        config=LSTM_CONFIG,
    )
    compile_lstm_model(model, LSTM_CONFIG, POLLUTANT_NAMES)
    model.summary()

    paths = artifact_paths_4h(MODELS_DIR)

    checkpoint_path = MODELS_DIR / "model_lstm_4h_best.keras"
    cbs = training_callbacks(
        LSTM_CONFIG,
        checkpoint_path=checkpoint_path,
        X_val=X_val,
        y_val=y_val,
        horizon=HORIZON,
    )

    print(f"\nTraining: epochs={LSTM_CONFIG['epochs']}, batch={LSTM_CONFIG['batch_size']}")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=LSTM_CONFIG["epochs"],
        batch_size=LSTM_CONFIG["batch_size"],
        callbacks=cbs,
        verbose=1,
    )

    # Save history
    hist_dict = {k: [float(v) for v in vals] for k, vals in history.history.items()}
    with open(paths["history"], "w") as f:
        json.dump(hist_dict, f, indent=2)

    # Save model in both formats
    model.save(str(paths["model"]))
    keras_path = MODELS_DIR / "model_lstm_4h.keras"
    model.save(str(keras_path))
    print(f"Model saved: {paths['model']} + {keras_path}")

    # ──────────────────────────────────────────
    print("\n" + "=" * 60)
    print("PHASE 3: EVALUATION")
    print("=" * 60)

    y_pred = clip_predictions(model.predict(X_test, verbose=0))
    y_pers = persistence_baseline(X_test, HORIZON, N_OUTPUT_FEATURES)

    test_metrics = evaluate_forecast(y_test, y_pred)
    pers_metrics = evaluate_forecast(y_test, y_pers)
    print(f"LSTM  - MAE: {test_metrics['mae']:.4f}, R2: {test_metrics['r2_score']:.4f}")
    print(f"Pers  - MAE: {pers_metrics['mae']:.4f}, R2: {pers_metrics['r2_score']:.4f}")

    skill_report = build_skill_report(
        y_test, y_pred, y_pers, POLLUTANT_NAMES, test_site_ids
    )
    global_skill = skill_report["global"]["skill"]
    print(f"Global skill: {global_skill:.4f}")

    print("\nPer-pollutant skill:")
    for p, s in skill_report["per_pollutant_skill"].items():
        status = "OK" if s > 0 else "NEGATIVE"
        print(f"  {p}: {s:.4f} [{status}]")

    # Save skill report
    with open(paths["skill_report"], "w") as f:
        json.dump(skill_report, f, indent=2, default=str)

    # Save metrics
    metrics_out = {
        "test": test_metrics,
        "persistence": pers_metrics,
        "global_skill": global_skill,
        "per_pollutant_skill": skill_report["per_pollutant_skill"],
        "dataset": "industrial_hybrid_tunisian",
    }
    with open(paths["metrics"], "w") as f:
        json.dump(metrics_out, f, indent=2)
    print(f"\nSaved: {paths['metrics']}")

    # Plot skill bars
    try:
        plot_skill_mae_bars(skill_report, paths["skill_chart"], title="LSTM 4h - Industrial Dataset")
        print(f"Saved chart: {paths['skill_chart']}")
    except Exception as e:
        print(f"Chart generation skipped: {e}")

    print("\n" + "=" * 60)
    print("DONE - All artifacts updated")
    print("=" * 60)


if __name__ == "__main__":
    main()
