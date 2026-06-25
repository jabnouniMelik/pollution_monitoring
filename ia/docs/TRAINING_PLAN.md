# Plan d'Entraînement et d'Intégration des Modèles IA

## Vue d'ensemble

Pipeline complet: préparation datasets → entraînement modèles → export → intégration backend

---

## Cadence temporelle et horizons recommandés

Deux **niveaux** de prédiction LSTM, calibrés sur **pollution_monitoring** (capteurs gaz 10–30 s, KPI **HOURLY** en production v1).

### Niveau 1 — MVP (notebooks 05–06, **maintenant**)

Choix aligné EPA/Beijing/UCI, scheduler KPI (`H:05`), seuils réglementaires **horaires**.

| Paramètre | Valeur | Durée réelle | Rôle |
| --------- | ------ | ------------ | ---- |
| **Pas modèle (`timestep`)** | **1 h** | 1 point/heure | Pré-entraînement + inférence prod v1 |
| **`lookback`** | **48** pas | **48 h** (2 jours) | Contexte cycles jour/nuit + météo |
| **`horizon_short`** | **4** pas | **4 h** | **Seul modèle MVP** (+1…+4 h) |

**Pas de modèle 24 h** à ce stade : horizon trop long pour un système d’émissions gaz (erreur élevée, faible valeur opérationnelle vs alertes courtes).

> **Amélioration LSTM (post-analyse session)** : voir [`LSTM_IMPROVEMENT_STRATEGY.md`](./LSTM_IMPROVEMENT_STRATEGY.md) — skill vs persistance, pertes pondérées, inférence hybride, données prod.

### Règle d’usage — modèles horaires 2 h vs 4 h (intégration prod)

> **À ne pas oublier lors de l’intégration** (`api.py`, `inference.py`, `AIService.js`, UI alertes).

| Attendu à l’entraînement | Rôle en production |
| ------------------------ | ------------------ |
| Le modèle **2 h** bat souvent le **4 h** sur **MAE / R²** (horizon plus court = plus facile). | Ne pas déployer uniquement le 4 h par défaut. |
| **`model_lstm_2h.h5`** | **Alertes serrées** : dépassement seuil prédit à **+1 h / +2 h** (avertissement rapide opérateur). |
| **`model_lstm_4h.h5`** | **Alertes shift / planification** : tendance **+1…+4 h** (conformité, relève de quart, KPI). |

Les deux modèles partagent la même entrée (**48 h** horaires, 8 features) et le même scaler par horizon (`lstm_scalers.pkl` clés `2` et `4`). L’API doit accepter `horizon_hours=2` ou `4` et charger le bon couple modèle + scaler.

Référence code : `ia/config.py` → `LSTM_INTEGRATION`.

### Niveau 2 — Tactique court terme (notebook **07**, **plus tard**)

À activer **uniquement après** agrégation **15 min** fiable en MongoDB **et** dans le CSV d’entraînement (pas d’interpolation massive sur données EPA horaires).

| Paramètre | Valeur | Durée réelle | Rôle |
| --------- | ------ | ------------ | ---- |
| **Pas modèle (`timestep`)** | **15 min** | 1 point / 15 min | Réaction fuites / dérives rapides (stack, ventilation) |
| **`lookback`** | **48** pas | **12 h** de contexte | Historique récent suffisant sans refaire tout le pipeline 48 h |
| **`horizon_tactical`** | **4–8** pas | **1 h – 2 h** à venir | Alerte très courte avant pic ; complète le LSTM 4 h horaire |

Prérequis techniques avant notebook 07 :

1. Agrégats **15 min** dans `readings` (ou collection dérivée) + export `training_dataset_15m.csv` (ou colonne `timestep` explicite).
2. Notebook **05** : second jeu de tenseurs dans `lstm_train_val_test.pkl` (clé ex. `horizon_15m_6` pour 6 × 15 min = 1,5 h, ou `8` pour 2 h).
3. Mise à jour `ia/config.py` → `LSTM_CONFIG` (ex. `timestep_minutes: 15`, `lookback: 48`, `horizon_tactical: 6`).
4. Renommage optionnel du notebook : `07_lstm_training_15m_tactical_horizon.ipynb` (remplace l’ancien 24 h).

### Pourquoi pas 15 min ou 10 s en pré-entraînement (phase 1) ?

- Les sources publiques (notebooks 01–03) sont **horaires** : rééchantillonner en 15 min crée des valeurs interpolées peu fiables pour le très court terme.
- Les capteurs IoT publient toutes les **10–30 s**, mais les **alertes seuil** et les **KPI** s’appuient déjà sur des agrégats **horaires** (`kpiScheduler.js`).
- La **prédiction 4 h horaire** laisse une fenêtre d’action réaliste pour l’opérateur (ventilation, ajustement process).
- **IF + seuils** sur readings brutes / courtes fenêtres couvrent l’urgence sub-heure ; le LSTM 15 min vient **après** infra données locale.

Référence centralisée : `ia/config.py` → `LSTM_CONFIG`.

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
7. **Rééchantillonner à 1 h** par `site_id` + `pollutant` (moyenne horaire ; conserver météo associée)
8. Exporter dataset fusionné brut → `ia/data/raw_merged.csv`

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
5. Feature engineering (fenêtres en **heures**, données à pas 1 h) :
   - mean_6h, std_6h, rate_of_change_1h, rolling_max_12h
   - pollution_index (somme normalisée vs seuils ANPE)
   - corrélation CO2-NOx (proxy CO-NO2 si CO2 absent)
   - hour_of_day, day_of_week (encodage cyclique sin/cos)
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

**Objectif**: Préparer tenseurs LSTM **horaires** (MVP) ; optionnellement tenseurs **15 min** quand les données locales existent.

**Étapes (v1 — obligatoire)**:

1. Charger `training_dataset.csv` (vérifier cadence 1 h ; sinon `resample('1h').mean()`)
2. Créer fenêtres glissantes multi-polluants:
   - Lookback: **48** timesteps (= **48 h**)
   - Horizon: **4** (= **4 h**)
   - Pas de shuffle (ordre temporel strict)
3. Normaliser MinMaxScaler [0,1] par polluant
4. Split train/val/test (70/15/15) temporel strict
5. Sauvegarder:
   - `ia/data/lstm_train_val_test.pkl` (clés `combined_tensors[2]` et `[4]` — scaler fit train only)
   - `ia/models/lstm_scalers.pkl`
   - `ia/data/lstm_metadata.json` (`timestep_minutes: 60`, `lookback: 48`, `horizons: [2, 4]`)

**Étapes (v2 — différé, prérequis agrégats 15 min en DB)**:

1. Charger `training_dataset_15m.csv` (ou `resample('15min').mean()` sur readings Mongo exportés)
2. Fenêtres : lookback **48** pas (= **12 h**), horizon **4–8** pas (= **1–2 h**)
3. Même split / scaler ; ajouter dans le même `.pkl` une entrée ex. `combined_tensors[6]` (6 × 15 min = 1,5 h) ou `[8]` (2 h)
4. Mettre à jour `lstm_metadata.json` (`timestep_minutes: 15`, second horizon documenté)

**Outputs**:

- `ia/data/lstm_train_val_test.pkl`
- `ia/models/lstm_scalers.pkl`
- `ia/data/lstm_metadata.json`
- Rapport tenseurs v1 : `(batch, 48, 8)` → `(batch, 4, 8)`
- Rapport tenseurs v2 (plus tard) : `(batch, 48, 8)` → `(batch, 4–8, 8)` @ 15 min

---

### 2.3 Notebook: `06_lstm_training_4h_horizon.ipynb`

**Objectif**: Entraîner LSTM **2 h** (tactique) et **4 h** (principal) — pas horaire, helpers `ia/lstm_training.py`.

**Étapes**:

1. Charger tenseurs `combined_tensors[2]` et `[4]` depuis `lstm_train_val_test.pkl`
2. Architecture (`build_lstm_model`): **(48, 8)** → **(horizon, 8)** ; LSTM tanh + `recurrent_dropout`
3. Compile: **Huber** (δ=0.05), Adam + `clipnorm=1`, callbacks EarlyStopping + ReduceLROnPlateau
4. Entraîner chaque horizon (batch 32, epochs 100)
5. Évaluer test: RMSE, MAE, R² (pas de MAPE sur [0,1])
6. Exporter → `model_lstm_2h.h5`, `model_lstm_4h.h5` + métriques / courbes

**Outputs**:

- `ia/models/model_lstm_2h.h5`, `model_lstm_4h.h5`
- `lstm_2h_metrics.json`, `lstm_4h_metrics.json`
- Courbes et plots par horizon

**Note intégration** : comparer `lstm_2h_metrics.json` vs `lstm_4h_metrics.json` — le **2 h** devrait souvent avoir un MAE/R² meilleur ; en prod utiliser **4 h** pour les alertes shift et **2 h** pour les avertissements plus serrés (voir § « Règle d’usage »).

---

### 2.4 Notebook: `07_lstm_training_15m_tactical_horizon.ipynb` (différé)

> **Statut** : non requis pour le MVP. Remplace l’ancien plan « 24 h horaire ». Fichier actuel `07_lstm_training_24h_horizon.ipynb` à adapter ou renommer lors de l’implémentation.

**Objectif**: LSTM **tactique** pour émissions gaz — prédiction **1–2 h** avec pas **15 min**, après agrégation DB + CSV 15 min.

**Prérequis**:

- Agrégation **15 min** stable (`readings` → pipeline export)
- Tenseurs 15 min générés par notebook **05** (v2)
- `LSTM_CONFIG` : `timestep_minutes: 15`, `lookback: 48` (12 h), `horizon_tactical: 4` à `8`

**Étapes**:

1. Charger tenseurs horizon tactique (ex. clé `6` ou `8` dans `lstm_train_val_test.pkl`)
2. Architecture LSTM (identique à 06):
   - Entrée: **(48, 8)** — 48 × 15 min = **12 h** × 8 polluants
   - Sortie: **(4–8, 8)** — **1 h à 2 h** à venir (pas de 24 h)
3. Compile / entraînement : même hyperparamètres que 06 (ajuster si RMSE dégrade sur horizon court)
4. Évaluer test : RMSE, MAE, R² ; **ignorer MAPE** sur données normalisées proches de 0
5. Exporter → `ia/models/model_lstm_15m_tactical.h5`
6. Métriques → `ia/models/lstm_15m_tactical_metrics.json`

**Outputs**:

- `ia/models/model_lstm_15m_tactical.h5`
- `ia/models/lstm_15m_tactical_metrics.json`

**Complémentarité avec notebook 06** (horaire) et **07** (15 min, différé) :

| Modèle | Pas | Contexte | Horizon | Usage prod |
| ------ | --- | -------- | ------- | ---------- |
| 06 — **2 h** horaire | 1 h | 48 h | 2 h | **Alertes serrées** (+1/+2 h) — souvent meilleur MAE/R² |
| 06 — **4 h** horaire | 1 h | 48 h | 4 h | **Shift / conformité** (+1…+4 h) |
| 07 — tactique 15 min | 15 min | 12 h | 1–2 h | Pic rapide, fuite (après agrégats DB) |

---

## PHASE 3: INTÉGRATION BACKEND (Notebooks + Code Python)

### 3.0 Checklist intégration LSTM 2 h + 4 h (obligatoire)

- [ ] Charger **deux** modèles : `model_lstm_2h.h5`, `model_lstm_4h.h5`
- [ ] Charger **deux** scalers depuis `lstm_scalers.pkl` (clés `2` et `4`, pas un scaler unique)
- [ ] `POST /predict?horizon_hours=2|4` — refuser les autres valeurs en MVP horaire
- [ ] **Alertes serrées** : règles métier sur prédiction **2 h** (seuil dépassé à +1 ou +2 h)
- [ ] **Alertes shift** : règles sur prédiction **4 h** (+1…+4 h) ; affichage dashboard / KPI
- [ ] Scheduler : les **deux** inférences **toutes les heures** (même agrégat 1 h en entrée)
- [ ] `GET /health` : exposer versions + métriques test des deux modèles
- [ ] Ne pas utiliser le 4 h seul parce qu’il est « principal » dans `horizon_short` — le 2 h est complémentaire

### 3.1 Notebook: `08_model_inference_testing.ipynb`

**Objectif**: Valider inference + préparer API

**Étapes**:

1. Charger modèles (IF ; LSTM **2 h** + **4 h** horaires ; LSTM 15m si entraîné plus tard)
2. Charger scalers `{2: scaler_2h, 4: scaler_4h}` + `lstm_metadata.json`
3. Tester sur batch test data:
   - IF: 100 samples → anomaly scores
   - LSTM **2 h** : séquence **48 h** → **+1/+2 h** (alertes serrées)
   - LSTM **4 h** : séquence **48 h** → **+1…+4 h** (shift / conformité)
   - LSTM 15m (différé) : séquence **12 h** @ 15 min → **1–2 h**
4. Inférence prod :
   - Modèle **06** : agréger `readings` en **1 h**
   - Modèle **07** : agréger `readings` en **15 min** (après mise en place agrégats DB)
4. Valider temps inférence:
   - IF: < 100ms
   - LSTM: < 500ms
5. Préparer fonctions Python réutilisables:
   - `predict_anomalies(readings_batch, model, scaler)`
   - `predict_lstm(sequence, horizon_hours=2|4)` — sélection auto modèle + scaler via `LSTM_INTEGRATION`
6. Exporter notebook en script → `ia/inference.py` (version finale)

**Outputs**:

- Benchmark latence (inference time)
- `ia/inference.py` (fonctions réutilisables)

---

### 3.2 Fichier: `ia/api.py` (FastAPI microservice)

**Créé manuellement après validation notebook 08**

**Endpoints**:

- `POST /predict` → body/query `horizon_hours`: **2** (alertes serrées) ou **4** (shift) ; réponse = séries par polluant sur +1…+H h
- Option future : `timestep=15m` + modèle 07 pour tactique sub-horaire
- Documenter dans OpenAPI : le **2 h** est souvent plus précis (MAE/R²) mais ne remplace pas le **4 h** pour la planification shift
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
- Créer **Alert** `Warning` / `High` si seuil réglementaire **prédit dépassé** :
  - source `LSTM_2H` → prédiction **2 h** (alerte serrée, +1/+2 h)
  - source `LSTM_4H` → prédiction **4 h** (alerte shift, +1…+4 h)
- Appeler **les deux** LSTM **chaque heure** (après agrégation horaire KPI) ; ne pas fusionner les deux en une seule alerte sans règle métier explicite
- Phase 2 : LSTM 15 min (notebook 07) en complément, pas en remplacement du 2 h horaire

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
│   ├── 06_lstm_training_4h_horizon.ipynb
│   ├── 07_lstm_training_15m_tactical_horizon.ipynb  # différé (ex-24h)
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
│   ├── model_lstm_2h.h5              # alertes serrées (+1/+2 h)
│   ├── model_lstm_4h.h5              # shift / conformité (+1…+4 h)
│   ├── model_lstm_15m_tactical.h5   # différé
│   ├── if_metrics.json
│   ├── lstm_2h_metrics.json
│   ├── lstm_4h_metrics.json
│   ├── lstm_15m_tactical_metrics.json  # différé
│   └── lstm_metadata.json (timestep, lookback, horizons par modèle)
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
| 2         | Notebooks 04-06       | 4-6h (MVP ; 07 différé +15 min DB)   |
| 2b        | Notebook 07 (15 min)  | +2-3h après agrégats MongoDB         |
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
- [ ] Notebook 06: LSTM 2h + 4h horaires entraînés (MVP)
- [ ] Cadence 1 h validée sur `training_dataset.csv`
- [ ] Agrégats 15 min en DB + `training_dataset_15m.csv` (prérequis notebook 07)
- [ ] Notebook 07: LSTM tactique 15 min (1–2 h ahead) — **différé**
- [ ] Notebook 08: Inference testée (2 h **et** 4 h) + latence validée
- [ ] api.py: `POST /predict` avec `horizon_hours=2|4` + `LSTM_INTEGRATION`
- [ ] AIService.js: alertes distinctes `LSTM_2H` vs `LSTM_4H` (ne pas oublier le 2 h si MAE meilleur)
- [ ] UI / rapports : libellés « Avertissement 2 h » vs « Anticipation shift 4 h »
- [ ] Docker: Service containerisé
- [ ] Notebook 09: Validation E2E complète

---

## NEXT STEPS

1. Créer structure `/ia/notebooks` et `/ia/data`
2. Démarrer Notebook 01 (téléchargement + fusion données)
3. Itérer notebooks 02-09 dans l'ordre
