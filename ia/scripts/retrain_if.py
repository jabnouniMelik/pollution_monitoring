"""Retrain Isolation Forest on the new industrial dataset."""
import sys
from pathlib import Path

import joblib
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "data"

def main():
    df = pd.read_csv(DATA_DIR / "training_dataset.csv")
    print(f"Loaded: {len(df)} rows, {df['site_id'].nunique()} sites")

    df_pivot = df.pivot_table(
        index=["timestamp_utc", "site_id"],
        columns="pollutant",
        values="value",
        aggfunc="mean",
    )
    df_pivot = df_pivot.fillna(df_pivot.mean()).sort_index()

    feature_cols = [c for c in ["NOX", "SOX", "PM25", "PM10", "CO2", "COV"] if c in df_pivot.columns]
    X = df_pivot[feature_cols].values
    print(f"Features: {X.shape[0]} samples x {X.shape[1]} ({feature_cols})")
    for i, col in enumerate(feature_cols):
        print(f"  {col}: mean={X[:, i].mean():.2f}, std={X[:, i].std():.2f}")

    scaler_if = StandardScaler()
    X_scaled = scaler_if.fit_transform(X)

    n = len(X_scaled)
    idx_train = int(0.70 * n)
    idx_val = int(0.85 * n)
    X_train = X_scaled[:idx_train]
    X_val = X_scaled[idx_train:idx_val]
    X_test = X_scaled[idx_val:]
    print(f"Split: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")

    model_if = IsolationForest(
        n_estimators=100, contamination=0.05, max_samples="auto", random_state=42
    )
    model_if.fit(X_train)
    print("IF trained")

    y_val_pred = model_if.predict(X_val)
    y_test_pred = model_if.predict(X_test)
    n_anom_val = int((y_val_pred == -1).sum())
    n_anom_test = int((y_test_pred == -1).sum())
    print(f"Val anomalies: {n_anom_val} ({n_anom_val / len(X_val) * 100:.1f}%)")
    print(f"Test anomalies: {n_anom_test} ({n_anom_test / len(X_test) * 100:.1f}%)")

    joblib.dump(model_if, MODELS_DIR / "model_isolation_forest.pkl")
    joblib.dump(scaler_if, MODELS_DIR / "if_scaler.pkl")

    metrics = {
        "anomalies_detected_val_pct": float(n_anom_val / len(X_val) * 100),
        "anomalies_detected_test_pct": float(n_anom_test / len(X_test) * 100),
        "contamination_param": 0.05,
        "feature_cols": feature_cols,
        "n_train": int(len(X_train)),
        "n_val": int(len(X_val)),
        "n_test": int(len(X_test)),
        "dataset": "industrial_hybrid_tunisian",
    }
    with open(MODELS_DIR / "if_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("Saved: model_isolation_forest.pkl, if_scaler.pkl, if_metrics.json")

    # Quick sanity: test simulator-like profile
    sim_vector = np.array([[680, 340, 17, 20.4, 650, 90]])  # NOX, SOX, PM25, PM10, CO2, COV
    sim_scaled = scaler_if.transform(sim_vector)
    pred = model_if.predict(sim_scaled)[0]
    score = model_if.decision_function(sim_scaled)[0]
    print(f"\nSanity check (simulator Four profile): pred={'anomaly' if pred == -1 else 'normal'}, score={score:.4f}")


if __name__ == "__main__":
    main()
