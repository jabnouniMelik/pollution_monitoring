"""
Helpers — préparation tenseurs (notebook 05) et entraînement LSTM 4 h (notebook 06).

MVP prod : un seul modèle horaire **4 h** (`horizon_short`). Voir `LSTM_INTEGRATION` dans config.py.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

# TensorFlow importé à la demande (notebook 05 n'en a pas besoin)

_TWO_PI = 2.0 * np.pi


def calendar_matrix_from_timestamps(timestamps: np.ndarray) -> np.ndarray:
    """sin/cos heure (0–24) et jour semaine (0–6) — shape (n, 4)."""
    ts = pd.to_datetime(timestamps, utc=True)
    hour = ts.hour.to_numpy(dtype=np.float32) + ts.minute.to_numpy(dtype=np.float32) / 60.0
    dow = ts.dayofweek.to_numpy(dtype=np.float32)
    return np.stack(
        [
            np.sin(_TWO_PI * hour / 24.0),
            np.cos(_TWO_PI * hour / 24.0),
            np.sin(_TWO_PI * dow / 7.0),
            np.cos(_TWO_PI * dow / 7.0),
        ],
        axis=1,
    ).astype(np.float32)


def build_windows(
    matrix: np.ndarray,
    lookback: int,
    horizon: int,
    timestamps: np.ndarray | None = None,
    n_pollutant_features: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Fenêtres (X, y). Si timestamps fournis, concatène features calendrier sur X.
    y reste polluants seuls (n_pollutant_features colonnes).
    """
    if n_pollutant_features is None:
        n_pollutant_features = matrix.shape[1]

    X_list: list[np.ndarray] = []
    y_list: list[np.ndarray] = []
    n = len(matrix)
    for i in range(n - lookback - horizon + 1):
        wx = matrix[i : i + lookback]
        wy = matrix[i + lookback : i + lookback + horizon]
        if not (np.isfinite(wx).all() and np.isfinite(wy).all()):
            continue
        if timestamps is not None:
            cal = calendar_matrix_from_timestamps(timestamps[i : i + lookback])
            wx = np.concatenate([wx, cal], axis=1)
        X_list.append(wx)
        y_list.append(wy)

    if not X_list:
        n_in = n_pollutant_features + (4 if timestamps is not None else 0)
        return (
            np.empty((0, lookback, n_in), dtype=np.float32),
            np.empty((0, horizon, n_pollutant_features), dtype=np.float32),
        )
    return np.asarray(X_list, dtype=np.float32), np.asarray(y_list, dtype=np.float32)


def temporal_split(
    X: np.ndarray,
    y: np.ndarray,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> tuple[tuple[np.ndarray, np.ndarray], ...]:
    n = len(X)
    i_train = int(train_ratio * n)
    i_val = int((train_ratio + val_ratio) * n)
    return (
        (X[:i_train], y[:i_train]),
        (X[i_train:i_val], y[i_train:i_val]),
        (X[i_val:], y[i_val:]),
    )


def concat_splits(
    splits_per_site: list[tuple[tuple[np.ndarray, np.ndarray], ...]],
) -> tuple[tuple[np.ndarray, np.ndarray], ...]:
    """Fusionne train/val/test après split temporel **par site**."""
    train_x = np.concatenate([s[0][0] for s in splits_per_site], axis=0)
    train_y = np.concatenate([s[0][1] for s in splits_per_site], axis=0)
    val_x = np.concatenate([s[1][0] for s in splits_per_site], axis=0)
    val_y = np.concatenate([s[1][1] for s in splits_per_site], axis=0)
    test_x = np.concatenate([s[2][0] for s in splits_per_site], axis=0)
    test_y = np.concatenate([s[2][1] for s in splits_per_site], axis=0)
    return (train_x, train_y), (val_x, val_y), (test_x, test_y)


def concat_splits_with_test_sites(
    splits_per_site: list[tuple[tuple[np.ndarray, np.ndarray], ...]],
    site_ids: list[str],
):
    """Fusionne les splits et retourne les libellés site alignés au jeu test."""
    if len(site_ids) != len(splits_per_site):
        raise ValueError("site_ids et splits_per_site doivent avoir la même longueur")
    merged = concat_splits(splits_per_site)
    test_labels: list[str] = []
    for site_id, splits in zip(site_ids, splits_per_site):
        n_test = len(splits[2][0])
        test_labels.extend([str(site_id)] * n_test)
    return (*merged, np.array(test_labels, dtype=str))


def fit_winsor_bounds(
    arrays: list[np.ndarray],
    n_features: int,
    lower_q: float = 1.0,
    upper_q: float = 99.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Bornes percentile sur le train (tous sites), par colonne."""
    flat = np.concatenate([a.reshape(-1, n_features) for a in arrays], axis=0)
    lo = np.percentile(flat, lower_q, axis=0).astype(np.float32)
    hi = np.percentile(flat, upper_q, axis=0).astype(np.float32)
    hi = np.maximum(hi, lo + 1e-6)
    return lo, hi


def winsorize_array(
    arr: np.ndarray,
    lo: np.ndarray,
    hi: np.ndarray,
    n_features: int,
) -> np.ndarray:
    out = arr.copy()
    flat = out.reshape(-1, n_features)
    np.clip(flat, lo, hi, out=flat)
    return out.astype(np.float32)


def winsorize_X_pollutants(
    X: np.ndarray,
    lo: np.ndarray,
    hi: np.ndarray,
    n_pollutant_features: int,
) -> np.ndarray:
    """Winsorize uniquement les colonnes polluants de X (pas le calendrier)."""
    out = X.copy()
    slc = out[:, :, :n_pollutant_features]
    flat = slc.reshape(-1, n_pollutant_features)
    np.clip(flat, lo, hi, out=flat)
    out[:, :, :n_pollutant_features] = flat.reshape(slc.shape)
    return out.astype(np.float32)


def scale_splits(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    n_pollutant_features: int,
) -> tuple[np.ndarray, ...]:
    """MinMax [0,1] sur polluants uniquement ; colonnes calendrier inchangées."""
    scaler = MinMaxScaler(feature_range=(0, 1))
    fit_xy = np.concatenate(
        [
            X_train[:, :, :n_pollutant_features].reshape(-1, n_pollutant_features),
            y_train.reshape(-1, n_pollutant_features),
        ],
        axis=0,
    )
    scaler.fit(fit_xy)

    def transform_x(arr: np.ndarray) -> np.ndarray:
        out = arr.copy()
        poll = arr[:, :, :n_pollutant_features]
        flat = scaler.transform(poll.reshape(-1, n_pollutant_features))
        out[:, :, :n_pollutant_features] = flat.reshape(poll.shape)
        return out.astype(np.float32)

    def transform_y(arr: np.ndarray) -> np.ndarray:
        flat = scaler.transform(arr.reshape(-1, n_pollutant_features))
        return flat.reshape(arr.shape).astype(np.float32)

    return (
        transform_x(X_train),
        transform_y(y_train),
        transform_x(X_val),
        transform_y(y_val),
        transform_x(X_test),
        transform_y(y_test),
        scaler,
    )


def clip_predictions(y_pred: np.ndarray) -> np.ndarray:
    """Cibles normalisées — évite valeurs hors [0,1] en inférence."""
    return np.clip(y_pred, 0.0, 1.0).astype(np.float32)


def load_lstm_model_for_inference(model_path: Path | str) -> Any:
    """
    Charge un modèle .h5 / .keras pour prédiction uniquement.
    compile=False évite les erreurs de désérialisation (ex. keras.metrics.mse legacy).
    """
    from tensorflow import keras

    path = str(model_path)
    return keras.models.load_model(path, compile=False)


def build_lstm_model(
    lookback: int,
    horizon: int,
    n_input_features: int,
    n_output_features: int,
    config: dict[str, Any],
) -> Any:
    from tensorflow import keras
    from tensorflow.keras import layers

    dropout = config["dropout_rate"]
    rec_drop = config.get("recurrent_dropout", 0.0)
    activation = config.get("lstm_activation", "relu")

    model = keras.Sequential(
        [
            layers.Input(shape=(lookback, n_input_features)),
            layers.LSTM(
                config["units_layer1"],
                return_sequences=True,
                activation=activation,
                recurrent_dropout=rec_drop,
            ),
            layers.Dropout(dropout),
            layers.LSTM(
                config["units_layer2"],
                activation=activation,
                recurrent_dropout=rec_drop,
            ),
            layers.BatchNormalization(),
            layers.Dropout(dropout),
            layers.Dense(config["dense_units"], activation="relu"),
            layers.Dense(horizon * n_output_features),
            layers.Reshape((horizon, n_output_features)),
        ]
    )
    return model


def build_weighted_loss(
    feature_names: list[str],
    config: dict[str, Any],
) -> Any:
    """Huber (ou MSE) pondéré par polluant — forme y (batch, horizon, features)."""
    import tensorflow as tf
    from tensorflow import keras

    weights_map = config.get("loss_weights") or {}
    w = np.array(
        [float(weights_map.get(name, 1.0)) for name in feature_names],
        dtype=np.float32,
    )
    w = w / float(np.mean(w))

    loss_name = config.get("loss", "mse")
    delta = float(config.get("huber_delta", 0.05))

    def weighted_loss(y_true: tf.Tensor, y_pred: tf.Tensor) -> tf.Tensor:
        err = y_true - y_pred
        if loss_name == "huber":
            abs_err = tf.abs(err)
            quad = tf.minimum(abs_err, delta)
            lin = abs_err - quad
            per_elem = 0.5 * tf.square(quad) + delta * lin
        else:
            per_elem = tf.square(err)

        weighted = per_elem * w[tf.newaxis, tf.newaxis, :]
        return tf.reduce_mean(weighted)

    weighted_loss.__name__ = f"weighted_{loss_name}"
    return weighted_loss


def compile_lstm_model(
    model: Any,
    config: dict[str, Any],
    feature_names: list[str] | None = None,
) -> None:
    from tensorflow import keras

    if feature_names is None:
        from config import LSTM_FEATURE_NAMES

        feature_names = LSTM_FEATURE_NAMES

    if config.get("use_weighted_loss") and config.get("loss_weights"):
        loss = build_weighted_loss(feature_names, config)
    else:
        loss_name = config.get("loss", "mse")
        if loss_name == "huber":
            loss = keras.losses.Huber(delta=config.get("huber_delta", 0.05))
        else:
            loss = loss_name

    clip = config.get("gradient_clip_norm")
    opt_kw: dict[str, Any] = {"learning_rate": config["learning_rate"]}
    if clip:
        opt_kw["clipnorm"] = clip
    optimizer = keras.optimizers.Adam(**opt_kw)
    model.compile(loss=loss, optimizer=optimizer, metrics=["mae"])


def _make_skill_callback(
    X_val: np.ndarray,
    y_val: np.ndarray,
    horizon: int,
    max_samples: int,
    n_pollutant_features: int,
    seed: int = 42,
) -> Any:
    """Callback Keras : logs['val_skill'] = 1 − MAE_LSTM/MAE_persistance (val)."""
    from tensorflow.keras import callbacks

    n = len(X_val)
    if n > max_samples:
        rng = np.random.default_rng(seed)
        idx = rng.choice(n, size=max_samples, replace=False)
    else:
        idx = np.arange(n)

    class SkillVsPersistenceCallback(callbacks.Callback):
        def on_epoch_end(self, epoch: int, logs: dict[str, Any] | None = None) -> None:
            if logs is None:
                return
            X_sub = X_val[idx]
            y_sub = y_val[idx]
            y_pred = clip_predictions(self.model.predict(X_sub, verbose=0))
            y_pers = persistence_baseline(X_sub, horizon, n_pollutant_features)
            lstm_mae = float(np.mean(np.abs(y_sub - y_pred)))
            pers_mae = float(np.mean(np.abs(y_sub - y_pers)))
            if pers_mae <= 0:
                logs["val_skill"] = 0.0
            else:
                logs["val_skill"] = float(1.0 - lstm_mae / pers_mae)

    return SkillVsPersistenceCallback()


def training_callbacks(
    config: dict[str, Any],
    checkpoint_path: Path | None = None,
    X_val: np.ndarray | None = None,
    y_val: np.ndarray | None = None,
    horizon: int | None = None,
) -> list[Any]:
    from tensorflow.keras import callbacks

    monitor = config.get("early_stopping_monitor", "val_loss")
    maximize_skill = monitor == "val_skill"

    cbs: list[Any] = []

    n_poll = int(config.get("n_output_features", y_val.shape[2] if y_val is not None else 8))
    if maximize_skill and X_val is not None and y_val is not None and horizon is not None:
        cbs.append(
            _make_skill_callback(
                X_val,
                y_val,
                horizon,
                max_samples=int(config.get("skill_val_max_samples", 4000)),
                n_pollutant_features=n_poll,
            )
        )

    cbs.append(
        callbacks.EarlyStopping(
            monitor=monitor,
            mode="max" if maximize_skill else "min",
            patience=config["early_stopping_patience"],
            restore_best_weights=True,
            verbose=1,
        )
    )
    cbs.append(
        callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=config.get("lr_reduce_factor", 0.5),
            patience=config.get("lr_reduce_patience", 4),
            min_lr=config.get("min_learning_rate", 1e-5),
            verbose=1,
        )
    )
    if checkpoint_path is not None:
        cbs.append(
            callbacks.ModelCheckpoint(
                filepath=str(checkpoint_path),
                monitor=monitor,
                mode="max" if maximize_skill else "min",
                save_best_only=True,
                verbose=0,
            )
        )
    return cbs


def evaluate_forecast(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    yt = y_true.reshape(-1)
    yp = y_pred.reshape(-1)
    mse = float(np.mean((yt - yp) ** 2))
    mae = float(np.mean(np.abs(yt - yp)))
    ss_res = float(np.sum((yt - yp) ** 2))
    ss_tot = float(np.sum((yt - np.mean(yt)) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return {
        "rmse": float(np.sqrt(mse)),
        "mae": mae,
        "r2_score": r2,
    }


def persistence_baseline(
    X: np.ndarray,
    horizon: int,
    n_pollutant_features: int | None = None,
) -> np.ndarray:
    """Naïf : répéter la dernière heure (polluants seuls) sur les `horizon` pas futurs."""
    if n_pollutant_features is None:
        n_pollutant_features = X.shape[2]
    last = X[:, -1:, :n_pollutant_features]
    return np.tile(last, (1, horizon, 1)).astype(np.float32)


def evaluate_per_horizon_step(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> dict[str, dict[str, float]]:
    """MAE / R² pour chaque pas +1h … +H (forme y : n, horizon, features)."""
    horizon = y_true.shape[1]
    out: dict[str, dict[str, float]] = {}
    for step in range(horizon):
        yt = y_true[:, step : step + 1, :]
        yp = y_pred[:, step : step + 1, :]
        m = evaluate_forecast(yt, yp)
        out[f"+{step + 1}h"] = m
    return out


def skill_score(mae_model: float, mae_baseline: float) -> float:
    """
    Skill vs persistance : 1 − MAE_model / MAE_baseline.
    Positif = LSTM meilleur ; 0 = égal ; négatif = persistance meilleure.
    """
    if mae_baseline <= 0:
        return 0.0
    return float(1.0 - mae_model / mae_baseline)


def compare_models_on_test(
    y_true: np.ndarray,
    y_lstm: np.ndarray,
    y_baseline: np.ndarray,
    pollutant_names: list[str],
) -> dict[str, Any]:
    """Résumé LSTM vs persistance (dernière valeur répétée)."""
    lstm = evaluate_forecast(y_true, y_lstm)
    base = evaluate_forecast(y_true, y_baseline)
    per_pl_stm = evaluate_per_pollutant(y_true, y_lstm, pollutant_names)
    per_pl_pers = evaluate_per_pollutant(y_true, y_baseline, pollutant_names)
    per_h_stm = evaluate_per_horizon_step(y_true, y_lstm)
    per_h_pers = evaluate_per_horizon_step(y_true, y_baseline)

    pollutant_skill = {
        name: skill_score(per_pl_stm[name]["mae"], per_pl_pers[name]["mae"])
        for name in pollutant_names
    }
    horizon_skill = {
        step: skill_score(per_h_stm[step]["mae"], per_h_pers[step]["mae"])
        for step in per_h_stm
    }

    return {
        "lstm": lstm,
        "persistence": base,
        "delta_mae": lstm["mae"] - base["mae"],
        "delta_r2": lstm["r2_score"] - base["r2_score"],
        "lstm_wins_mae": lstm["mae"] < base["mae"],
        "global_skill": skill_score(lstm["mae"], base["mae"]),
        "per_pollutant_lstm": per_pl_stm,
        "per_pollutant_persistence": per_pl_pers,
        "per_pollutant_skill": pollutant_skill,
        "per_horizon_lstm": per_h_stm,
        "per_horizon_persistence": per_h_pers,
        "per_horizon_skill": horizon_skill,
    }


def evaluate_per_site(
    y_true: np.ndarray,
    y_lstm: np.ndarray,
    y_baseline: np.ndarray,
    site_ids: np.ndarray,
    pollutant_names: list[str],
    min_samples: int = 50,
) -> dict[str, dict[str, Any]]:
    """Skill et MAE LSTM vs persistance par site (jeu test)."""
    site_ids = np.asarray(site_ids).astype(str)
    out: dict[str, dict[str, Any]] = {}
    for site in np.unique(site_ids):
        mask = site_ids == site
        n = int(mask.sum())
        if n < min_samples:
            continue
        yt, yl, yb = y_true[mask], y_lstm[mask], y_baseline[mask]
        lstm_m = evaluate_forecast(yt, yl)
        base_m = evaluate_forecast(yt, yb)
        pl_skill = {
            name: skill_score(
                evaluate_per_pollutant(yt, yl, pollutant_names)[name]["mae"],
                evaluate_per_pollutant(yt, yb, pollutant_names)[name]["mae"],
            )
            for name in pollutant_names
        }
        out[str(site)] = {
            "n_samples": n,
            "global_skill": skill_score(lstm_m["mae"], base_m["mae"]),
            "lstm_mae": lstm_m["mae"],
            "persistence_mae": base_m["mae"],
            "per_pollutant_skill": pl_skill,
        }
    return out


def evaluate_acceptance(
    skill_report: dict[str, Any],
    acceptance: dict[str, Any],
) -> dict[str, Any]:
    """Applique LSTM_ACCEPTANCE — retourne go_deploy et détail des checks."""
    checks: list[dict[str, Any]] = []
    global_skill = float(skill_report["global"]["skill"])
    min_global = float(acceptance["min_global_skill"])

    checks.append({
        "id": "global_skill",
        "passed": global_skill >= min_global,
        "value": global_skill,
        "threshold": min_global,
        "message": f"skill global {global_skill:.4f} >= {min_global}",
    })

    for pollutant, min_skill in acceptance.get("min_pollutant_skill", {}).items():
        val = float(skill_report["per_pollutant_skill"].get(pollutant, -1.0))
        checks.append({
            "id": f"pollutant_skill_{pollutant}",
            "passed": val >= float(min_skill),
            "value": val,
            "threshold": float(min_skill),
            "message": f"{pollutant} skill {val:.4f} >= {min_skill}",
        })

    for step, max_ratio in acceptance.get("max_horizon_step_mae_ratio", {}).items():
        lstm_mae = float(
            skill_report["per_horizon_lstm"][step]["mae"]
        )
        pers_mae = float(
            skill_report["per_horizon_persistence"][step]["mae"]
        )
        ratio = lstm_mae / pers_mae if pers_mae > 0 else float("inf")
        checks.append({
            "id": f"horizon_mae_ratio_{step}",
            "passed": ratio <= float(max_ratio),
            "value": ratio,
            "threshold": float(max_ratio),
            "message": f"{step} MAE ratio {ratio:.3f} <= {max_ratio}",
        })

    fallback = set(acceptance.get("allow_fallback_pollutants", []))
    deploy_if_fallback = bool(acceptance.get("deploy_if_fallback_only", True))
    target_pollutants = [
        p
        for p in skill_report["per_pollutant_skill"]
        if p not in fallback
    ]
    lstm_wins_targets = all(
        float(skill_report["per_pollutant_skill"][p]) > 0
        for p in target_pollutants
    )
    checks.append({
        "id": "lstm_wins_non_fallback_pollutants",
        "passed": lstm_wins_targets or deploy_if_fallback,
        "value": lstm_wins_targets,
        "threshold": True,
        "message": "LSTM skill > 0 sur polluants hors fallback (ou fallback autorisé)",
    })

    hard_failures = [c for c in checks if not c["passed"] and c["id"] != "global_skill"]
    global_ok = checks[0]["passed"]
    go_deploy = global_ok or (
        deploy_if_fallback and lstm_wins_targets
    )

    return {
        "go_deploy": bool(go_deploy),
        "checks": checks,
        "failed_checks": [c["id"] for c in checks if not c["passed"]],
        "recommendation": (
            "deploy_with_hybrid_fallback"
            if go_deploy and not global_ok
            else ("deploy" if go_deploy else "retrain_before_deploy")
        ),
    }


def build_skill_report(
    y_true: np.ndarray,
    y_lstm: np.ndarray,
    y_baseline: np.ndarray,
    pollutant_names: list[str],
    site_ids: np.ndarray | None = None,
    acceptance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Rapport skill complet + évaluation d'acceptation optionnelle."""
    baseline_cmp = compare_models_on_test(
        y_true, y_lstm, y_baseline, pollutant_names
    )
    report: dict[str, Any] = {
        "global": {
            "lstm": baseline_cmp["lstm"],
            "persistence": baseline_cmp["persistence"],
            "skill": baseline_cmp["global_skill"],
            "lstm_wins_mae": baseline_cmp["lstm_wins_mae"],
        },
        "per_horizon_skill": baseline_cmp["per_horizon_skill"],
        "per_horizon_lstm": baseline_cmp["per_horizon_lstm"],
        "per_horizon_persistence": baseline_cmp["per_horizon_persistence"],
        "per_pollutant_skill": baseline_cmp["per_pollutant_skill"],
        "per_pollutant_lstm": baseline_cmp["per_pollutant_lstm"],
        "per_pollutant_persistence": baseline_cmp["per_pollutant_persistence"],
        "baseline_comparison": baseline_cmp,
    }
    if site_ids is not None:
        report["per_site"] = evaluate_per_site(
            y_true, y_lstm, y_baseline, site_ids, pollutant_names
        )
    if acceptance is not None:
        report["acceptance"] = evaluate_acceptance(report, acceptance)
    return report


def plot_skill_mae_bars(
    skill_report: dict[str, Any],
    save_path: Path,
    title: str = "LSTM vs persistance — MAE test",
) -> None:
    """Barres MAE global, par pas d'horizon et par polluant."""
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 3, figsize=(14, 4))

    g = skill_report["global"]
    axes[0].bar(
        ["LSTM", "Persistance"],
        [g["lstm"]["mae"], g["persistence"]["mae"]],
        color=["#1f77b4", "#ff7f0e"],
    )
    axes[0].set_title(f"Global (skill={g['skill']:.3f})")
    axes[0].set_ylabel("MAE")

    steps = list(skill_report["per_horizon_lstm"].keys())
    x = np.arange(len(steps))
    w = 0.35
    axes[1].bar(
        x - w / 2,
        [skill_report["per_horizon_lstm"][s]["mae"] for s in steps],
        w,
        label="LSTM",
        color="#1f77b4",
    )
    axes[1].bar(
        x + w / 2,
        [skill_report["per_horizon_persistence"][s]["mae"] for s in steps],
        w,
        label="Persistance",
        color="#ff7f0e",
    )
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(steps)
    axes[1].set_title("Par pas d'horizon")
    axes[1].legend()

    pollutants = list(skill_report["per_pollutant_skill"].keys())
    skills = [skill_report["per_pollutant_skill"][p] for p in pollutants]
    colors = ["#2ca02c" if s > 0 else "#d62728" for s in skills]
    axes[2].barh(pollutants, skills, color=colors)
    axes[2].axvline(0, color="black", linewidth=0.8)
    axes[2].set_title("Skill par polluant")
    axes[2].set_xlabel("skill (1 − MAE_LSTM/MAE_pers)")

    fig.suptitle(title)
    plt.tight_layout()
    fig.savefig(save_path, dpi=100, bbox_inches="tight")
    plt.close(fig)


def evaluate_per_pollutant(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    pollutant_names: list[str],
) -> dict[str, dict[str, float]]:
    """MAE / R² par polluant (moyenne sur pas de temps)."""
    out: dict[str, dict[str, float]] = {}
    for i, name in enumerate(pollutant_names):
        yt = y_true[:, :, i].reshape(-1)
        yp = y_pred[:, :, i].reshape(-1)
        mae = float(np.mean(np.abs(yt - yp)))
        ss_res = float(np.sum((yt - yp) ** 2))
        ss_tot = float(np.sum((yt - np.mean(yt)) ** 2))
        r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
        out[name] = {"mae": mae, "r2_score": r2}
    return out


def pick_plot_sample_idx(y_test: np.ndarray, strategy: str = "median") -> int:
    """
    Index pour graphique qualitatif.
    - median : variabilité typique (évite le pire cas argmax std)
    - challenging : fenêtre la plus variable (diagnostic)
    """
    per_sample_std = np.std(y_test.reshape(len(y_test), -1), axis=1)
    if strategy == "challenging":
        return int(np.argmax(per_sample_std))
    median_std = float(np.median(per_sample_std))
    return int(np.argmin(np.abs(per_sample_std - median_std)))


def get_lstm_integration(horizon_hours: int) -> dict[str, Any]:
    from config import LSTM_INTEGRATION

    if horizon_hours not in LSTM_INTEGRATION:
        raise ValueError(
            f"horizon_hours={horizon_hours} non supporté. "
            f"MVP : {sorted(LSTM_INTEGRATION.keys())}"
        )
    return LSTM_INTEGRATION[horizon_hours]


def artifact_paths_4h(models_dir: Path) -> dict[str, Path]:
    return {
        "model": models_dir / "model_lstm_4h.h5",
        "metrics": models_dir / "lstm_4h_metrics.json",
        "skill_report": models_dir / "lstm_4h_skill_report.json",
        "skill_chart": models_dir / "lstm_4h_skill_mae_bars.png",
        "history": models_dir / "lstm_4h_history.json",
        "curves": models_dir / "lstm_4h_training_curves.png",
        "predictions": models_dir / "lstm_4h_predictions.png",
        "predictions_challenging": models_dir / "lstm_4h_predictions_challenging.png",
    }
