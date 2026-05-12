# Plan d'Entraînement et d'Intégration des Modèles IA

## Vue d'ensemble

Pipeline complet: préparation datasets → entraînement modèles → export → intégration backend

---

## PHASE 1: PRÉPARATION DATASETS (Notebooks)

### 1.1 Notebook: `01_dataset_preparation.ipynb`

**Objectif**: Fusionner et nettoyer 3 sources de données publiques

**Étapes**:

1. Importer EPA AQS data (NO2, SO2, CO, PM2.5, météo)
2. Importer Beijing multi-site data
3. Importer UCI Air Quality data
4. Mapper colonnes vers schéma canonique
5. Harmoniser unités (ppb → ug/m³, conversion T/RH)
6. Contrôle qualité: doublons, valeurs aberrantes, taux manquants
7. Exporter dataset fusionné brut → `ia/data/raw_merged.csv`

**Outputs**:

- `ia/data/raw_merged.csv` (dataset brut fusionné)
- Statistiques de couverture par polluant/source

---

### 1.2 Notebook: `02_data_cleaning_preprocessing.ipynb`

**Objectif**: Nettoyer, interpoler, engineer features

**Étapes**:

1. Charger `raw_merged.csv`
2. Interpolation linéaire pour trous < 5%
3. Lissage EMA (alpha=0.3) pour bruit
4. Marquage flags: `imputed`, `is_outlier`, `synthetic`
5. Feature engineering:
   - mean_10m, std_10m, rate_of_change, rolling_max_30m
   - pollution_index (somme normalisée)
   - corrélation CO2-NOx (proxy CO-NO2 si CO2 absent)
6. Sauvegarder scaler (MinMaxScaler) pour normalisation [0,1]
7. Exporter dataset propre → `ia/data/cleaned_features.csv`
8. Sauvegarder scaler → `ia/models/scaler.pkl`

**Outputs**:

- `ia/data/cleaned_features.csv` (données nettoyées + features)
- `ia/models/scaler.pkl` (MinMaxScaler sauvegardé)
- Histogrammes/distributions avant/après nettoyage

---

### 1.3 Notebook: `03_synthetic_data_generation.ipynb`

**Objectif**: Prioriser l'ingestion des fichiers EPA AQS pour PM10 et VOC (COV). Si EPA non disponible, générer des valeurs synthétiques marquées `synthetic=true` en fallback.

**Étapes**:

1. Charger `cleaned_features.csv`
2. Tenter l'ingestion EPA AQS (lister `file_list.csv`, télécharger/extraire les zips pertinents pour PM10/VOC), mapper vers le schéma canonique et archiver les zips dans `ia/data/epa_raw/` si succès
3. Remplir PM10/COV depuis EPA quand disponibles (alignement temporel), compléter les trous restants avec génération synthétique
4. Générer CO2 synthétique si absent (corrélation avec NO2)
5. Marquer `synthetic=true` pour les lignes générées automatiquement
6. Exporter → `ia/data/training_dataset.csv`

**Outputs**:

- `ia/data/training_dataset.csv` (dataset complet; vraies mesures EPA privilégiées; synthétiques marqués)
- Rapport qualité ingestion (quelle part provient d'EPA vs synthétique)

---

## PHASE 2: ENTRAÎNEMENT MODÈLES (Notebooks)

### 2.1 Notebook: `04_isolation_forest_training.ipynb`

**Objectif**: Entraîner et évaluer Isolation Forest pour détection anomalies

**Étapes**:

1. Charger `training_dataset.csv`
2. Sélectionner features: 8 polluants + 4 stats = 12 dimensions
3. Split temporel strict (70/15/15) par site & polluant
4. Entraîner IF sur train (contamination=0.05, n_estimators=100)
5. Évaluer sur val/test:
   - Precision, Recall, F1-Score
   - Cible: Recall > 0.90
6. Injecter anomalies synthétiques (spikes, dérives) dans test → valider détection
7. Exporter modèle → `ia/models/model_isolation_forest.pkl`
8. Sauvegarder métriques → `ia/models/if_metrics.json`

**Outputs**:

- `ia/models/model_isolation_forest.pkl` (modèle IF)
- `ia/models/if_metrics.json` (Precision, Recall, F1, AUC-ROC)
- Matrice de confusion visualisée
- Seuils de décision optimisés

---

### 2.2 Notebook: `05_lstm_training_preparation.ipynb`

**Objectif**: Préparer tenseurs pour LSTM (lookback=60, horizon=4 & 96)

**Étapes**:

1. Charger `training_dataset.csv`
2. Créer fenêtres glissantes par polluant:
   - Lookback: 60 timesteps
   - Horizon: 4 (1h) et 96 (24h)
   - Pas de shuffle (préserver ordre temporel)
3. Normaliser MinMaxScaler [0,1] par polluant
4. Split train/val/test (70/15/15) temporel strict
5. Sauvegarder:
   - `ia/data/lstm_train_val_test.pkl` (tenseurs prêts)
   - `ia/models/lstm_scalers.pkl` (scalers par polluant)

**Outputs**:

- `ia/data/lstm_train_val_test.pkl` (X_train, y_train, X_val, y_val, X_test, y_test)
- `ia/models/lstm_scalers.pkl` (MinMaxScaler pour chaque polluant)
- Rapport de forme tenseurs (batch_size, lookback, features) pour chaque horizon

---

### 2.3 Notebook: `06_lstm_training_1h_horizon.ipynb`

**Objectif**: Entraîner LSTM pour prédiction 1h (horizon=4)

**Étapes**:

1. Charger tenseurs depuis `lstm_train_val_test.pkl`
2. Filtrer horizon=4 (1h)
3. Construire architecture LSTM:
   - Entrée: (60, 8)
   - LSTM 64 + dropout 0.2 + return_sequences=True → (60, 64)
   - LSTM 32 + dropout 0.2 → (32)
   - Dense 16 + ReLU → (16)
   - Dense 4 (horizon=4) → (4)
4. Compile: MSE loss, Adam optimizer (lr=0.001)
5. Entraîner: batch_size=32, epochs=100, early_stopping (patience=10 val_loss)
6. Évaluer test:
   - RMSE, MAE, MAPE, R²
   - Cibles: RMSE < 10%, R² > 0.85, MAPE < 10%
7. Exporter → `ia/models/model_lstm_1h.h5`
8. Sauvegarder métriques → `ia/models/lstm_1h_metrics.json`

**Outputs**:

- `ia/models/model_lstm_1h.h5` (modèle Keras)
- `ia/models/lstm_1h_metrics.json` (RMSE, MAE, MAPE, R² par polluant)
- Courbes d'entraînement (loss, val_loss) visualisées

---

### 2.4 Notebook: `07_lstm_training_24h_horizon.ipynb`

**Objectif**: Entraîner LSTM pour prédiction 24h (horizon=96)

**Étapes**: Identique à 06 mais horizon=96

**Outputs**:

- `ia/models/model_lstm_24h.h5`
- `ia/models/lstm_24h_metrics.json`

---

## PHASE 3: INTÉGRATION BACKEND (Notebooks + Code Python)

### 3.1 Notebook: `08_model_inference_testing.ipynb`

**Objectif**: Valider inference + préparer API

**Étapes**:

1. Charger modèles (IF, LSTM 1h, LSTM 24h)
2. Charger scalers
3. Tester sur batch test data:
   - IF: 100 samples → anomaly scores
   - LSTM: séquence 60pts → prédiction 4 ou 96 pts
4. Valider temps inférence:
   - IF: < 100ms
   - LSTM: < 500ms
5. Préparer fonctions Python réutilisables:
   - `predict_anomalies(readings_batch, model, scaler)`
   - `predict_lstm(sequence, model, scaler, horizon)`
6. Exporter notebook en script → `ia/inference.py` (version finale)

**Outputs**:

- Benchmark latence (inference time)
- `ia/inference.py` (fonctions réutilisables)

---

### 3.2 Fichier: `ia/api.py` (FastAPI microservice)

**Créé manuellement après validation notebook 08**

**Endpoints**:

- `POST /predict` → LSTM predictions
- `POST /detect` → IF anomaly detection
- `POST /threshold` → règles métier
- `GET /health` → modèle versions

---

### 3.3 Intégration Backend Node.js

**Fichier**: `backend/services/AIService.js` (créer)

**Responsabilités**:

- Appels HTTP vers FastAPI (`http://localhost:5000`)
- Gérer réessais exponentiels si service down
- Log tous les appels + latence
- Créer Alerts dans MongoDB si anomalie/prédiction détectée

---

## PHASE 4: VALIDATION & DÉPLOIEMENT

### 4.1 Notebook: `09_final_validation.ipynb`

**Objectif**: Tests E2E complets

**Étapes**:

1. Simuler flux MQTT → readings MongoDB
2. Appeler services IA (thresholds, IF, LSTM)
3. Vérifier alerts créées correctement
4. Comparaison perf: modèles public vs données locales (si dispo)
5. Rapport final: Recall, Precision, latence globale

---

### 4.2 Docker & Production

**Fichier**: `Dockerfile` (Python service)

---

## STRUCTURE FICHIERS

```
ia/
├── notebooks/
│   ├── 01_dataset_preparation.ipynb
│   ├── 02_data_cleaning_preprocessing.ipynb
│   ├── 03_synthetic_data_generation.ipynb
│   ├── 04_isolation_forest_training.ipynb
│   ├── 05_lstm_training_preparation.ipynb
│   ├── 06_lstm_training_1h_horizon.ipynb
│   ├── 07_lstm_training_24h_horizon.ipynb
│   ├── 08_model_inference_testing.ipynb
│   └── 09_final_validation.ipynb
├── data/
│   ├── raw_merged.csv
│   ├── cleaned_features.csv
│   ├── training_dataset.csv
│   └── lstm_train_val_test.pkl
├── models/
│   ├── scaler.pkl (global normalizer)
│   ├── lstm_scalers.pkl (per-pollutant scalers)
│   ├── model_isolation_forest.pkl
│   ├── model_lstm_1h.h5
│   ├── model_lstm_24h.h5
│   ├── if_metrics.json
│   ├── lstm_1h_metrics.json
│   └── lstm_24h_metrics.json
├── api.py (FastAPI - créé après validation)
├── inference.py (functions from notebook 08)
├── config.py (existant, mise à jour)
└── requirements.txt (existant, mise à jour)
```

---

## TIMELINE ESTIMÉE

| Phase     | Étape                 | Durée                                |
| --------- | --------------------- | ------------------------------------ |
| 1         | Notebooks 01-03       | 4-6h (dépend téléchargement données) |
| 2         | Notebooks 04-07       | 6-8h (entraînement long)             |
| 3         | Notebook 08 + api.py  | 2-3h                                 |
| 3         | AIService.js + Docker | 2-3h                                 |
| 4         | Notebook 09 + tests   | 2-3h                                 |
| **TOTAL** |                       | **18-23h**                           |

---

## CHECKLIST D'EXÉCUTION

- [ ] Notebook 01: Dataset fusionné brut
- [ ] Notebook 02: Dataset nettoyé + features
- [ ] Notebook 03: Données synthétiques (CO2, PM10, COV)
- [ ] Notebook 04: Isolation Forest entraîné + évalué
- [ ] Notebook 05: Tenseurs LSTM préparés
- [ ] Notebook 06: LSTM 1h entraîné
- [ ] Notebook 07: LSTM 24h entraîné
- [ ] Notebook 08: Inference testée + latence validée
- [ ] api.py: FastAPI service créé
- [ ] AIService.js: Backend intégration
- [ ] Docker: Service containerisé
- [ ] Notebook 09: Validation E2E complète

---

## NEXT STEPS

1. Créer structure `/ia/notebooks` et `/ia/data`
2. Démarrer Notebook 01 (téléchargement + fusion données)
3. Itérer notebooks 02-09 dans l'ordre
