# AIService — intégration LSTM 4 h (MVP)

Références : `ia/docs/TRAINING_PLAN.md`, `ia/docs/LSTM_IMPROVEMENT_STRATEGY.md`, `ia/config.py`.

## Modèle production

- **Un seul** modèle : `model_lstm_4h.h5` (horizon **+1…+4 h**)
- Entrée : **48 h** agrégées à **1 h**, 8 features (`LSTM_FEATURE_NAMES`)
- Scaler : `lstm_scalers.pkl` → clé `scaler` + `winsor_bounds`

## Artefacts Sprint 1 (go/no-go)

| Fichier | Rôle |
|---------|------|
| `lstm_4h_metrics.json` | MAE, R², `baseline_comparison`, `skill_report_summary` |
| `lstm_4h_skill_report.json` | Skill global / pas / polluant / site + `acceptance` |
| `lstm_4h_skill_mae_bars.png` | Visualisation MAE LSTM vs persistance |

### Lecture de `acceptance` (après notebook 06)

```json
{
  "go_deploy": true,
  "recommendation": "deploy_with_hybrid_fallback",
  "failed_checks": ["global_skill", ...]
}
```

| `recommendation` | Action backend |
|------------------|----------------|
| `deploy` | LSTM 4 h sur tous les polluants (skill global OK) |
| `deploy_with_hybrid_fallback` | LSTM sauf polluants dans `allow_fallback_pollutants` |
| `retrain_before_deploy` | Ne pas activer alertes LSTM ; IF + seuils seuls |

Polluants **fallback persistance** (config `LSTM_ACCEPTANCE.allow_fallback_pollutants`) :

`NOX`, `SOX`, `PM25`, `COV`, `HUMIDITY`

Polluants **priorité LSTM** (skill minimum requis) :

`CO2`, `PM10`, `TEMPERATURE`

## Contrat alerte enrichi

Chaque prédiction horaire exposée à Node.js doit inclure :

```json
{
  "horizon_hours": 4,
  "source": "LSTM_4H",
  "prediction_source": "LSTM",
  "pollutant": "CO2",
  "step_hours": 1,
  "value_normalized": 0.42,
  "skill_at_train": 0.07
}
```

`prediction_source` :

| Valeur | Condition |
|--------|-----------|
| `LSTM` | Polluant hors liste fallback et skill validation > 0 |
| `PERSISTENCE` | Polluant dans `allow_fallback_pollutants` ou skill ≤ 0 |
| `blend` | (Sprint 3) mélange LSTM + persistance |

## Inférence Python (`ia/inference.py`)

```python
from inference import LSTM4HPredictor
import numpy as np

pred = LSTM4HPredictor(horizon_hours=4)
# lookback_values: (48, 8) ordre LSTM_FEATURE_NAMES
out = pred.predict(matrix_48h, timestamps_utc=np.array([...], dtype="datetime64[ns]"))
# out["forecasts"][0]["pollutants"]["CO2"]["prediction_source"]  → LSTM | PERSISTENCE | blend
```

## Appels FastAPI (`ia/api.py`)

```bash
cd ia && python api.py
# POST http://localhost:8000/predict
```

Corps JSON : `lookback_values` (48×8), `timestamps_utc` (48 ISO) si calendrier activé.

Chaque heure (après agrégation KPI) :

- `POST /predict` avec `horizon_hours: 4` uniquement
- Charger `lstm_4h_skill_report.json` au démarrage pour mapper fallback par polluant

## Checklist `AIService.js`

- [x] Un appel LSTM 4 h par cycle horaire (`kpiScheduler` après HOURLY)
- [x] Lire `go_deploy` via `GET /health` du microservice Python (+ `lstm_4h_skill_report.json` côté IA)
- [x] Persistance `LstmForecast` + API `/api/ia/forecasts/:siteId/latest`
- [x] Source `LSTM_4H` avec `prediction_source` par polluant
- [x] Fallback persistance géré dans `ia/inference.py` (hybride)
- [x] Pas de modèle 2 h
- [x] Isolation Forest : `POST /detect`, collection `AnomalyDetection`, scheduler IF → LSTM
- [x] Alertes type `Anomaly` si profil multivarié atypique (`IA_CREATE_ANOMALY_ALERTS`)

### Démarrage

```bash
# Terminal 1 — IA
cd ia && pip install -r requirements.txt && python api.py

# Terminal 2 — Backend (ajouter variables depuis backend/env.ia.example)
cd backend && npm start
```

### Endpoints Node

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/ia/health` | Santé LSTM + IF + résumé skill report |
| GET | `/api/ia/forecasts/:siteId/latest` | Dernière prévision stockée |
| POST | `/api/ia/forecasts/:siteId/run` | Déclenchement manuel (admin) |
| POST | `/api/ia/forecasts/run-all` | Tous les sites (admin) |
| GET | `/api/ia/anomalies/:siteId/history` | Historique détections IF |
| POST | `/api/ia/anomalies/:siteId/detect` | IF manuel sur dernier créneau horaire |
| POST | `/api/ia/anomalies/detect-all` | IF tous les sites (admin) |

### Endpoints Python

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/detect` | `feature_values` (6) ordre `NOX, SOX, PM25, PM10, CO2, COV` |
| POST | `/predict` | LSTM 4 h (48×8) |

Artefacts IF requis : `model_isolation_forest.pkl`, `if_scaler.pkl`, `if_metrics.json` (notebook **04**).

Après chaque agrégation HOURLY, le scheduler exécute **IF puis LSTM** (si `IA_ENABLED` / `IA_IF_ENABLED`).

### Mapping polluants DB → LSTM

| MongoDB | Colonne LSTM |
|---------|----------------|
| SO2 | SOX |
| PM25 / PM2.5 | PM25 |
| PM10 (absent) | estimé ≈ PM25 × 1,2 |
| TEMPERATURE, HUMIDITY | défauts 25 °C / 50 % si absents |

## Régénération des rapports

1. Notebook **05** (obligatoire une fois pour `test_site_ids`)
2. Notebook **06** cellule entraînement **ou** cellule « Sprint 1 — rapport skill » seule
