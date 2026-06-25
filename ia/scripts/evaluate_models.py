"""
Évaluation consolidée IF + LSTM : métriques offline, tests comportementaux,
latence, API, cohérence simulateur.
Usage: python scripts/evaluate_models.py [--json report.json]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import LSTM_FEATURE_NAMES, IF_FEATURE_NAMES  # noqa: E402

MODELS = ROOT / "models"
DATA = ROOT / "data"

SIM_BASELINE = {
    "CO2": 650,
    "NOX": 400,    # ≈ 80% VLE Annexe 1 (500 mg/Nm³)
    "SOX": 240,    # ≈ 80% VLE Annexe 1 (300 mg/Nm³)
    "PM25": 32,    # ≈ 80% VLE Annexe 1 (40 µg/m³ — SDS011 mesure en µg/m³)
    "PM10": 38.4,
    "COV": 88,     # ≈ 80% VLE Annexe 1 (110 mg/Nm³)
    "TEMPERATURE": 25,
    "HUMIDITY": 50,
}

# VLEs réglementaires — Décret 2010-2519, Annexe 1 (valeurs générales)
# Applicables à toutes sources fixes industrielles tunisiennes.
TUNISIA_LIMITS = {
    "CO2":  800,    # ppm      — seuil interne (pas de VLE réglementaire)
    "NOX":  500,    # mg/Nm³   — Annexe 1, §4 (flux > 25 kg/h)
    "SOX":  300,    # mg/Nm³   — Annexe 1, §3 (flux > 25 kg/h)
    "PM25":  40,    # mg/m³    — Annexe 1, §1 (flux > 1 kg/h)
    "PM10":  40,    # mg/m³    — Annexe 1, §1 (flux > 1 kg/h)
    "COV":  110,    # mg/Nm³   — Annexe 1, §7 (flux > 2 kg/h)
}


def load_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def synthetic_matrix(hours: int = 48, mult: float = 1.0, seed: int = 42) -> np.ndarray:
    rng = np.random.default_rng(seed)
    rows = []
    for h in range(hours):
        wave = np.sin(h / 6)
        row = []
        for name in LSTM_FEATURE_NAMES:
            base = SIM_BASELINE[name] * mult
            noise = 1 + 0.05 * (rng.random() - 0.5)
            row.append(float(base * (1 + 0.08 * wave) * noise))
        rows.append(row)
    return np.array(rows, dtype=np.float32)


def if_vector(mult: float = 1.0, spike: dict | None = None) -> list[float]:
    vec = {
        "NOX": SIM_BASELINE["NOX"] * mult,
        "SOX": SIM_BASELINE["SOX"] * mult,
        "PM25": SIM_BASELINE["PM25"] * mult,
        "PM10": SIM_BASELINE["PM10"] * mult,
        "CO2": SIM_BASELINE["CO2"] * mult,
        "COV": SIM_BASELINE["COV"] * mult,
    }
    if spike:
        vec.update(spike)
    return [vec[n] for n in IF_FEATURE_NAMES]


def section_offline_metrics(report: dict) -> None:
    lstm_skill = load_json(MODELS / "lstm_4h_skill_report.json")
    lstm_metrics = load_json(MODELS / "lstm_4h_metrics.json")
    if_metrics = load_json(MODELS / "if_metrics.json")

    report["offline"] = {
        "lstm_skill_report": lstm_skill,
        "lstm_metrics": lstm_metrics,
        "if_metrics": if_metrics,
    }

    if lstm_metrics:
        gs = lstm_metrics.get("global_skill", 0)
        report["summary"]["lstm_global_skill_pct"] = round(gs * 100, 2)
        report["summary"]["lstm_beats_persistence"] = gs > 0
        pos = sum(1 for v in (lstm_metrics.get("per_pollutant_skill") or {}).values() if v > 0)
        report["summary"]["lstm_pollutants_positive_skill"] = pos

    if if_metrics:
        report["summary"]["if_contamination_target_pct"] = round(
            (if_metrics.get("contamination_param") or 0.05) * 100, 1
        )
        report["summary"]["if_test_anomaly_rate_pct"] = round(
            if_metrics.get("anomalies_detected_test_pct") or 0, 2
        )


def section_if_behavior(report: dict) -> None:
    from if_inference import IFAnomalyDetector

    det = IFAnomalyDetector()
    cases = [
        ("profil_normal_four", if_vector(1.0), False),
        ("profil_broyage_froid", if_vector(0.65), False),
        ("spike_nox_x5", if_vector(1.0, {"NOX": SIM_BASELINE["NOX"] * 5}), True),
        ("spike_multivarié", if_vector(1.0, {"NOX": 2000, "SOX": 900, "CO2": 1200}), True),
    ]
    results = []
    latencies = []
    for name, vec, expect_anomaly in cases:
        t0 = time.perf_counter()
        out = det.detect(vec)
        ms = (time.perf_counter() - t0) * 1000
        latencies.append(ms)
        ok = out["is_anomaly"] == expect_anomaly
        results.append(
            {
                "case": name,
                "expected_anomaly": expect_anomaly,
                "is_anomaly": out["is_anomaly"],
                "score": round(out["anomaly_score"], 4),
                "threshold": out["score_threshold"],
                "pass": ok,
                "latency_ms": round(ms, 2),
            }
        )
    report["if_behavior"] = results
    report["summary"]["if_behavior_pass"] = all(r["pass"] for r in results)
    report["summary"]["if_latency_ms_avg"] = round(float(np.mean(latencies)), 2)


def section_lstm_behavior(report: dict) -> None:
    from inference import LSTM4HPredictor

    lstm = LSTM4HPredictor(horizon_hours=4)
    profiles = [("four_x1", 1.0), ("broyage_x0.65", 0.65)]
    results = []
    latencies = []

    for name, mult in profiles:
        X = synthetic_matrix(48, mult)
        t0 = time.perf_counter()
        pred = lstm.predict(X)
        ms = (time.perf_counter() - t0) * 1000
        latencies.append(ms)

        last = {n: float(X[-1, i]) for i, n in enumerate(LSTM_FEATURE_NAMES)}
        step4 = pred["forecasts"][-1]
        checks = []
        for pol in ["CO2", "NOX", "SOX", "PM25", "COV"]:
            phys = step4["pollutants"][pol]["value_physical"]
            inp = last[pol]
            delta_pct = 100 * (phys - inp) / inp if inp else 0
            limit = TUNISIA_LIMITS.get(pol)
            checks.append(
                {
                    "pollutant": pol,
                    "input": round(inp, 2),
                    "forecast_4h": round(phys, 2),
                    "delta_pct": round(delta_pct, 1),
                    "source": step4["pollutants"][pol]["prediction_source"],
                    "within_regulatory": limit is None or phys <= limit * 1.5,
                    "physically_plausible": 0 < phys < limit * 3 if limit else phys > 0,
                }
            )

        plausible = all(c["physically_plausible"] for c in checks)
        results.append(
            {
                "profile": name,
                "go_deploy": pred.get("go_deploy"),
                "latency_ms": round(ms, 2),
                "step4_checks": checks,
                "pass": plausible and pred.get("go_deploy", False),
            }
        )

    report["lstm_behavior"] = results
    report["summary"]["lstm_behavior_pass"] = all(r["pass"] for r in results)
    report["summary"]["lstm_latency_ms_avg"] = round(float(np.mean(latencies)), 2)


def section_holdout_sample(report: dict) -> None:
    """Évalue un échantillon du jeu test (pkl) si disponible."""
    pkl_path = DATA / "lstm_train_val_test.pkl"
    if not pkl_path.exists():
        report["holdout"] = {"skipped": True, "reason": "pkl missing"}
        return

    import pickle

    from inference import LSTM4HPredictor

    with open(pkl_path, "rb") as f:
        data = pickle.load(f)

    X_test = data.get("X_test")
    y_test = data.get("y_test")
    if X_test is None or y_test is None:
        report["holdout"] = {"skipped": True, "reason": "no test split"}
        return

    lstm = LSTM4HPredictor(horizon_hours=4)
    n = min(32, len(X_test))
    idx = np.linspace(0, len(X_test) - 1, n, dtype=int)

    maes = []
    for i in idx:
        X = np.array(X_test[i], dtype=np.float32)
        y_true = np.array(y_test[i], dtype=np.float32)
        pred = lstm.predict(X)
        y_pred = []
        for step in pred["forecasts"]:
            row = [step["pollutants"][n]["value_normalized"] for n in LSTM_FEATURE_NAMES]
            y_pred.append(row)
        y_pred = np.array(y_pred, dtype=np.float32)
        maes.append(float(np.mean(np.abs(y_pred - y_true))))

    report["holdout"] = {
        "n_samples": int(n),
        "mae_normalized_mean": round(float(np.mean(maes)), 4),
        "mae_normalized_std": round(float(np.std(maes)), 4),
        "pass": float(np.mean(maes)) < 0.25,
    }
    report["summary"]["holdout_mae_norm"] = report["holdout"]["mae_normalized_mean"]


def section_api(report: dict) -> None:
    base = "http://127.0.0.1:8000"
    results = {"reachable": False}

    try:
        t0 = time.perf_counter()
        with urllib.request.urlopen(f"{base}/health", timeout=5) as r:
            health = json.loads(r.read())
        results["health_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        results["health"] = health
        results["reachable"] = True
    except Exception as exc:
        report["api"] = {"reachable": False, "error": str(exc)}
        report["summary"]["api_ok"] = False
        return

    rows = synthetic_matrix(48).tolist()
    body = json.dumps({"horizon_hours": 4, "lookback_values": rows}).encode()
    req = urllib.request.Request(
        f"{base}/predict",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    try:
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=60) as r:
            pred = json.loads(r.read())
        results["predict_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        results["go_deploy"] = pred.get("go_deploy")
        results["n_steps"] = len(pred.get("forecasts", []))
    except Exception as exc:
        results["predict_error"] = str(exc)

    if_vec = if_vector(1.0)
    body = json.dumps({"feature_values": if_vec, "feature_cols": IF_FEATURE_NAMES}).encode()
    req = urllib.request.Request(
        f"{base}/detect",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    try:
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=30) as r:
            det = json.loads(r.read())
        results["detect_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        results["detect_normal"] = not det.get("is_anomaly")
    except Exception as exc:
        results["detect_error"] = str(exc)

    report["api"] = results
    report["summary"]["api_ok"] = (
        results.get("reachable")
        and results.get("go_deploy")
        and results.get("detect_normal") is not False
    )


def section_mongo_live(report: dict) -> None:
    try:
        from pymongo import MongoClient
    except ImportError:
        report["mongo_live"] = {"skipped": True}
        return

    uri = __import__("os").getenv("MONGO_URI", "mongodb://localhost:27017/pollution_db")
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=4000)
        db_name = uri.rsplit("/", 1)[-1] or "pollution_db"
        db = client[db_name]
        client.admin.command("ping")

        since = datetime.now(timezone.utc) - timedelta(hours=6)
        readings = list(
            db.readings.find(
                {"timestamp": {"$gte": since}, "isValid": True},
                {"value": 1, "PolluantId": 1},
            ).limit(8000)
        )
        polluants = {str(p["_id"]): p["name"] for p in db.polluants.find({}, {"name": 1})}
        by_name: dict[str, list[float]] = {}
        for r in readings:
            name = polluants.get(str(r.get("PolluantId")))
            if name:
                by_name.setdefault(name, []).append(float(r["value"]))

        sim_compare = []
        mapping = {"CO2": "CO2", "NOX": "NOX", "SO2": "SOX", "PM25": "PM25", "COV": "COV"}
        for db_name, lstm_name in mapping.items():
            vals = by_name.get(db_name, [])
            if not vals:
                continue
            m = float(np.mean(vals))
            base = SIM_BASELINE[lstm_name]
            sim_compare.append(
                {
                    "pollutant": db_name,
                    "mongo_mean_6h": round(m, 2),
                    "sim_baseline": base,
                    "ratio_pct": round(100 * m / base, 1),
                }
            )

        forecasts = list(
            db.lstmforecasts.find().sort("runAt", -1).limit(5)
        )
        anomalies = list(
            db.anomalydetections.find().sort("periodStart", -1).limit(5)
        )

        report["mongo_live"] = {
            "readings_6h": len(readings),
            "simulator_alignment": sim_compare,
            "latest_forecasts": len(forecasts),
            "latest_anomalies": len(anomalies),
            "recent_anomaly_flags": sum(1 for a in anomalies if a.get("isAnomaly")),
        }
        report["summary"]["mongo_readings_6h"] = len(readings)
    except Exception as exc:
        report["mongo_live"] = {"error": str(exc)}


def print_report(report: dict) -> None:
    s = report["summary"]
    print("\n" + "=" * 60)
    print("  RAPPORT EVALUATION IA — EmissionsIQ")
    print("=" * 60)
    print(f"  Date: {report['generated_at']}")
    print()
    print("--- Métriques entraînement (offline) ---")
    if "lstm_global_skill_pct" in s:
        print(f"  LSTM skill global vs persistance: {s['lstm_global_skill_pct']:+.2f} %")
        print(f"  Polluants skill > 0: {s.get('lstm_pollutants_positive_skill', '?')}/8")
    if "if_test_anomaly_rate_pct" in s:
        print(
            f"  IF taux anomalies test: {s['if_test_anomaly_rate_pct']:.1f} % "
            f"(cible ~{s.get('if_contamination_target_pct', 5)} %)"
        )
    print()
    print("--- Tests comportementaux ---")
    print(f"  IF cas passés: {s.get('if_behavior_pass')} (latence ~{s.get('if_latency_ms_avg')} ms)")
    print(f"  LSTM profils passés: {s.get('lstm_behavior_pass')} (latence ~{s.get('lstm_latency_ms_avg')} ms)")
    if "holdout_mae_norm" in s:
        print(f"  Holdout MAE normalisé ({report['holdout'].get('n_samples')} échant.): {s['holdout_mae_norm']}")
    print(f"  API FastAPI OK: {s.get('api_ok')}")
    if s.get("mongo_readings_6h"):
        print(f"  Lectures Mongo 6h: {s['mongo_readings_6h']}")

    if report.get("if_behavior"):
        print("\n--- Détail IF ---")
        for r in report["if_behavior"]:
            status = "OK" if r["pass"] else "FAIL"
            print(
                f"  [{status}] {r['case']}: anomaly={r['is_anomaly']} "
                f"score={r['score']:.3f} (seuil {r['threshold']:.3f})"
            )

    if report.get("lstm_behavior"):
        print("\n--- Détail LSTM (+4h, profil Four) ---")
        four = next((x for x in report["lstm_behavior"] if "four" in x["profile"]), None)
        if four:
            for c in four["step4_checks"]:
                print(
                    f"  {c['pollutant']}: {c['forecast_4h']} ({c['source']}) "
                    f"delta {c['delta_pct']:+.1f}%"
                )

    if report.get("mongo_live", {}).get("simulator_alignment"):
        print("\n--- Alignement simulateur (6h Mongo) ---")
        for row in report["mongo_live"]["simulator_alignment"]:
            print(
                f"  {row['pollutant']}: moy={row['mongo_mean_6h']} "
                f"vs baseline {row['sim_baseline']} ({row['ratio_pct']}%)"
            )

    all_pass = (
        s.get("if_behavior_pass")
        and s.get("lstm_behavior_pass")
        and (s.get("lstm_global_skill_pct", 0) > 0)
    )
    print()
    print("=" * 60)
    print(f"  VERDICT GLOBAL: {'PASS' if all_pass else 'ATTENTION — voir détails'}")
    print("=" * 60 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=str, default=str(MODELS / "evaluation_report.json"))
    args = parser.parse_args()

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {},
    }

    section_offline_metrics(report)
    section_if_behavior(report)
    section_lstm_behavior(report)
    section_holdout_sample(report)
    section_api(report)
    section_mongo_live(report)

    out = Path(args.json)
    out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print_report(report)
    print(f"Rapport JSON: {out}")


if __name__ == "__main__":
    main()
