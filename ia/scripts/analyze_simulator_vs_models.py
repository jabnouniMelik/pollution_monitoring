"""
Compare LSTM/IF outputs built from simulator-like hourly buckets vs raw reading stats.
Uses MongoDB readings (last 48h) when available; falls back to synthetic 48h from SIM baselines.
"""
from __future__ import annotations

import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import LSTM_FEATURE_NAMES  # noqa: E402

SIM_BASELINE = {
    "CO2": 650,
    "NOX": 680,
    "SOX": 340,
    "PM25": 17,
    "PM10": 20.4,
    "COV": 90,
    "TEMPERATURE": 25,
    "HUMIDITY": 50,
}

DB_TO_LSTM = {"CO2": "CO2", "NOX": "NOX", "SO2": "SOX", "PM25": "PM25", "COV": "COV"}


def synthetic_48h_matrix(zone_mult: float = 1.0) -> np.ndarray:
    rows = []
    for h in range(48):
        wave = np.sin(h / 6)
        row = []
        for name in LSTM_FEATURE_NAMES:
            base = SIM_BASELINE[name] * zone_mult
            noise = 1 + 0.05 * (np.random.random() - 0.5)
            row.append(float(base * (1 + 0.08 * wave) * noise))
        rows.append(row)
    return np.array(rows, dtype=np.float32)


def main() -> None:
    from inference import LSTM4HPredictor
    from if_inference import IFAnomalyDetector

    print("=== Analyse modeles vs profil simulateur ===\n")

    # --- IF sur profil « normal » et « zone froide » ---
    if_det = IFAnomalyDetector()
    for label, mult in [("Site type Four (×1.0)", 1.0), ("Zone Broyage (×0.65)", 0.65)]:
        vec = [
            SIM_BASELINE["NOX"] * mult,
            SIM_BASELINE["SOX"] * mult,
            SIM_BASELINE["PM25"] * mult,
            SIM_BASELINE["PM10"] * mult,
            SIM_BASELINE["CO2"] * mult,
            SIM_BASELINE["COV"] * mult,
        ]
        out = if_det.detect(vec)
        print(f"IF {label}: {'ANOMALIE' if out['is_anomaly'] else 'NORMAL'} (score={out['anomaly_score']:.3f}, threshold={out['score_threshold']:.3f})")

    # --- LSTM sur matrices synthétiques ---
    lstm = LSTM4HPredictor(horizon_hours=4)
    for label, mult in [("Four ×1.0", 1.0), ("Broyage ×0.65", 0.65)]:
        X = synthetic_48h_matrix(mult)
        pred = lstm.predict(X)
        print(f"\nLSTM previsions -- {label} (derniere heure entree ~ baselines simulateur):")
        last_phys = {n: X[-1, i] for i, n in enumerate(LSTM_FEATURE_NAMES)}
        for step in pred["forecasts"]:
            print(f"  {step['step']}:")
            for name in ["CO2", "NOX", "SOX", "PM10", "PM25", "COV"]:
                p = step["pollutants"][name]
                inp = last_phys[name]
                out = p["value_physical"]
                delta_pct = 100 * (out - inp) / inp if inp else 0
                print(
                    f"    {name}: {out:.1f} [{p['prediction_source']}] "
                    f"(entree {inp:.1f}, delta {delta_pct:+.1f}%)"
                )

    # --- MongoDB optional ---
    try:
        from pymongo import MongoClient

        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGO_DB", "pollution_db")
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        db = client[db_name.split("/")[-1] if "/" not in db_name else db_name]

        readings = list(
            db.readings.find(
                {"timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(hours=6)}, "isValid": True},
                {"value": 1, "PolluantId": 1, "timestamp": 1},
            ).limit(5000)
        )
        polluants = {str(p["_id"]): p["name"] for p in db.polluants.find({}, {"name": 1})}
        by_name: dict[str, list[float]] = defaultdict(list)
        for r in readings:
            name = polluants.get(str(r.get("PolluantId")))
            if name:
                by_name[name].append(float(r["value"]))

        if by_name:
            print("\n### Lectures Mongo (6 h) vs baselines simulateur")
            for db_name, lstm_names in DB_TO_LSTM.items():
                vals = by_name.get(db_name, [])
                if not vals:
                    continue
                m = float(np.mean(vals))
                base = SIM_BASELINE.get(lstm_names, m)
                print(f"  {db_name}: moy={m:.1f} sim≈{base} → {(m/base*100):.0f}% baseline")
    except Exception as exc:
        print(f"\n(Mongo indisponible: {exc})")

    print("\n=== Fin ===")


if __name__ == "__main__":
    main()
