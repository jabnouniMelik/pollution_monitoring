"""

Microservice FastAPI — LSTM 4 h + Isolation Forest.

"""

from __future__ import annotations



import logging

from typing import Any



import numpy as np

from fastapi import FastAPI, HTTPException

from pydantic import BaseModel, Field



from config import API_HOST, API_PORT, LSTM_FEATURE_NAMES, LSTM_CONFIG

from inference import LSTM4HPredictor



logger = logging.getLogger(__name__)



app = FastAPI(title="Pollution Monitoring IA", version="1.1.0")

_predictor: LSTM4HPredictor | None = None

_if_detector: Any = None





class PredictRequest(BaseModel):

    horizon_hours: int = Field(default=4, ge=4, le=4)

    lookback_values: list[list[float]] = Field(

        ...,

        description=f"Matrice {LSTM_CONFIG['lookback']} x {len(LSTM_FEATURE_NAMES)} (ordre LSTM_FEATURE_NAMES)",

    )

    timestamps_utc: list[str] | None = Field(

        default=None,

        description="ISO8601, longueur lookback, requis si calendrier activé",

    )





class DetectRequest(BaseModel):

    feature_values: list[float] = Field(

        ...,

        description="Valeurs physiques dans l'ordre feature_cols (défaut: IF_FEATURE_NAMES)",

    )

    feature_cols: list[str] | None = Field(

        default=None,

        description="Ordre des colonnes ; défaut = entraînement (if_metrics.json)",

    )





@app.on_event("startup")

def load_models() -> None:

    global _predictor, _if_detector

    _predictor = LSTM4HPredictor(horizon_hours=4)

    try:

        from if_inference import IFAnomalyDetector



        _if_detector = IFAnomalyDetector()

        logger.info("Isolation Forest chargé (%s features)", len(_if_detector.feature_cols))

    except FileNotFoundError as exc:

        _if_detector = None

        logger.warning("Isolation Forest non chargé: %s", exc)





@app.get("/health")

def health() -> dict[str, Any]:

    payload: dict[str, Any] = {"status": "ok"}

    if _predictor is None and _if_detector is None:

        return {"status": "loading"}



    if _predictor is not None:

        payload["lstm"] = {

            "loaded": True,

            "go_deploy": _predictor.go_deploy,

            "horizon_hours": _predictor.horizon_hours,

            "lookback_hours": _predictor.lookback,

            "use_calendar_features": _predictor.use_calendar,

            "alert_source": _predictor.integration["alert_source"],

        }

    else:

        payload["lstm"] = {"loaded": False}



    if _if_detector is not None:

        payload["isolation_forest"] = {

            "loaded": True,

            "feature_cols": _if_detector.feature_cols,

            "score_threshold": _if_detector.score_threshold,

            "alert_source": _if_detector.integration["alert_source"],

        }

    else:

        payload["isolation_forest"] = {"loaded": False}



    return payload





@app.post("/predict")

def predict(body: PredictRequest) -> dict[str, Any]:

    if _predictor is None:

        raise HTTPException(503, "Modèle LSTM non chargé")

    if body.horizon_hours != 4:

        raise HTTPException(400, "MVP : horizon_hours=4 uniquement")



    lookback = LSTM_CONFIG["lookback"]

    n_poll = len(LSTM_FEATURE_NAMES)

    arr = np.asarray(body.lookback_values, dtype=np.float32)

    if arr.shape != (lookback, n_poll):

        raise HTTPException(

            400,

            f"lookback_values doit être [{lookback}][{n_poll}]",

        )



    timestamps = None

    if body.timestamps_utc:

        timestamps = np.array(body.timestamps_utc, dtype="datetime64[ns]")

        if len(timestamps) != lookback:

            raise HTTPException(400, f"timestamps_utc longueur {lookback} requise")



    try:

        return _predictor.predict(arr, timestamps)

    except ValueError as exc:

        raise HTTPException(400, str(exc)) from exc





@app.post("/detect")

def detect(body: DetectRequest) -> dict[str, Any]:

    if _if_detector is None:

        raise HTTPException(503, "Isolation Forest non chargé (entraîner notebook 04)")

    try:

        return _if_detector.detect(body.feature_values, body.feature_cols)

    except ValueError as exc:

        raise HTTPException(400, str(exc)) from exc





if __name__ == "__main__":

    import uvicorn



    uvicorn.run(app, host=API_HOST, port=API_PORT)


