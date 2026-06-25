"""
Inférence LSTM 4 h — Sprint 4 : prédiction hybride LSTM + persistance.

Charge modèle, scaler, winsor et rapport skill ; applique fallback par polluant.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from config import (
    LSTM_CALENDAR_FEATURE_NAMES,
    LSTM_CONFIG,
    LSTM_FEATURE_NAMES,
    LSTM_INTEGRATION,
    MODELS_DIR,
    N_OUTPUT_FEATURES,
    lstm_input_feature_count,
)
from lstm_training import (
    calendar_matrix_from_timestamps,
    clip_predictions,
    load_lstm_model_for_inference,
    persistence_baseline,
    winsorize_X_pollutants,
    winsorize_array,
)


class LSTM4HPredictor:
    """Prévision +1…+4 h avec source par polluant (LSTM | persistence | blend)."""

    def __init__(
        self,
        horizon_hours: int = 4,
        models_dir: Path | None = None,
    ) -> None:
        if horizon_hours not in LSTM_INTEGRATION:
            raise ValueError(f"horizon_hours={horizon_hours} non supporté")
        self.horizon_hours = horizon_hours
        self.integration = LSTM_INTEGRATION[horizon_hours]
        self.models_dir = models_dir or MODELS_DIR
        self.pollutant_names = list(LSTM_FEATURE_NAMES)
        self.n_output = N_OUTPUT_FEATURES
        self.n_input = lstm_input_feature_count()
        self.lookback = int(LSTM_CONFIG["lookback"])
        self.use_calendar = bool(LSTM_CONFIG.get("use_calendar_features"))

        scaler_path = self.models_dir / "lstm_scalers.pkl"
        pack = joblib.load(scaler_path)
        self.scaler = pack["scaler"]
        self.winsor_lo, self.winsor_hi = pack["winsor_bounds"]

        model_path = Path(self.integration["model_path"])
        if not model_path.is_file():
            raise FileNotFoundError(f"Modèle introuvable: {model_path}")
        self.model = load_lstm_model_for_inference(model_path)

        skill_path = Path(self.integration.get("skill_report_path", ""))
        self.per_pollutant_skill: dict[str, float] = {}
        self.go_deploy = True
        if skill_path.is_file():
            with open(skill_path, encoding="utf-8") as f:
                report = json.load(f)
            self.per_pollutant_skill = report.get("per_pollutant_skill", {})
            acc = report.get("acceptance", {})
            self.go_deploy = bool(acc.get("go_deploy", True))

        self.fallback = set(self.integration.get("fallback_pollutants", []))
        self.blend_alpha = dict(self.integration.get("blend_alpha_by_pollutant", {}))

    def denormalize_pollutant(self, name: str, norm_value: float) -> float:
        """Inverse MinMaxScaler pour une colonne (valeur physique estimée).
        MinMaxScaler(0,1): scaled = (X - data_min) / data_range
        Inverse: X = scaled * data_range + data_min
        """
        if name not in self.pollutant_names:
            raise ValueError(f"Polluant inconnu: {name}")
        idx = self.pollutant_names.index(name)
        return float(norm_value) * float(self.scaler.data_range_[idx]) + float(self.scaler.data_min_[idx])

    def _prepare_window(
        self,
        pollutant_matrix: np.ndarray,
        timestamps: np.ndarray | None,
    ) -> np.ndarray:
        """(1, lookback, n_input) normalisé."""
        if pollutant_matrix.shape != (self.lookback, self.n_output):
            raise ValueError(
                f"Attendu ({self.lookback}, {self.n_output}), reçu {pollutant_matrix.shape}"
            )
        X = pollutant_matrix.astype(np.float32)[np.newaxis, :, :]
        X = winsorize_X_pollutants(X, self.winsor_lo, self.winsor_hi, self.n_output)

        if self.use_calendar:
            if timestamps is None:
                raise ValueError("timestamps requis si use_calendar_features=True")
            cal = calendar_matrix_from_timestamps(timestamps)[np.newaxis, :, :]
            X = np.concatenate([X, cal], axis=2)

        flat = self.scaler.transform(X.reshape(-1, self.n_output))
        X[:, :, : self.n_output] = flat.reshape(1, self.lookback, self.n_output)
        return X.astype(np.float32)

    def predict(
        self,
        pollutant_matrix: np.ndarray,
        timestamps: np.ndarray | None = None,
    ) -> dict[str, Any]:
        """
        pollutant_matrix: (lookback, 8) valeurs brutes alignées LSTM_FEATURE_NAMES.
        timestamps: (lookback,) datetime si calendrier activé.
        """
        X = self._prepare_window(pollutant_matrix, timestamps)
        y_lstm = clip_predictions(
            self.model.predict(X, verbose=0)[0]
        )
        y_pers = persistence_baseline(X, self.horizon_hours, self.n_output)[0]

        steps = [f"+{h}h" for h in range(1, self.horizon_hours + 1)]
        forecasts: list[dict[str, Any]] = []

        for step_idx, step_label in enumerate(steps):
            step_pollutants: dict[str, Any] = {}
            for p_idx, name in enumerate(self.pollutant_names):
                lstm_v = float(y_lstm[step_idx, p_idx])
                pers_v = float(y_pers[step_idx, p_idx])
                skill = float(self.per_pollutant_skill.get(name, 0.0))
                alpha = float(self.blend_alpha.get(name, 1.0 if skill > 0 else 0.0))

                if name in self.fallback or skill <= 0:
                    source = "PERSISTENCE"
                    value = pers_v
                elif alpha >= 1.0:
                    source = "LSTM"
                    value = lstm_v
                else:
                    source = "blend"
                    value = float(alpha * lstm_v + (1.0 - alpha) * pers_v)

                step_pollutants[name] = {
                    "value_normalized": value,
                    "value_physical": self.denormalize_pollutant(name, value),
                    "lstm": lstm_v,
                    "persistence": pers_v,
                    "prediction_source": source,
                    "skill_at_train": skill,
                }
            forecasts.append({"step": step_label, "pollutants": step_pollutants})

        return {
            "horizon_hours": self.horizon_hours,
            "alert_source": self.integration["alert_source"],
            "go_deploy": self.go_deploy,
            "lookback_hours": self.lookback,
            "use_calendar_features": self.use_calendar,
            "forecasts": forecasts,
        }


def get_predictor(horizon_hours: int = 4) -> LSTM4HPredictor:
    return LSTM4HPredictor(horizon_hours=horizon_hours)
