"""
Inférence Isolation Forest — détection d'anomalies multivariées (profil horaire site).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from config import IF_FEATURE_NAMES, IF_INTEGRATION, ISOLATION_FOREST, MODELS_DIR


class IFAnomalyDetector:
    """Charge IF + scaler + métriques ; score une ligne de features polluants."""

    def __init__(self, models_dir: Path | None = None) -> None:
        self.models_dir = models_dir or MODELS_DIR
        self.integration = IF_INTEGRATION

        model_path = Path(ISOLATION_FOREST["model_path"])
        scaler_path = Path(ISOLATION_FOREST["scaler_path"])
        if not model_path.is_file():
            raise FileNotFoundError(f"Modèle IF introuvable: {model_path}")
        if not scaler_path.is_file():
            raise FileNotFoundError(f"Scaler IF introuvable: {scaler_path}")

        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
        self.score_threshold = float(ISOLATION_FOREST["score_threshold"])
        self.feature_cols: list[str] = list(IF_FEATURE_NAMES)

        metrics_path = Path(ISOLATION_FOREST.get("metrics_path", ""))
        self.metrics: dict[str, Any] = {}
        if metrics_path.is_file():
            with open(metrics_path, encoding="utf-8") as f:
                self.metrics = json.load(f)
            cols = self.metrics.get("feature_cols")
            if cols:
                self.feature_cols = list(cols)

    def detect(
        self,
        feature_values: list[float] | np.ndarray,
        feature_cols: list[str] | None = None,
    ) -> dict[str, Any]:
        cols = feature_cols or self.feature_cols
        n = len(cols)
        arr = np.asarray(feature_values, dtype=np.float64).reshape(-1)
        if arr.shape[0] != n:
            raise ValueError(f"Attendu {n} valeurs ({cols}), reçu {arr.shape[0]}")

        if np.isnan(arr).any():
            raise ValueError("feature_values contient des NaN")

        X_scaled = self.scaler.transform(arr.reshape(1, -1))
        pred = int(self.model.predict(X_scaled)[0])
        score = float(self.model.decision_function(X_scaled)[0])
        is_anomaly = score < self.score_threshold

        severity = "Warning"
        if is_anomaly and score < self.score_threshold - 0.15:
            severity = "High"
        if is_anomaly and score < self.score_threshold - 0.3:
            severity = "Critical"

        return {
            "is_anomaly": bool(is_anomaly),
            "label": "anomaly" if is_anomaly else "normal",
            "prediction": pred,
            "anomaly_score": score,
            "score_threshold": self.score_threshold,
            "severity": severity if is_anomaly else None,
            "feature_cols": cols,
            "feature_values": [float(v) for v in arr],
            "alert_source": self.integration["alert_source"],
            "model": "isolation_forest",
        }


def get_if_detector() -> IFAnomalyDetector:
    return IFAnomalyDetector()
