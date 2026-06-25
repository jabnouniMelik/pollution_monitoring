"""Smoke test LSTM4HPredictor (après re-run notebooks 05 + 06)."""
import sys
from pathlib import Path

import numpy as np

IA_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(IA_ROOT))

from inference import LSTM4HPredictor  # noqa: E402


def main() -> None:
    pred = LSTM4HPredictor(horizon_hours=4)
    lookback = pred.lookback
    rng = np.random.default_rng(0)
    matrix = rng.uniform(0.2, 0.8, size=(lookback, pred.n_output)).astype(np.float32)
    ts = None
    if pred.use_calendar:
        ts = np.datetime64("2025-01-01T00:00:00") + np.arange(
            lookback, dtype="timedelta64[h]"
        )
    out = pred.predict(matrix, ts)
    print("go_deploy:", out["go_deploy"])
    co2 = out["forecasts"][0]["pollutants"]["CO2"]
    print("CO2 +1h:", co2["prediction_source"], co2["value_normalized"])


if __name__ == "__main__":
    main()
