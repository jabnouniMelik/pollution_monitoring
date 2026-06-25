"""
Generateur de dataset hybride industriel tunisien.

Produit un CSV au format attendu par notebook 05 (training_dataset.csv),
calibre sur les profils du simulateur Node.js (backend/simulator.js)
et les VLEs du Décret 2010-2519, Annexe 1 (valeurs générales — toutes
sources fixes industrielles tunisiennes).

Usage:
    python generate_industrial_dataset.py [--days 90] [--sites 6] [--output data/training_dataset.csv]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

# ─────────────────────────────────────────────
# CONFIGURATION ALIGNEE SUR simulator.js + Décret 2010-2519, Annexe 1
# ─────────────────────────────────────────────

# Colonnes LSTM (ia/config.py LSTM_FEATURE_NAMES)
FEATURE_NAMES = ["CO2", "NOX", "SOX", "PM25", "PM10", "COV", "TEMPERATURE", "HUMIDITY"]

# Baselines nominales — zone "Four" (multiplicateur 1.0)
# Alignées sur backend/simulator.js PROFILES (Décret 2010-2519, Annexe 1) :
#   ≈ 80% VLE pour rester sous seuil en régime normal tout en générant
#   naturellement des warnings lors des pics journaliers.
BASELINES = {
    "CO2":  650.0,   # ppm      — seuil interne 800 ppm
    "NOX":  400.0,   # mg/Nm³   — VLE 500 mg/Nm³ (Annexe 1, §4)
    "SOX":  240.0,   # mg/Nm³   — VLE 300 mg/Nm³ (Annexe 1, §3)
    "PM25":  32.0,   # µg/m³    — VLE 40 mg/m³ = 40 000 µg/m³ (Annexe 1, §1)
    "PM10":  38.4,   # µg/m³    — ≈ PM25 × 1.2
    "COV":   88.0,   # mg/Nm³   — VLE 110 mg/Nm³ (Annexe 1, §7)
    "TEMPERATURE": 28.0,  # °C — climat tunisien
    "HUMIDITY":    55.0,  # %RH
}

# Amplitudes du cycle journalier (fraction de la baseline)
AMPLITUDES = {
    "CO2": 0.18,
    "NOX": 0.12,
    "SOX": 0.15,
    "PM25": 0.28,
    "PM10": 0.25,
    "COV": 0.17,
    "TEMPERATURE": 0.25,
    "HUMIDITY": 0.18,
}

# Bruit capteur (écart-type en fraction de baseline)
NOISE_FRAC = {
    "CO2": 0.06,
    "NOX": 0.06,
    "SOX": 0.09,
    "PM25": 0.15,
    "PM10": 0.12,
    "COV": 0.11,
    "TEMPERATURE": 0.04,
    "HUMIDITY": 0.06,
}

# VLEs réglementaires — Décret 2010-2519, Annexe 1 (valeurs générales)
# Utilisées pour calibrer les anomalies et clipper les valeurs physiques.
# Pour un déploiement sectoriel, surcharger via ThresholdConfig (MongoDB).
VLE = {
    "CO2":  800.0,   # ppm      — seuil interne (pas de VLE réglementaire)
    "NOX":  500.0,   # mg/Nm³   — Annexe 1, §4 (flux > 25 kg/h)
    "SOX":  300.0,   # mg/Nm³   — Annexe 1, §3 (flux > 25 kg/h)
    "PM25":  40.0,   # mg/m³    — Annexe 1, §1 (flux > 1 kg/h)
    "PM10":  40.0,   # mg/m³    — Annexe 1, §1 (flux > 1 kg/h)
    "COV":  110.0,   # mg/Nm³   — Annexe 1, §7 (flux > 2 kg/h)
}

# Sites synthétiques — simulent différentes zones / usines
SITE_CONFIGS = [
    {"id": "site_four_A",     "mult": 1.00, "phase_h": 0},
    {"id": "site_four_B",     "mult": 0.95, "phase_h": 1},
    {"id": "site_broyage",    "mult": 0.65, "phase_h": 2},
    {"id": "site_stockage",   "mult": 0.55, "phase_h": 0.5},
    {"id": "site_expedition", "mult": 0.50, "phase_h": 3},
    {"id": "site_mixed",      "mult": 0.80, "phase_h": 1.5},
]


# ─────────────────────────────────────────────
# GENERATEUR
# ─────────────────────────────────────────────

def daily_pattern(hours: np.ndarray, phase_h: float = 0) -> np.ndarray:
    """Double pic industriel (matin + fin d'après-midi), réduit la nuit."""
    h = hours - phase_h
    morning = np.exp(-0.5 * ((h - 9.5) / 2.0) ** 2)
    evening = np.exp(-0.5 * ((h - 17.5) / 2.0) ** 2)
    base_activity = 0.55
    return base_activity + 0.45 * (morning + 0.75 * evening) / 1.75


def weekly_pattern(day_of_week: np.ndarray) -> np.ndarray:
    """Weekend réduit (~60% de l'activité semaine)."""
    mult = np.ones_like(day_of_week, dtype=float)
    mult[day_of_week >= 5] = 0.60
    mult[day_of_week == 4] = 0.90  # vendredi après-midi réduit
    return mult


def seasonal_temperature(day_of_year: np.ndarray) -> np.ndarray:
    """Cycle saisonnier tunisien : pic été (~35°C), min hiver (~15°C)."""
    return 25.0 + 10.0 * np.sin(2 * np.pi * (day_of_year - 80) / 365)


def generate_site(
    site_id: str,
    mult: float,
    phase_h: float,
    n_days: int,
    rng: np.random.Generator,
    anomaly_ratio: float = 0.05,
) -> pd.DataFrame:
    """Genere n_days × 24 lignes horaires pour un site."""
    n_hours = n_days * 24
    start = pd.Timestamp("2025-01-01", tz="UTC")
    timestamps = pd.date_range(start, periods=n_hours, freq="1h")

    hours = timestamps.hour + timestamps.minute / 60.0
    dow = timestamps.dayofweek.to_numpy()
    doy = timestamps.dayofyear.to_numpy()

    dp = daily_pattern(hours.to_numpy(), phase_h)
    wp = weekly_pattern(dow)
    activity = dp * wp

    data = {}
    for feat in FEATURE_NAMES:
        base = BASELINES[feat] * mult
        amp = AMPLITUDES[feat]

        if feat == "TEMPERATURE":
            signal = seasonal_temperature(doy) + amp * base * (dp - 0.55)
            noise = rng.normal(0, NOISE_FRAC[feat] * 5, n_hours)
            data[feat] = signal + noise
            continue

        if feat == "HUMIDITY":
            temp = data.get("TEMPERATURE", np.full(n_hours, 28.0))
            hum_base = 70 - 0.6 * (temp - 15)
            noise = rng.normal(0, NOISE_FRAC[feat] * 10, n_hours)
            data[feat] = np.clip(hum_base + noise, 20, 95)
            continue

        signal = base * activity
        slow_trend = base * 0.05 * np.sin(2 * np.pi * np.arange(n_hours) / (7 * 24))
        noise = rng.normal(0, NOISE_FRAC[feat] * base, n_hours)
        data[feat] = signal + slow_trend + noise

    # Correlations industrielles
    co2_norm = (data["CO2"] - data["CO2"].min()) / (data["CO2"].max() - data["CO2"].min() + 1e-9)
    data["NOX"] += co2_norm * BASELINES["NOX"] * mult * 0.12
    nox_norm = (data["NOX"] - data["NOX"].min()) / (data["NOX"].max() - data["NOX"].min() + 1e-9)
    data["SOX"] += nox_norm * BASELINES["SOX"] * mult * 0.08
    data["PM10"] = data["PM25"] * (1.15 + rng.normal(0, 0.05, n_hours))

    # Clip aux bornes physiques
    for feat in FEATURE_NAMES:
        lo = 0.0 if feat not in ("TEMPERATURE",) else -5.0
        hi = VLE.get(feat, 5000) * 3 if feat in VLE else 100 if feat == "HUMIDITY" else 60
        data[feat] = np.clip(data[feat], lo, hi)

    # Anomalies industrielles
    n_anomalies = int(n_hours * anomaly_ratio)
    anomaly_indices = rng.choice(n_hours, size=n_anomalies, replace=False)
    anomaly_types = rng.choice(
        ["spike", "drift", "incoherence"], size=n_anomalies, p=[0.5, 0.3, 0.2]
    )

    for idx, atype in zip(anomaly_indices, anomaly_types):
        target_feats = rng.choice(
            [f for f in FEATURE_NAMES if f not in ("TEMPERATURE", "HUMIDITY")],
            size=rng.integers(1, 4),
            replace=False,
        )
        if atype == "spike":
            for f in target_feats:
                severity = rng.uniform(1.3, 2.0)
                duration = rng.integers(1, 5)
                end = min(idx + duration, n_hours)
                data[f][idx:end] *= severity
        elif atype == "drift":
            for f in target_feats:
                duration = rng.integers(4, 12)
                end = min(idx + duration, n_hours)
                drift = np.linspace(1.0, rng.uniform(1.2, 1.6), end - idx)
                data[f][idx:end] *= drift
        elif atype == "incoherence":
            data["PM25"][idx] *= rng.uniform(2.0, 3.5)
            data["PM10"][idx] *= rng.uniform(2.0, 3.5)
            # CO2/NOX stay normal → incoherent multivariate profile

    # Re-clip after anomalies
    for feat in FEATURE_NAMES:
        data[feat] = np.maximum(data[feat], 0.0)

    # Build long-format DataFrame
    rows = []
    for i, ts in enumerate(timestamps):
        for feat in FEATURE_NAMES:
            rows.append({
                "timestamp_utc": ts,
                "site_id": site_id,
                "pollutant": feat,
                "value": float(data[feat][i]),
            })

    df = pd.DataFrame(rows)

    # Add temperature/humidity as side columns (notebook 05 expects them)
    temp_map = dict(zip(timestamps, data["TEMPERATURE"]))
    hum_map = dict(zip(timestamps, data["HUMIDITY"]))
    df["temperature_c"] = df["timestamp_utc"].map(temp_map)
    df["humidity_percent"] = df["timestamp_utc"].map(hum_map)

    return df


def generate_dataset(n_days: int = 90, n_sites: int = 6, seed: int = 42) -> pd.DataFrame:
    """Generate multi-site industrial dataset."""
    rng = np.random.default_rng(seed)
    configs = SITE_CONFIGS[:n_sites]

    frames = []
    for cfg in configs:
        print(f"  Generating site {cfg['id']} (mult={cfg['mult']})...")
        df = generate_site(
            site_id=cfg["id"],
            mult=cfg["mult"],
            phase_h=cfg["phase_h"],
            n_days=n_days,
            rng=rng,
        )
        frames.append(df)

    return pd.concat(frames, ignore_index=True)


def main():
    parser = argparse.ArgumentParser(description="Generate industrial training dataset")
    parser.add_argument("--days", type=int, default=90, help="Days per site (default 90)")
    parser.add_argument("--sites", type=int, default=6, help="Number of sites (max 6)")
    parser.add_argument(
        "--output",
        type=str,
        default=str(Path(__file__).parent / "data" / "training_dataset.csv"),
    )
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    print(f"Generating {args.days} days x {args.sites} sites...")
    df = generate_dataset(n_days=args.days, n_sites=args.sites, seed=args.seed)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Backup existing if present
    if out_path.exists():
        bak = out_path.with_suffix(".csv.bak")
        if not bak.exists():
            out_path.rename(bak)
            print(f"  Ancien dataset sauvegardé: {bak}")
        else:
            print(f"  Backup existant: {bak} (pas écrasé)")

    df.to_csv(out_path, index=False)
    n_rows = len(df)
    n_hours = df.groupby(["site_id", "timestamp_utc"]).ngroups
    print(f"Done: {out_path}")
    print(f"  {n_rows:,} rows | {n_hours:,} hour-slots | {df['site_id'].nunique()} sites")
    print(f"  Pollutants: {sorted(df['pollutant'].unique())}")
    print(f"  Date range: {df['timestamp_utc'].min()} -- {df['timestamp_utc'].max()}")


if __name__ == "__main__":
    main()
