# Documentation Complète — Module Intelligence Artificielle

## Système de Monitoring de la Pollution Industrielle en Tunisie

---

## Table des Matières

1. [Introduction et Objectifs](#1-introduction-et-objectifs)
2. [Architecture du Module IA](#2-architecture-du-module-ia)
3. [Structure des Fichiers](#3-structure-des-fichiers)
4. [Modèles Développés](#4-modèles-développés)
5. [Étude Comparative des Datasets](#5-étude-comparative-des-datasets)
6. [Pipeline de Développement](#6-pipeline-de-développement)
7. [Résultats et Métriques](#7-résultats-et-métriques)
   - [7.5 Évaluation intégrée (simulateur + production)](#75-évaluation-intégrée-simulateur--production)
8. [Intégration avec le Backend](#8-intégration-avec-le-backend)
9. [Conclusions et Perspectives](#9-conclusions-et-perspectives)
   - [9.4 Feuille de route — prochaines étapes](#94-feuille-de-route--prochaines-étapes)

---

## 1. Introduction et Objectifs

### 1.1 Contexte

Le module IA fait partie intégrante du système de monitoring de la pollution industrielle, conçu pour surveiller les émissions atmosphériques dans un contexte de cimenterie tunisienne, conformément au **Décret 2018-928** (Norme Tunisienne Décret 2018-928).

### 1.2 Objectifs du Module IA

| Objectif | Modèle | Description |
|----------|--------|-------------|
| **Prédiction temporelle** | LSTM (4h) | Anticiper l'évolution des concentrations de polluants sur un horizon de +1h à +4h |
| **Détection d'anomalies** | Isolation Forest | Identifier les profils multivariés anormaux (pics, dérives, incohérences capteur) |

### 1.3 Polluants Surveillés

| Polluant | Unité | VLE (Décret 2018-928) | Type |
|----------|-------|------------------------|------|
| CO2 | ppm | 800 | Gaz à effet de serre |
| NOX | mg/Nm³ | 800 | Oxydes d'azote |
| SOX (SO2) | mg/Nm³ | 400 | Dioxyde de soufre |
| PM2.5 | mg/m³ | 20 | Particules fines |
| PM10 | mg/m³ | 30 | Particules en suspension |
| COV | mg/Nm³ | 110 | Composés organiques volatils |
| Température | °C | — | Contextuel |
| Humidité | %RH | — | Contextuel |

> **VLE** = Valeur Limite d'Émission réglementaire

---

## 2. Architecture du Module IA

### 2.1 Architecture Globale

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ HistoryChart │  │ AIPredictions│  │ ForecastBanner│  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼────────────────┼───────────────────┼──────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│               BACKEND (Node.js / Express)                 │
│  ┌──────────┐  ┌───────────┐  ┌────────────────────┐   │
│  │AIService │  │kpiScheduler│  │iaController/Routes │   │
│  └────┬─────┘  └─────┬─────┘  └────────────────────┘   │
└───────┼───────────────┼─────────────────────────────────┘
        │               │
        ▼               ▼
┌─────────────────────────────────────────────────────────┐
│           MICROSERVICE IA (Python / FastAPI)              │
│                   Port 8000                               │
│  ┌────────────────┐        ┌──────────────────────┐     │
│  │  LSTM4HPredictor│        │  IFAnomalyDetector   │     │
│  │  (inference.py) │        │  (if_inference.py)   │     │
│  └────────┬───────┘        └──────────┬───────────┘     │
│           │                           │                  │
│  ┌────────▼───────┐        ┌──────────▼───────────┐     │
│  │model_lstm_4h.h5│        │model_isolation_forest │     │
│  │lstm_scalers.pkl│        │if_scaler.pkl          │     │
│  └────────────────┘        └──────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Flux de Données

```
Capteurs → Simulator.js → MongoDB (Readings)
                              │
                              ▼
                   Agrégation Horaire (KPI)
                              │
                              ▼
              ┌───────────────┼───────────────┐
              │                               │
              ▼                               ▼
    Matrice 48×8 (LSTM)              Vecteur 6D (IF)
              │                               │
              ▼                               ▼
    POST /predict                    POST /detect
              │                               │
              ▼                               ▼
    Prévisions +1h..+4h            Normal / Anomalie
              │                               │
              ▼                               ▼
    MongoDB (LstmForecast)      MongoDB (AnomalyDetection)
              │                               │
              ▼                               ▼
         Alertes (si dépassement VLE prévu)
```

### 2.3 Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | État des modèles (LSTM + IF) |
| POST | `/predict` | Prédiction LSTM horizon 4h |
| POST | `/detect` | Détection d'anomalie IF |

---

## 3. Structure des Fichiers

```
ia/
├── config.py                          # Configuration centrale
├── api.py                             # Microservice FastAPI
├── inference.py                       # Inférence LSTM (classe LSTM4HPredictor)
├── if_inference.py                    # Inférence IF (classe IFAnomalyDetector)
├── lstm_training.py                   # Fonctions d'entraînement LSTM
├── generate_industrial_dataset.py     # Générateur dataset hybride
├── data/
│   ├── training_dataset.csv           # Dataset actif (industriel hybride)
│   ├── training_dataset.csv.bak       # Ancien dataset (EPA/UCI/Beijing)
│   ├── lstm_train_val_test.pkl        # Tenseurs préparés
│   └── lstm_metadata.json             # Métadonnées entraînement
├── models/
│   ├── model_lstm_4h.h5               # Modèle LSTM exporté
│   ├── model_lstm_4h.keras            # Format Keras natif
│   ├── lstm_scalers.pkl               # MinMaxScaler + bornes winsorization
│   ├── model_isolation_forest.pkl     # Modèle IF
│   ├── if_scaler.pkl                  # StandardScaler IF
│   ├── if_metrics.json                # Métriques IF
│   ├── lstm_4h_metrics.json           # Métriques LSTM
│   └── lstm_4h_skill_report.json      # Rapport skill détaillé
├── notebooks/
│   ├── 01_dataset_preparation.ipynb
│   ├── 02_data_cleaning_preprocessing_FIXED.ipynb
│   ├── 03_synthetic_data_generation.ipynb
│   ├── 04_isolation_forest_training.ipynb
│   ├── 05_lstm_training_preparation.ipynb
│   ├── 06_lstm_training_4h_horizon.ipynb
│   └── 07_lstm_training_24h_horizon.ipynb
├── scripts/
│   ├── retrain_if.py                  # Réentraînement IF
│   ├── retrain_lstm.py                # Réentraînement LSTM complet
│   ├── analyze_simulator_vs_models.py # Validation croisée
│   └── test_api_predict.py            # Test endpoint /predict
└── docs/
    ├── TRAINING_PLAN.md
    ├── LSTM_IMPROVEMENT_STRATEGY.md
    └── AIService.integration.md
```

---

## 4. Modèles Développés

### 4.1 LSTM — Long Short-Term Memory (Prédiction Temporelle)

#### Architecture

```
Input (48, 8) → LSTM(64, return_sequences=True, activation=relu)
             → Dropout(0.2)
             → LSTM(32, activation=relu)
             → BatchNormalization
             → Dropout(0.2)
             → Dense(16, activation=relu)
             → Dense(32)
             → Reshape(4, 8)
             → Output (4 pas × 8 polluants)
```

#### Hyperparamètres

| Paramètre | Valeur | Justification |
|-----------|--------|---------------|
| Lookback | 48 heures | 2 cycles jour/nuit complets |
| Horizon | 4 heures | Planification opérationnelle (shift) |
| Pas temporel | 1 heure | Aligné sur les agrégations KPI |
| Batch size | 32 | Compromis vitesse/stabilité gradient |
| Learning rate | 0.001 (Adam) | Réduit × 0.5 si plateau (patience=4) |
| Epochs | 100 (max) | Early stopping patience=15 |
| Loss | Huber pondérée | Robuste aux outliers, poids par polluant |
| Activation | ReLU | Meilleur R² test vs tanh sur ce jeu |
| Gradient clipping | 1.0 | Stabilité entraînement |
| Split temporel | 70/15/15 | Train/Val/Test (pas de shuffle) |

#### Pondération par Polluant (Loss)

| Polluant | Poids | Raison |
|----------|-------|--------|
| CO2 | 2.0 | Indicateur principal de combustion |
| PM10 | 2.0 | Réglementation stricte |
| TEMPERATURE | 1.2 | Contexte météo important |
| COV | 0.5 | Variabilité modérée |
| HUMIDITY | 0.5 | Contextuel |
| NOX, SOX, PM25 | 0.3 | Corrélés à CO2 (redondance partielle) |

#### Mécanisme Hybride (LSTM + Persistance)

Le système utilise un **fallback intelligent** : pour chaque polluant, si le skill score est négatif (LSTM pire que la persistance), la prédiction finale utilise la dernière valeur observée (persistance) au lieu de la sortie LSTM.

```
prediction_finale = α × LSTM + (1-α) × Persistance

avec α = 1.0 si skill > 0, α = 0.0 sinon
```

### 4.2 Isolation Forest — Détection d'Anomalies

#### Principe

L'Isolation Forest isole les observations en construisant des arbres de décision aléatoires. Les anomalies, étant rares et différentes, sont isolées plus rapidement (moins de coupures nécessaires) → score d'anomalie plus négatif.

#### Configuration

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| n_estimators | 100 | Nombre d'arbres |
| contamination | 0.05 | 5% d'anomalies attendues |
| max_samples | auto | Échantillon par arbre |
| Features | 6 | NOX, SOX, PM25, PM10, CO2, COV |
| Normalisation | StandardScaler | Centré-réduit (μ=0, σ=1) |
| Seuil décision | -0.20 | score < seuil → anomalie |

#### 4.2.1 Réglage du seuil IF (`score_threshold`)

Le seuil de décision Isolation Forest est défini **une seule fois** dans le fichier de configuration Python :

| Fichier | Clé | Valeur actuelle |
|---------|-----|-----------------|
| **`ia/config.py`** | `ISOLATION_FOREST["score_threshold"]` | **`-0.20`** |

```python
# ia/config.py — bloc ISOLATION_FOREST (ligne ~183)
ISOLATION_FOREST = {
    ...
    "score_threshold": -0.20,   # ← modifier ici
}
```

**Règle de décision** (`ia/if_inference.py`) :

```python
is_anomaly = score < self.score_threshold
```

| Score `decision_function` | Interprétation |
|---------------------------|----------------|
| Proche de 0 ou positif | Profil « normal » (typique Four, Broyage) |
| Entre -0.20 et 0 | Zone grise — encore classé normal avec seuil -0.20 |
| **< -0.20** | **Anomalie** confirmée |

**Effet d'un abaissement du seuil** (ex. `-0.22` au lieu de `-0.20`) :

- ✅ Plus sensible aux pics **univariés** (ex. NOX ×5 seul)
- ⚠️ Risque de faux positifs sur profils légèrement atypiques

**Effet d'un relèvement** (ex. `-0.15`) :

- ✅ Moins de faux positifs
- ⚠️ Anomalies modérées peuvent passer inaperçues

**Après modification** : redémarrer le microservice IA (`python api.py`). Le seuil est exposé dans `GET /health` → `isolation_forest.score_threshold`.

> **Note** : le paramètre `contamination=0.05` dans le même bloc influence l'entraînement sklearn, pas le seuil runtime. Pour recalibrer le seuil à partir des scores validation, réentraîner via `python scripts/retrain_if.py` puis ajuster `score_threshold` selon la distribution des scores sur le jeu de validation.

#### Sévérité (calculée à partir du seuil)

| Niveau | Condition (score) | Action |
|--------|-------------------|--------|
| Warning | < -0.20 | Notification opérateur |
| High | < -0.35 | Alerte immédiate |
| Critical | < -0.50 | Arrêt ligne recommandé |

| Split | 70/15/15 | Chronologique |

#### Types d'Anomalies Détectées

| Type | Description | Exemple Industriel |
|------|-------------|-------------------|
| Spike | Pic soudain multivarié | Démarrage four non prévu |
| Drift | Dérive lente | Colmatage progressif d'un filtre |
| Incohérence | Profil multivarié impossible | PM élevés sans CO2/NOX associés |

---

## 5. Étude Comparative des Datasets

### 5.1 Approche 1 : Données Publiques (EPA / UCI / Beijing)

#### Sources

| Dataset | Origine | Période | Type | Taille |
|---------|---------|---------|------|--------|
| EPA AQS | États-Unis | 2025 | Air ambiant urbain | ~80k lignes |
| UCI Air Quality | Italie | 2004-2005 | Air urbain | ~50k lignes |
| Beijing Multi-Site | Chine | 2013-2017 | Air urbain | ~49k lignes |

**Total** : ~179 000 lignes, 25 sites

#### Caractéristiques

- Mesures d'air **ambiant** (concentrations atmosphériques faibles)
- Unités variables (ppb, ppm, μg/m³)
- Contexte urbain / résidentiel
- Aucune donnée d'émission industrielle en cheminée

#### Problème : Domain Shift

Le **domain shift** (décalage de domaine) est le problème fondamental de cette approche. Les distributions statistiques des données d'entraînement sont radicalement différentes de celles de la production :

| Polluant | Plage EPA/UCI | Plage Simulateur Tunisien | Facteur |
|----------|---------------|---------------------------|---------|
| NOX | 0.02–0.08 ppm | 374–680 mg/Nm³ | ~10000× |
| SOX | 0.001–0.03 ppm | 187–340 mg/Nm³ | ~5000× |
| PM2.5 | 5–35 μg/m³ | 9.4–17 mg/m³ | ~500× |
| CO2 | 400–420 ppm | 357–650 ppm | ~1.5× |
| COV | 10–100 ppb | 50–90 mg/Nm³ | ~1000× |

#### Résultats avec Dataset EPA (Avant)

**LSTM :**

| Polluant | Skill Score | Interprétation |
|----------|-------------|----------------|
| CO2 | +15.2% | Bon (unités comparables) |
| NOX | **-205%** | Catastrophique — modèle n'a jamais vu ces niveaux |
| SOX | **-86%** | Très mauvais |
| PM2.5 | **-370%** | Impossible à utiliser |
| PM10 | **-125%** | Inutilisable |
| COV | -45% | Mauvais |

**Isolation Forest :**

- Score moyen profil simulateur "Four" : **-0.22** → classé ANOMALIE systématiquement
- **100% de faux positifs** sur les données normales du simulateur
- Le modèle considère TOUT profil industriel tunisien comme une anomalie car il n'a jamais vu ces concentrations

**Dénormalisation LSTM :**

Le MinMaxScaler appris sur les ranges EPA (0–420 ppm CO2) ne peut pas dénormaliser vers les ranges industriels (357–650 ppm CO2). Les valeurs physiques retournées étaient incohérentes (ex : CO2 prédit = 251 230 ppm suite à un bug de double dénormalisation amplifié par le mauvais scaler).

### 5.2 Approche 2 : Dataset Hybride Industriel Tunisien

#### Principe de Génération

Le dataset hybride est généré par `generate_industrial_dataset.py` selon les principes suivants :

1. **Niveaux calibrés** sur `simulator.js` (PROFILES × ZONE_MULT)
2. **Patterns temporels réalistes** : cycles jour/nuit (double pic matin/soir), réduction weekend
3. **Corrélations industrielles** : CO2 ↔ NOX (combustion commune), PM10 ≈ 1.2×PM25
4. **Variabilité inter-sites** : 6 sites avec multiplicateurs de zone différents
5. **Anomalies industrielles** : 5% injectées (spikes, dérives, incohérences)
6. **Cadence horaire native** : pas de resampling nécessaire

#### Sites Synthétiques

| Site | Multiplicateur | Zone Simulée |
|------|----------------|--------------|
| site_four_A | ×1.00 | Four à clinker (émission max) |
| site_four_B | ×0.95 | Four secondaire |
| site_broyage | ×0.65 | Broyeur cru |
| site_stockage | ×0.55 | Stockage / manutention |
| site_expedition | ×0.50 | Expédition |
| site_mixed | ×0.80 | Zone mixte |

#### Paramètres du Générateur

| Caractéristique | Valeur |
|-----------------|--------|
| Durée | 90 jours par site |
| Sites | 6 |
| Pas temporel | 1 heure |
| Total lignes | 103 680 |
| Anomalies | 5% (~650 heures) |
| Bruit capteur | 4–15% de la baseline |
| Cycle journalier | Double pic gaussien (9h30, 17h30) |
| Cycle hebdomadaire | Weekend à 60% |
| Saisonnalité température | Sinusoïdale (15°C hiver → 35°C été) |
| Corrélation CO2↔NOX | +12% couplage |
| Corrélation NOX→SOX | +8% couplage |

#### Résultats avec Dataset Hybride Industriel (Après)

**LSTM :**

| Polluant | Skill Score | R² | Interprétation |
|----------|-------------|-----|----------------|
| CO2 | **+5.9%** | 0.684 | LSTM bat la persistance |
| NOX | **+6.1%** | 0.692 | LSTM bat la persistance |
| SOX | **+14.1%** | 0.636 | Bon gain |
| PM2.5 | **+23.7%** | 0.466 | Très bon gain |
| PM10 | **+24.1%** | 0.460 | Très bon gain |
| COV | **+16.9%** | 0.559 | Bon gain |
| Temperature | 0.0% | — | Prévisible (fallback persistance) |
| Humidity | -23.8% | — | Contextuel (fallback persistance) |

**Métriques globales LSTM :**

| Métrique | LSTM | Persistance | Amélioration |
|----------|------|-------------|--------------|
| MAE | 0.0895 | 0.0958 | -6.7% |
| RMSE | 0.1250 | 0.1483 | -15.7% |
| R² | 0.846 | 0.783 | +8.0% |
| Skill global | — | — | **+6.65%** |

**Isolation Forest :**

| Profil Testé | Score | Décision | Attendu |
|--------------|-------|----------|---------|
| Four ×1.0 (normal) | -0.148 | **NORMAL** | Correct |
| Broyage ×0.65 (normal) | +0.121 | **NORMAL** | Correct |
| Stockage ×0.55 (normal) | +0.139 | **NORMAL** | Correct |
| Spike industriel (×2) | -0.263 | **ANOMALIE** | Correct |

- **0% de faux positifs** sur les profils normaux du simulateur
- Taux d'anomalies détecté sur test : 5.5% (cohérent avec les 5% injectés)

**Dénormalisation LSTM :**

| Polluant | Entrée (physique) | Prédiction +1h | Δ% | Cohérence |
|----------|-------------------|----------------|-----|-----------|
| CO2 | 685 ppm | 537 ppm | -22% | Réaliste (régression moyenne) |
| NOX | 728 mg/Nm³ | 661 mg/Nm³ | -9% | Cohérent (persistance) |
| PM10 | 21.5 mg/m³ | 16.8 mg/m³ | -22% | Réaliste |
| SOX | 370 mg/Nm³ | 320 mg/Nm³ | -14% | Cohérent (persistance) |

### 5.3 Tableau Comparatif Synthétique

| Critère | Dataset EPA/UCI/Beijing | Dataset Hybride Industriel |
|---------|------------------------|---------------------------|
| **Taille** | 179 000 lignes, 25 sites | 103 680 lignes, 6 sites |
| **Domaine** | Air ambiant urbain | Émissions industrielles cheminée |
| **Cohérence avec production** | Aucune | Totale (calibré simulateur) |
| **LSTM Skill global** | Négatif (< -50%) | **+6.65%** |
| **LSTM Skill CO2** | +15% | **+5.9%** |
| **LSTM Skill NOX** | **-205%** | **+6.1%** |
| **LSTM Skill SOX** | **-86%** | **+14.1%** |
| **LSTM Skill PM2.5** | **-370%** | **+23.7%** |
| **IF Faux positifs** | **100%** | **0%** |
| **IF Détection anomalies** | Inutilisable | 5.5% (correct) |
| **Dénormalisation** | Incohérente (×1000 erreur) | Correcte (±22% max) |
| **Utilisable en production** | Non | **Oui** |

### 5.4 Analyse du Domain Shift

Le domain shift entre les deux approches provient de trois facteurs :

1. **Écart de concentrations** : les émissions industrielles en cheminée sont 100 à 10000× plus concentrées que l'air ambiant urbain

2. **Corrélations différentes** : en milieu urbain, NOX provient du trafic (corrélé heures de pointe), en cimenterie il provient du four (corrélé CO2/température clinker)

3. **Dynamique temporelle** : l'industrie a des cycles opérationnels (shifts 3×8h, arrêts weekend partiels) vs les cycles urbains (trafic pendulaire)

Le dataset hybride résout ces trois problèmes en calibrant les niveaux, corrélations et cycles sur le contexte réel du simulateur tunisien.

---

## 6. Pipeline de Développement

### 6.1 Vue d'Ensemble du Pipeline

```
Phase 1: Acquisition et Préparation
    │
    ├── Notebook 01: Collecte datasets publics (EPA, UCI, Beijing)
    ├── Notebook 02: Nettoyage et prétraitement
    └── Notebook 03 / generate_industrial_dataset.py: Génération synthétique
    │
Phase 2: Entraînement des Modèles
    │
    ├── Notebook 04 / retrain_if.py: Isolation Forest
    ├── Notebook 05 / retrain_lstm.py: Préparation tenseurs LSTM
    └── Notebook 06 / retrain_lstm.py: Entraînement LSTM 4h
    │
Phase 3: Validation et Déploiement
    │
    ├── analyze_simulator_vs_models.py: Validation croisée
    ├── api.py: Microservice FastAPI
    └── Backend Node.js: Intégration complète
```

### 6.2 Phase 1 — Préparation des Données

#### Étape 1.1 : Collecte (Notebooks 01-02)

Les datasets publics ont été collectés et normalisés en format long :
```
timestamp_utc, site_id, pollutant, value, temperature_c, humidity_percent
```

#### Étape 1.2 : Génération Dataset Industriel

Le script `generate_industrial_dataset.py` produit un dataset calibré :

1. Pour chaque site, pour chaque heure sur 90 jours :
   - Calcul du pattern d'activité (cycle journalier × cycle hebdomadaire)
   - Application de la baseline polluant × multiplicateur zone × activité
   - Ajout de tendance lente (hebdomadaire) + bruit capteur
   - Injection de corrélations inter-polluants (CO2→NOX, NOX→SOX, PM25→PM10)

2. Injection d'anomalies (5%) :
   - **Spikes** (50%) : multiplication ×1.3–2.0 pendant 1–5 heures
   - **Dérives** (30%) : croissance linéaire ×1.2–1.6 sur 4–12 heures
   - **Incohérences** (20%) : PM élevés sans augmentation CO2/NOX

### 6.3 Phase 2 — Entraînement

#### Étape 2.1 : Isolation Forest (Notebook 04)

```python
# Pipeline IF
1. Charger training_dataset.csv
2. Pivot (timestamp_utc, site_id) → colonnes: [NOX, SOX, PM25, PM10, CO2, COV]
3. StandardScaler : centrer-réduire chaque colonne
4. Split temporel 70/15/15
5. Entraîner IsolationForest(n_estimators=100, contamination=0.05)
6. Évaluer : % anomalies sur val/test
7. Exporter : model_isolation_forest.pkl + if_scaler.pkl
```

#### Étape 2.2 : Préparation Tenseurs LSTM (Notebook 05)

```python
# Pipeline préparation
1. Charger CSV → pivot → hourly wide (8 polluants par site)
2. Par site :
   a. Construire fenêtres glissantes (48h input → 4h output)
   b. Split temporel 70/15/15
3. Fusionner tous les sites
4. Winsorization (percentiles p1–p99 sur train)
5. MinMaxScaler [0, 1] (fit sur train+target)
6. Exporter tenseurs (.pkl) + scaler + metadata
```

**Dimensions des tenseurs :**
- X_train : (8856, 48, 8) — 8856 fenêtres × 48 pas × 8 polluants
- y_train : (8856, 4, 8) — 4 pas futurs × 8 polluants
- X_val : (1896, 48, 8)
- X_test : (1902, 48, 8)

#### Étape 2.3 : Entraînement LSTM (Notebook 06)

```python
# Pipeline LSTM
1. Charger tenseurs depuis pickle
2. Construire modèle séquentiel (LSTM → LSTM → BN → Dense → Reshape)
3. Compiler : Huber pondérée, Adam(lr=0.001, clipnorm=1.0)
4. Callbacks :
   - SkillVsPersistence : calcul val_skill à chaque epoch
   - EarlyStopping(monitor='val_skill', patience=15, mode='max')
   - ReduceLROnPlateau(factor=0.5, patience=4)
   - ModelCheckpoint (meilleur val_skill)
5. Entraîner (max 100 epochs, arrêt epoch 54 par early stopping)
6. Évaluer : MAE, RMSE, R², skill global et par polluant
7. Exporter modèle + métriques + rapport skill
```

### 6.4 Phase 3 — Validation et Déploiement

#### Validation Croisée

Le script `analyze_simulator_vs_models.py` vérifie :
1. IF classifie les profils normaux du simulateur comme "NORMAL"
2. IF classifie les profils anomaliques comme "ANOMALIE"
3. LSTM dénormalise vers des valeurs physiques cohérentes
4. Les prédictions sont dans les plages attendues (±30% de la baseline)

#### Critères d'Acceptation (go/no-go)

| Critère | Seuil | Résultat | Statut |
|---------|-------|----------|--------|
| Skill global | ≥ 0.02 | 0.0665 | PASS |
| Skill CO2 | ≥ 0.05 | 0.0587 | PASS |
| Skill PM10 | ≥ 0.08 | 0.2414 | PASS |
| MAE ratio +1h | ≤ 1.15 | 0.945 | PASS |
| LSTM bat persistance | Oui | Oui (6/8) | PASS |

**Décision** : `go_deploy = true` (déploiement avec fallback persistance sur HUMIDITY)

---

## 7. Résultats et Métriques

### 7.1 Performance LSTM par Horizon

| Horizon | MAE LSTM | MAE Persistance | Skill | R² |
|---------|----------|-----------------|-------|-----|
| +1h | 0.0779 | 0.0825 | +5.5% | 0.881 |
| +2h | 0.0874 | 0.0913 | +4.3% | 0.856 |
| +3h | 0.0963 | 0.1017 | +5.3% | 0.828 |
| +4h | 0.0962 | 0.1078 | +10.8% | 0.819 |

> Le gain augmente avec l'horizon — le LSTM apprend des patterns que la persistance ne peut pas capturer à +4h.

### 7.2 Performance LSTM par Polluant

| Polluant | MAE LSTM | MAE Persistance | Skill | R² LSTM |
|----------|----------|-----------------|-------|---------|
| CO2 | 0.0987 | 0.1048 | +5.9% | 0.684 |
| NOX | 0.0961 | 0.1023 | +6.1% | 0.692 |
| SOX | 0.1074 | 0.1250 | +14.1% | 0.636 |
| PM2.5 | 0.1117 | 0.1464 | +23.7% | 0.466 |
| PM10 | 0.1103 | 0.1454 | +24.1% | 0.460 |
| COV | 0.1161 | 0.1397 | +16.9% | 0.559 |
| Temperature | 0.0004 | 0.0000 | 0.0% | — |
| Humidity | 0.0751 | 0.0030 | -23.8% | — |

### 7.3 Performance Isolation Forest

| Métrique | Valeur |
|----------|--------|
| Anomalies validation | 5.3% |
| Anomalies test | 5.5% |
| Faux positifs (profils normaux) | 0% |
| Score profil Four (normal) | -0.148 (> seuil -0.20) |
| Score spike industriel (anomalie) | -0.263 (< seuil -0.20) |

### 7.4 Historique d'Entraînement LSTM

- **Epochs** : 54 (arrêt anticipé à epoch 39 comme meilleur)
- **val_loss finale** : 0.0036
- **val_mae finale** : 0.0943
- **val_skill max** : 0.137 (epoch 39)
- **Learning rate** : réduit de 0.001 → 0.00001 (5 réductions)

### 7.5 Évaluation intégrée (simulateur + production)

> **Date** : 29 mai 2026 — scripts `ia/scripts/evaluate_models.py` et `backend/scripts/analyze-ia-vs-simulator.js`  
> Rapport JSON : `ia/models/evaluation_report.json`

#### 7.5.1 Verdict global

| Dimension | Statut | Commentaire |
|-----------|--------|-------------|
| Fonctionnement technique | ✅ | Chaîne IF + LSTM + API + Mongo opérationnelle |
| Précision offline (test) | ✅ | LSTM +6,65 % skill ; IF calibré à ~5,5 % |
| Cohérence simulateur | ✅ | Mesures live ~107–112 % des baselines Four |
| IF temps réel | ✅ | Profil Four normal ; anomalie sur profil Broyage-like |
| Précision LSTM live | ⚠️ | Dépend de 48 h d'agrégats horaires **continus** par zone |
| IF spikes univariés | ⚠️ | NOX ×5 seul non détecté au seuil -0.20 |

#### 7.5.2 Tests comportementaux (runtime)

**Isolation Forest** (latence ~20 ms)

| Cas | Attendu | Résultat | Score |
|-----|---------|----------|-------|
| Profil Four normal (×1,0) | Normal | ✅ | -0,148 |
| Profil Broyage froid (×0,65) | Normal | ✅ | +0,121 |
| Spike multivarié (NOX+SOX+CO2) | Anomalie | ✅ | -0,207 |
| Spike NOX seul ×5 | Anomalie | ❌ | -0,175 (juste au-dessus du seuil) |

**LSTM** (latence API ~98 ms ; ~366 ms inference locale)

| Profil | +4h CO2 | Comportement |
|--------|---------|--------------|
| Four ×1,0 | 511 (−29 % vs entrée) | Valeurs plausibles ; biais baissier CO2 |
| Broyage ×0,65 | 474 (+1,7 %) | ✅ Cohérent |

**API FastAPI** : `go_deploy=true`, `/health` OK, `/predict` 4 pas, `/detect` profil normal OK.

#### 7.5.3 Intégration live (MongoDB + simulateur)

Analyse sur **Zone Fours de Calcination** et site Gabès :

| Point | Observation |
|-------|-------------|
| Simulateur (6 h) | NOX ~731 mg/Nm³ (108 % baseline 680), CO2 ~730 ppm (112 % baseline 650) |
| IF créneau actuel | **Normal** (score -0,194) — profil Four typique |
| IF historique (24 mai) | **Anomalie** (score -0,220) — profil type Broyage (~78–84 % baseline) |
| LSTM en base | Ancrage possible en mode **historique** si < 4 h récentes (`IA_MIN_FILLED_HOURS=4`) |
| Écart prévision / mesures | Jusqu'à ~−40 % si ancrage historique vs flux simulateur actuel |

**Cause de l'écart LSTM live** : après coupure du simulateur, seules 1–2 h de lectures récentes existent dans la fenêtre 48 h. Le backend recherche alors un ancrage historique (`IA_ANCHOR_SEARCH_HOURS`, défaut 336 h) avec au minimum `IA_MIN_FILLED_HOURS` heures de mesures.

#### 7.5.4 Performance LSTM par site (offline)

| Site synthétique | Skill global | Interprétation |
|------------------|--------------|----------------|
| site_four_B | +11,0 % | Meilleur site |
| site_four_A | +8,6 % | Bon |
| site_mixed | +8,4 % | Bon |
| site_broyage | +6,6 % | Bon |
| site_stockage | +1,8 % | Faible mais positif |
| site_expedition | −2,7 % | LSTM derrière persistance → fallback |

#### 7.5.5 Latence mesurée

| Composant | Latence |
|-----------|---------|
| IF inference | ~20 ms |
| LSTM `/predict` (API) | ~98 ms |
| LSTM inference locale (1er appel) | ~640 ms (chargement TensorFlow) |
| LSTM appels suivants | ~90 ms |

#### 7.5.6 Recommandations opérationnelles

1. **LSTM live** : maintenir `npm run simulate` **48 h** avant d'attendre des prévisions alignées sur le flux actuel ; ou `IA_MIN_FILLED_HOURS=4` en dev court.
2. **IF univarié** : abaisser `score_threshold` à **-0.22** dans `ia/config.py` si les pics single-polluant doivent alerter (voir § 4.2.1).
3. **Granularité** : l'IA est **zone-level** — une zone sans nœud capteur ne peut pas exécuter IF/LSTM.
4. **Suivi périodique** :
   ```bash
   cd ia && python scripts/evaluate_models.py
   cd backend && node scripts/analyze-ia-vs-simulator.js
   ```

---

## 8. Intégration avec le Backend

### 8.1 Service AIService (Node.js)

Le fichier `backend/services/AIService.js` orchestre l'appel au microservice Python (**granularité zone**, depuis v1.2) :

1. **buildLookbackMatrix(zoneId)** : matrice 48×8 à partir des agrégats horaires **de la zone**
2. **buildIfFeatureVector(zoneId)** : vecteur 6D IF pour la zone
3. **runForecastForZone(zoneId)** : sync agrégats → `/predict` → `LstmForecast` (zoneId + siteId)
4. **runAnomalyDetectionForZone(zoneId)** : sync agrégats → `/detect` → `AnomalyDetection`
5. **_findBestAnchorEnd()** : si fenêtre récente insuffisante, ancrage historique automatique

Routes API backend : `/api/ia/zone/:zoneId/forecasts/...` et `/api/ia/zone/:zoneId/anomalies/...`

### 8.2 Scheduler

Le `kpiScheduler.js` déclenche automatiquement (par **zone**) :
- Toutes les heures (H:05) : agrégation KPI → IF → LSTM (séquentiel)
- Déclenchement manuel : bouton « Lancer IA » ou `POST /api/ia/zone/:zoneId/forecasts/run`

### 8.3 Modèles MongoDB

| Collection | Description | Champs clés |
|------------|-------------|-------------|
| `lstmforecasts` | Prévisions +1h..+4h | **zoneId**, siteId, steps[], anchorPeriodStart |
| `anomalydetections` | Résultats IF | **zoneId**, siteId, isAnomaly, anomalyScore, periodStart |
| `alerts` | Alertes générées | type, severity, source, message |

### 8.4 Frontend

| Composant | Rôle |
|-----------|------|
| `AIPredictions.tsx` | Page dédiée IA (health, forecasts, anomalies) |
| `ForecastBanner.tsx` | Bannière résumé sur la page History |
| `ForecastStepsTable.tsx` | Tableau détaillé des prédictions |
| `HistoryChart.tsx` | Overlay prévision (trait violet) si fenêtre alignée |
| `ForecastBanner.tsx` | Résumé prévision sur History (toujours visible si zone sélectionnée) |

> **Historique court (1 h / 24 h)** : la courbe de prévision n'est superposée que si l'ancrage LSTM chevauche la période affichée. Sinon, seule la bannière texte indique la prévision (évite d'étirer l'axe temps quand le backend utilise un ancrage historique).

---

## 9. Conclusions et Perspectives

### 9.1 Conclusions

1. **Le domain shift est le problème central** des systèmes IA appliqués au monitoring industriel. L'utilisation directe de datasets publics d'air ambiant est incompatible avec les émissions industrielles.

2. **L'approche hybride synthétique résout le problème** en calibrant les distributions sur le contexte réel (simulateur tunisien + VLEs Décret 2018-928), tout en conservant des patterns temporels réalistes.

3. **Les résultats post-réentraînement sont fonctionnels** :
   - LSTM : skill positif sur 6/8 polluants, R² global = 0.846
   - IF : 0% faux positifs, détection correcte des anomalies injectées
   - Dénormalisation : valeurs physiques cohérentes

4. **Le système est prêt pour la démonstration** avec le simulateur en temps réel.

### 9.2 Limites Actuelles

| Limite | Impact | Solution future |
|--------|--------|-----------------|
| Dataset 100% synthétique | Peut manquer de variabilité réelle | Enrichir avec données MongoDB accumulées |
| Humidity skill négatif | Prédiction humidity en fallback | Feature engineering (dew point, lags) |
| Pas de GPU | Entraînement lent (~5.5 min CPU) | GPU pour réentraînement périodique |
| Modèle unique multi-polluant | Compromis entre polluants | Modèles spécialisés par polluant |
| Fenêtre 48 h requise (LSTM) | Prévisions décalées si simulateur coupé | Ancrage historique auto ; laisser sim 48 h |
| IF spike univarié | NOX ×5 seul non détecté à -0.20 | Abaisser seuil à -0.22 ou réentraîner |
| Zones sans capteurs | IA impossible (0/4 polluants) | Assigner nœuds ou choisir zone équipée |

### 9.3 Perspectives d'Amélioration

1. **Enrichissement progressif** : quand les données MongoDB accumulent (+30 jours), réentraîner avec un mix synthétique + réel (80/20 → 50/50 → 20/80)

2. **Modèles par polluant** : entraîner un LSTM dédié CO2 et un LSTM dédié PM10 pour maximiser le skill sur les polluants réglementés

3. **Features calendrier** : activer sin/cos(heure, jour) pour capturer les patterns d'activité industrielle

4. **Horizon 24h** : étendre à +24h pour la planification de maintenance

5. **Détection de drift** : réentraîner automatiquement si RMSE se dégrade de >20% sur les données récentes

6. **Ensemble learning** : combiner plusieurs modèles (LSTM + GRU + Transformer) pour réduire la variance des prédictions

### 9.4 Feuille de route — prochaines étapes

> Plan opérationnel après intégration IA zone-level (v1.2) — mai 2026.

#### Phase A — Stabiliser la démo (1–2 semaines)

| # | Action | Responsable / outil | Critère de succès |
|---|--------|---------------------|-------------------|
| A1 | Laisser le simulateur tourner **48 h** sur les 4 zones équipées | `npm run simulate` | LSTM ancré sur flux actuel (pas de fallback historique) |
| A2 | Nettoyer ou équiper les **zones orphelines** (sans nœud capteur) | Admin UI / Mongo | Aucune erreur « 0/4 polluants » |
| A3 | **Test E2E** complet | Mongo + backend + `python api.py` + frontend | Checklist § 8 — dernier point validé |
| A4 | Valider **RBAC** : OPERATOR (lecture), HEAD_SUPERVISOR (Lancer IA) | Comptes de test | 403 sur `run_ia` pour OPERATOR |
| A5 | Décider **alertes prévision** (`IA_CREATE_FORECAST_ALERTS`) | `backend/.env` | Alertes VLE +1…+4 h si activé |
| A6 | Rédaction **rapport PFE** chapitre IA | `DOCUMENTATION_IA_COMPLETE.md` | Architecture + métriques § 7.5 |

#### Phase B — Qualité IA (2–4 semaines)

| # | Action | Détail |
|---|--------|--------|
| B1 | Ajuster seuil IF | `ia/config.py` → `score_threshold` (ex. `-0.22` pour spikes univariés) |
| B2 | Accumuler **30 jours** MongoDB | Données simulateur continues |
| B3 | Réentraînement **hybride** synthétique + réel | Mix 80/20 puis 50/50 |
| B4 | Suivi périodique | `python scripts/evaluate_models.py` + `analyze-ia-vs-simulator.js` |
| B5 | Déduplication LSTM | Une entrée par `(zoneId, anchorPeriodStart)` — backlog IA-10 |

#### Phase C — Produit / UX (1–2 mois)

| # | Action | Bénéfice |
|---|--------|----------|
| C1 | Vue opérateur **par zone assignée** | IA et alertes contextualisées |
| C2 | Bouton « Ré-entraîner » (aujourd'hui placeholder) | Pipeline MLOps minimal |
| C3 | Lien **alerte ↔ zone ↔ opérateur** | Workflow Approvals actionnable |
| C4 | Indicateur UI « ancrage historique vs temps réel » | Transparence sur la prévision |
| C5 | **Tests automatisés** API IA + hooks React | Régression maîtrisée |

#### Phase D — Évolution modèles (post-soutenance)

- Features calendrier (heure, jour, week-end) dans le LSTM  
- Horizon **24 h** (notebook 07)  
- Modèles dédiés **CO2** / **PM10**  
- Monitoring **drift** (réentraînement si RMSE live > +20 %)  
- Remplacement simulateur par **capteurs MQTT réels**

#### Phase E — Production (si déploiement réel)

- Docker Compose (Mongo, Mosquitto, backend, IA, frontend)  
- CI (lint, smoke tests, health IA)  
- Secrets / sauvegardes Mongo  
- Monitoring scheduler H:05 + alertes ops

#### Vue d'ensemble

```
[Démo stable] → [Données 30j + tuning IF] → [UX opérateur] → [Réentraînement hybride] → [Capteurs réels]
     ▲
  Phase A (en cours)
```

**Priorité immédiate** : A1 (simulateur 48 h) → A3 (E2E) → A6 (rapport).

---

## Annexes

### A. Technologies Utilisées

| Composant | Technologie | Version |
|-----------|------------|---------|
| Microservice IA | Python / FastAPI | 3.11 / 0.136 |
| Deep Learning | TensorFlow / Keras | 2.16.1 |
| Machine Learning | scikit-learn | 1.4+ |
| Données | pandas / numpy | 2.x / 1.x |
| Serveur ASGI | uvicorn | 0.48 |
| Backend | Node.js / Express | 18+ |
| Base de données | MongoDB / Mongoose | 7.x |
| Frontend | React / TypeScript | 18+ |
| Charts | Chart.js / react-chartjs-2 | 4.x |

### B. Commandes de Réentraînement

```bash
# Générer un nouveau dataset
cd ia/
python generate_industrial_dataset.py --days 90 --sites 6

# Réentraîner Isolation Forest
python scripts/retrain_if.py

# Réentraîner LSTM (inclut préparation tenseurs)
python scripts/retrain_lstm.py

# Valider les modèles (comportement + simulateur)
python scripts/analyze_simulator_vs_models.py

# Évaluation consolidée (offline + runtime + API + Mongo)
python scripts/evaluate_models.py

# Analyse intégration backend vs simulateur
cd ../backend && node scripts/analyze-ia-vs-simulator.js

# Lancer le microservice
python api.py
```

### C. Variables d'Environnement

```env
# Microservice IA
IA_HOST=0.0.0.0
IA_PORT=8000

# Backend Node.js
IA_ENABLED=true
IA_SERVICE_URL=http://localhost:8000
IA_IF_ENABLED=true
IA_MIN_FILLED_HOURS=4          # min heures agrégées pour LSTM (dev court)
IA_ANCHOR_SEARCH_HOURS=336     # recherche ancrage historique (14 j)
IA_CREATE_FORECAST_ALERTS=true
IA_CREATE_ANOMALY_ALERTS=true

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=pollution-monitoring
```

### D. Format des Requêtes API

**POST /predict :**
```json
{
  "horizon_hours": 4,
  "lookback_values": [[650, 680, 340, 17, 20.4, 90, 25, 55], ...]  // 48 lignes × 8 colonnes
}
```

**POST /detect :**
```json
{
  "feature_values": [680, 340, 17, 20.4, 650, 90],
  "feature_cols": ["NOX", "SOX", "PM25", "PM10", "CO2", "COV"]
}
```

---

*Document mis à jour le 29 mai 2026 — Projet Pollution Monitoring v1.2 (IA zone-level)*
