"""Ajoute cellules markdown pédagogiques et commentaires aux notebooks 04-07."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import nbformat
from nbformat.v4 import new_markdown_cell


def md(source: str):
    return new_markdown_cell(source.strip())


def insert_after(cells: list, index: int, new_cells: list) -> list:
    """Insère new_cells juste après l'index (0 = avant première cellule si index=-1)."""
    pos = index + 1
    return cells[:pos] + new_cells + cells[pos:]


def prepend_code_comments(source: str, header: str) -> str:
    if header.strip() in source:
        return source
    return header.rstrip() + "\n\n" + source


def enrich_nb04(path: Path) -> None:
    nb = nbformat.read(path, as_version=4)
    cells = nb.cells

    cells[0].source = """# Phase 2.1 : Entraînement Isolation Forest

> **Public : débutant en ML** — Ce notebook explique *pourquoi* chaque étape existe, pas seulement le code.

## Objectif métier
Détecter des **mesures atypiques** : combinaisons rares de polluants (ex. NOX élevé avec PM25 très bas) qui peuvent signaler un capteur défaillant ou un événement process, **sans** avoir besoin d'étiquettes « incident / pas incident ».

## Ce que vous allez apprendre
1. Transformer un CSV « long » en tableau **multivarié** (une ligne = un instant × site).
2. **Normaliser** les variables pour que l'algorithme compare des échelles différentes (ppm vs µg/m³).
3. Faire un **split temporel** (jamais de mélange aléatoire sur des séries temporelles).
4. Entraîner un **Isolation Forest** et interpréter ses sorties.
5. **Tester** le modèle avec des anomalies artificielles (spikes).

## Prérequis
- Avoir exécuté les notebooks **01 → 03** → fichier `data/training_dataset.csv`.
- Notions : DataFrame pandas, train/test, notion vague de « anomalie ».

## Fichiers produits
| Fichier | Rôle |
|---------|------|
| `models/model_isolation_forest.pkl` | Modèle sauvegardé pour l'API |
| `models/if_scaler.pkl` | Normalisation appliquée en production |
| `models/if_metrics.json` | Scores de validation |

## Spécifications projet
- `n_estimators=100`, `contamination=0.05` (≈ 5 % de points les plus « isolés »)
- Cible robustesse : **recall > 90 %** sur anomalies **injectées** (test de stress)"""

    pedagogy_blocks = [
        (1, [md("""### Zone pédagogique — Section 1 : préparation

**Isolation Forest en une phrase :** l'algorithme construit des arbres aléatoires ; un point **facile à isoler** en peu de coupes est considéré comme **anomalie**.

**Pourquoi « non supervisé » ?** On n'a pas de colonne « c'est une panne » dans les données publiques. Le modèle apprend ce qui est **fréquent** sur le train, puis signale le **rare** sur val/test.

**Les imports ci-dessous :**
- `pandas` / `numpy` : manipulation des tableaux ;
- `sklearn.ensemble.IsolationForest` : le modèle ;
- `StandardScaler` : met chaque polluant à moyenne 0, écart-type 1 ;
- `joblib` : sauvegarde du modèle comme un fichier `.pkl`.""")]),
        (4, [md("""### Chemins des fichiers

On utilise `Path` pour construire des chemins **relatifs au notebook** (`../data`, `../models`).  
Avantage : le même notebook fonctionne sur Windows/Linux si la structure du projet est respectée.""")]),
        (6, [md("""### Du format « long » au format « large » (pivot)

**Format long** (votre CSV) : une ligne = `(timestamp, site, polluant, value)`  
**Format large** (pour l'IF) : une ligne = `(timestamp, site)` et **une colonne par polluant**.

```
Exemple large :
timestamp_utc | site | NOX | SOX | PM25 | ...
2024-01-01 08:00 | A1 | 120 | 25 | 0.1 | ...
```

**Pourquoi ?** L'Isolation Forest regarde le **vecteur complet** des polluants à un instant donné, pas une seule colonne à la fois.""")]),
        (8, [md("""### StandardScaler — pourquoi normaliser ?

| Polluant | Ordre de grandeur typique |
|----------|---------------------------|
| NOX | dizaines à centaines (mg/Nm³) |
| PM25 | fractions (mg/m³) |
| CO2 | centaines (ppm) |

Sans normalisation, le modèle serait **dominé** par la variable à plus grandes valeurs.  
`StandardScaler` : \\(x' = (x - \\mu) / \\sigma\\) calculé sur le **train** (ici on fit sur tout X avant split dans ce notebook — en production, fit **uniquement** sur train).""")]),
        (10, [md("""### Split temporel 70 % / 15 % / 15 %

```
[======== train 70% ========][= val 15%=][= test 15%=]
     passé lointain              récent
```

**Règle d'or :** ne jamais `shuffle=True` sur des séries temporelles — sinon le modèle « voit le futur » pendant l'entraînement.

- **Train** : apprendre le « normal ».
- **Val / test** : mesurer si le futur ressemble au passé.""")]),
        (12, [md("""### Entraînement — paramètres clés

| Paramètre | Valeur | Intuition |
|-----------|--------|-----------|
| `n_estimators` | 100 | Plus d'arbres = score plus stable (plus lent) |
| `contamination` | 0.05 | Environ 5 % des points train les plus isolés → seuil interne |
| `random_state` | 42 | Reproductibilité |
| `offset_` | (après fit) | Seuil sklearn ; pas besoin de le modifier à la main |

**Sortie `predict` :** `1` = normal, `-1` = anomalie.""")]),
        (14, [md("""### Évaluation sur val / test (données réelles)

Les pourcentages affichés (ex. 2,5 % val, 7,1 % test) = part de lignes flaggées **sans** injection.

Ce n'est **pas** « peu de détection » : c'est proche du **5 %** visé, avec variation selon la période.

**Ce n'est pas non plus** le nombre de dépassements réglementaires — les seuils ANPE restent gérés par MongoDB.""")]),
        (16, [md("""### Test de stress : injection d'anomalies

On **casse volontairement** certaines lignes du test :
- **Spikes** : gros saut sur toutes les features (capteur qui débloque).
- **Dérives** : décalage plus doux.

**Métrique à regarder :** `recall injecté` = parmi les lignes cassées, combien sont détectées ?  
**Ne pas utiliser** un ratio « anomalies totales / lignes injectées » qui peut dépasser 100 % (faux positifs en plus).""")]),
        (18, [md("""### Métriques Precision / Recall / F1

Imaginez 100 lignes dont **10** sont vraiment injectées (anomalies « vrai ») :

- **Recall** : parmi les 10 vraies, combien trouvées ? (sensibilité)
- **Precision** : parmi tout ce que le modèle flag, combien étaient vraiment injectées ? (évite trop d'alertes)

**AUC-ROC** : capacité à classer normal vs anomalie via le score continu (`score_samples`).""")]),
        (21, [md("""### Sauvegarde des artifacts

- `.pkl` : modèle + scaler rechargés par `joblib.load()` dans l'API.
- `if_metrics.json` : traçabilité pour comparer les versions de modèle.

**Prochaine étape :** notebook **05** (tenseurs LSTM) puis **06/07** (prévision 4 h et 24 h).""")]),
    ]

    # Insert from end to start to preserve indices
    for index, new_cells in sorted(pedagogy_blocks, key=lambda x: x[0], reverse=True):
        cells = insert_after(cells, index, new_cells)

    # Code comment headers (match first line of cells)
    code_enrichments = {
        "# ========================================\n# SECTION 1: Imports": """# --- Imports : bibliothèques utilisées dans tout le notebook ---
# pandas/numpy : données ; sklearn : IF + métriques ; joblib : sauvegarde .pkl
""",
        "# Configuration des chemins": """# --- Chemins : tout est relatif à la racine du projet (dossier ia/) ---
""",
        "# Charger dataset": """# --- Chargement : une ligne par (timestamp, site, polluant) ---
# La colonne 'synthetic' indique les valeurs générées au notebook 03
""",
        "# Préparer features multivariées": """# --- Pivot : chaque polluant devient une colonne (tableau large) ---
# sort_index() : indispensable avant le split temporel
""",
        "# Normaliser les features": """# --- StandardScaler : chaque colonne centrée-réduite (moyenne 0, std 1) ---
""",
        "# Split temporel": """# --- Découpage chronologique : 70% train, 15% val, 15% test (pas de shuffle!) ---
""",
        "# SECTION 4: Entraînement Isolation Forest": """# --- fit() : le modèle apprend la structure des données « normales » du train ---
# contamination=0.05 : environ 5% des points train les plus isolés
""",
        "# Prédictions sur validation": """# --- predict : 1 = normal, -1 = anomalie | score_samples : plus bas = plus anormal ---
""",
        "# Prédictions sur test set": """# --- Même logique sur la tranche temporelle la plus récente (test) ---
""",
        "# Injection d'anomalies": """# --- Test de robustesse : on corrompt X_test puis on mesure le recall sur les indices injectés ---
""",
        "# Calcul des métriques": """# --- Labels « vrai » : 1 seulement sur spike_indices et drift_indices ---
""",
        "# Matrice de confusion": """# --- Visualisation des vrais/faux positifs sur le test augmenté ---
""",
        "# Sauvegarder modèle": """# --- Export pour inference.py / api.py (notebook 08) ---
""",
    }

    for cell in cells:
        if cell.cell_type != "code":
            continue
        for key, header in code_enrichments.items():
            if key in cell.source:
                cell.source = prepend_code_comments(cell.source, header)
                break

    nb.cells = cells
    nbformat.write(nb, path)
    print(f"OK {path.name}")


def enrich_nb05(path: Path) -> None:
    nb = nbformat.read(path, as_version=4)
    cells = nb.cells

    cells[0].source = """# Phase 2.2 : Préparation des tenseurs LSTM

> **Pour débutants** — On transforme des séries temporelles en **cubes de nombres** que TensorFlow peut consommer.

## Différence avec le notebook 04
| | Notebook 04 (IF) | Notebook 05 (LSTM) |
|---|------------------|---------------------|
| Tâche | Détecter l'instant **anormal** | **Prédire le futur** (4 h et 24 h) |
| Entrée | 1 vecteur par ligne | **48 heures** d'historique |
| Sortie | normal / anomalie | **4 ou 24** pas futurs × 8 polluants |

## Vocabulaire
- **Lookback** = 48 → on regarde les **48 dernières heures**.
- **Horizon** = 4 ou 24 → on prédit les **4 ou 24 prochaines heures**.
- **Tenseur X** : forme `(échantillons, 48, 8)` = (batch, temps, polluants).
- **Tenseur y** : forme `(échantillons, horizon, 8)`.

## Fichiers produits
- `data/lstm_train_val_test.pkl` — données prêtes pour 06 et 07
- `data/lstm_metadata.json` — dimensions pour l'API
- `models/lstm_scalers.pkl` — MinMaxScaler [0, 1]"""

    blocks = [
        (0, [md("""### Section 1 — Configuration

`config.py` centralise les hyperparamètres : une seule source de vérité pour les notebooks 05–08.

**`POLLUTANT_NAMES`** : ordre **fixe** des 8 colonnes — ne pas le changer sans réentraîner tous les modèles.""")]),
        (2, [md("""### Fonctions utilitaires

1. **`load_hourly_wide`** : CSV long → tableau large, **1 point par heure** (`resample('1h')`).
2. **`build_windows`** : fenêtres glissantes — chaque exemple = 48 h passées → cible = `horizon` h futures.
3. **`temporal_split`** : même principe que notebook 04 (pas de shuffle).

**Analogie fenêtre :** comme lire 48 pages d'un livre pour deviner les 4 pages suivantes.""")]),
        (4, [md("""### Boucle par horizon (4 h et 24 h)

Pour chaque site, on crée des fenêtres puis on **concatène** tous les sites.

**MinMaxScaler** : ramène chaque valeur entre 0 et 1 (pratique pour les réseaux de neurones).

⚠️ Ici le scaler est fit sur **toutes** les fenêtres avant split — acceptable en prototype ; en production stricte, fit **train seulement**.""")]),
        (6, [md("""### Export pickle + JSON

Le fichier `.pkl` peut être **gros** (> 500 Mo) : c'est normal (milliers de fenêtres × 48 × 8 floats).

**Ne pas versionner** ce fichier dans Git si la limite de taille est dépassée.""")]),
    ]

    for index, new_cells in sorted(blocks, key=lambda x: x[0], reverse=True):
        cells = insert_after(cells, index, new_cells)

    code_hints = {
        "import json": "# --- Imports + lecture de LSTM_CONFIG depuis config.py ---\n",
        "def load_hourly_wide": "# --- Fonctions : chargement, fenêtres, split (voir cellule markdown au-dessus) ---\n",
        "input_file = DATA_DIR": "# --- Chargement du dataset complet (notebook 03) ---\n",
        "scaler = MinMaxScaler": "# --- Construction des tenseurs pour horizon 4h et 24h ---\n",
        "metadata = {": "# --- Métadonnées pour l'API : dimensions, polluants, comptages ---\n",
    }
    for cell in cells:
        if cell.cell_type != "code":
            continue
        for key, hint in code_hints.items():
            if key in cell.source and hint.strip() not in cell.source:
                cell.source = hint + cell.source
                break

    cells.append(md("""## Résumé pédagogique

| Concept | Valeur |
|---------|--------|
| Pas temporel | 1 h |
| Historique | 48 h |
| Prédictions | 4 h et 24 h |
| Features | 8 polluants |

**Suite :** notebook **06** entraîne le réseau sur `combined_tensors[4]`, notebook **07** sur `combined_tensors[24]`."""))

    nb.cells = cells
    nbformat.write(nb, path)
    print(f"OK {path.name}")


def enrich_nb06(path: Path) -> None:
    nb = nbformat.read(path, as_version=4)
    cells = nb.cells

    cells[0].source = """# Phase 2.3 : Entraînement LSTM — Horizon **4 heures**

> **Prérequis :** notebook **05** exécuté → `lstm_train_val_test.pkl` existe.

## Objectif
Apprendre à prédire les **4 prochaines heures** de pollution à partir des **48 dernières heures**.

## Qu'est-ce qu'un LSTM ? (intuition)
Un **LSTM** (Long Short-Term Memory) est un type de réseau de neurones qui garde une « mémoire » des pas de temps précédents. Adapté aux **séries temporelles** (météo, pollution, ventes).

## Architecture (schéma)
```
Entrée (48, 8) → LSTM 64 → Dropout → LSTM 32 → Dense → Sortie (4, 8)
     ↑ 48 pas         ↑ régularisation      ↑ 4 pas × 8 polluants
```

## Métriques à comprendre
- **MSE / Loss** : erreur quadratique moyenne (pénalise les grosses erreurs).
- **MAE** : erreur absolue moyenne (plus lisible en unités physiques après inverse transform).
- **R²** : 1 = parfait, 0 = pas mieux que la moyenne, < 0 = très mauvais.
- **MAPE** : erreur en % (attention si valeurs proches de 0).

## Sorties
- `models/model_lstm_4h.h5`
- `models/lstm_4h_metrics.json`"""

    blocks = [
        (0, [md("""### Imports TensorFlow/Keras

`tensorflow` construit le graphe de calcul ; `keras` fournit les couches (`LSTM`, `Dense`).

**Graines aléatoires** (`seed=42`) : deux exécutions donnent les mêmes poids initiaux (utile pour déboguer).""")]),
        (2, [md("""### Chargement des tenseurs

On lit la clé `combined_tensors[4]` du pickle (horizon **4** = 4 pas horaires).

Vérifiez les shapes affichées :
- `X_train` : `(N, 48, 8)`
- `y_train` : `(N, 4, 8)`""")]),
        (3, [md("""### Construction du modèle couche par couche

| Couche | Rôle pédagogique |
|--------|------------------|
| `LSTM(64, return_sequences=True)` | Lit la séquence ; passe l'info à la 2e couche |
| `Dropout(0.2)` | Désactive 20 % des neurones → limite le surapprentissage |
| `LSTM(32)` | Résume la séquence en vecteur |
| `Dense(4×8)` + `Reshape` | Produit 4 pas futurs pour 8 polluants |

**Loss MSE** : le réseau minimise l'écart quadratique entre prédit et réel.""")]),
        (4, [md("""### Entraînement + Early Stopping

**Epoch** = une passe complète sur le train.

**Early stopping** : si `val_loss` ne s'améliore plus pendant `patience` epochs, on **arrête** et on restaure les meilleurs poids → évite d'apprendre par cœur le train.

**Batch size 32** : le modèle met à jour les poids tous les 32 exemples (compromis vitesse/stabilité).""")]),
        (5, [md("""### Courbes loss / MAE

- Train ↓ et Val ↓ : apprentissage sain.
- Train ↓ mais Val ↑ : **surapprentissage** (réduire epochs, augmenter dropout, plus de données).""")]),
        (6, [md("""### Évaluation sur le test

Le **test** n'a jamais été vu pendant `fit()` — c'est la mesure la plus honnête avant la production.

Comparez RMSE/MAE à une **baseline naïve** (répéter la dernière valeur) : le LSTM doit faire mieux pour justifier le déploiement.""")]),
        (7, [md("""### Visualisation qualitative

Un seul exemple (`sample_idx=0`) : courbes **réel vs prédit** pour 4 polluants sur 4 h.

Utile pour l'œil humain ; ne remplace pas les métriques globales.""")]),
        (8, [md("""### Sauvegarde `.h5`

Format Keras standard. En production, charger avec `keras.models.load_model()`.

Le fichier `lstm_4h_history.json` garde l'historique des loss par epoch pour audit.""")]),
    ]

    for index, new_cells in sorted(blocks, key=lambda x: x[0], reverse=True):
        cells = insert_after(cells, index, new_cells)

    hints = {
        "import json": "# --- Setup : TensorFlow, métriques sklearn, chemins modèle 4h ---\n",
        "with open(tensors_file": "# --- Lecture du pickle produit par le notebook 05 ---\n",
        "model = keras.Sequential": "# --- Architecture LSTM : empiler les couches ---\n",
        "history = model.fit": "# --- Boucle d'apprentissage (peut prendre plusieurs minutes) ---\n",
        "y_pred = model.predict": "# --- Inférence sur test : prédire toutes les fenêtres ---\n",
        "model.save(model_file)": "# --- Persistance du modèle entraîné ---\n",
    }
    for cell in cells:
        if cell.cell_type != "code":
            continue
        for key, hint in hints.items():
            if key in cell.source and hint.strip() not in cell.source:
                cell.source = hint + cell.source
                break

    nb.cells = cells
    nbformat.write(nb, path)
    print(f"OK {path.name}")


def enrich_nb07(path: Path) -> None:
    nb = nbformat.read(path, as_version=4)
    cells = nb.cells

    cells[0].source = """# Phase 2.4 : Entraînement LSTM — Horizon **24 heures**

> Même pipeline que le notebook **06**, mais la cible couvre **24 pas** (= 24 h à venir).

## Pourquoi un second modèle ?
- **4 h** : alerte opérationnelle rapide (ventilation, ajustement process).
- **24 h** : tendance journalière, planification, rapports.

## Différence technique
| | Notebook 06 | Notebook 07 |
|---|-------------|-------------|
| Horizon | 4 | 24 |
| Sortie Dense | `4 × 8 = 32` valeurs | `24 × 8 = 192` valeurs |
| Difficulté | Souvent plus facile | Erreur cumulée sur plus de pas |

## Attention débutant
Un horizon long = le modèle doit extrapoler plus loin → **RMSE souvent plus élevé** que le 4 h. Ce n'est pas un « échec », c'est normal.

## Sorties
- `models/model_lstm_24h.h5`
- `models/lstm_24h_metrics.json`"""

    blocks = [
        (0, [md("""### Rappel

Si le notebook **05** ou **06** n'a pas été exécuté, le chargement du `.pkl` ou la comparaison 4h vs 24h échouera.

Exécutez les notebooks **dans l'ordre** : 05 → 06 → 07.""")]),
        (2, [md("""### Tenseurs horizon 24

Clé `combined_tensors[24]` dans le pickle.

`y_train` a la forme `(N, 24, 8)` : pour chaque fenêtre, **24 heures futures** × 8 polluants.""")]),
        (3, [md("""### Architecture identique au 4h

Seule la **dernière couche** change de taille (`24 * N_FEATURES` neurones).

Même hyperparamètres (`units`, `dropout`, `learning_rate`) depuis `config.py` — cohérence entre les deux modèles.""")]),
        (6, [md("""### Métriques test 24h

**MAPE** peut exploser si une valeur réelle est proche de 0 (division) — lire aussi **MAE** et **RMSE**.

Le notebook trace aussi la **distribution des erreurs** : utile pour voir si les grosses erreurs sont rares ou fréquentes.""")]),
        (8, [md("""### Distribution des erreurs + Q-Q plot

- **Histogramme** : erreurs absolues concentrées près de 0 ?
- **Q-Q plot** : compare la distribution des erreurs à une loi normale (diagnostic avancé, pas bloquant).""")]),
        (10, [md("""### Comparaison 4h vs 24h

Tableau récapitulatif si `lstm_4h_metrics.json` existe.

En général : **4h** = métriques meilleures ; **24h** = vision plus stratégique.""")]),
    ]

    for index, new_cells in sorted(blocks, key=lambda x: x[0], reverse=True):
        cells = insert_after(cells, index, new_cells)

    hints = {
        "import json": "# --- Setup identique au notebook 06, horizon=24 ---\n",
        "with open(tensors_file": "# --- Charger tenseurs horizon 24 ---\n",
        "model = keras.Sequential": "# --- Réseau : sortie (24, 8) au lieu de (4, 8) ---\n",
        "history = model.fit": "# --- Entraînement (souvent plus long que 4h) ---\n",
        "errors = np.abs": "# --- Erreurs pour histogramme et Q-Q plot ---\n",
        "metrics_4h_file": "# --- Comparaison optionnelle avec le modèle 4h ---\n",
    }
    for cell in cells:
        if cell.cell_type != "code":
            continue
        for key, hint in hints.items():
            if key in cell.source and hint.strip() not in cell.source:
                cell.source = hint + cell.source
                break

    cells.append(md("""## Fin du bloc LSTM (notebooks 05–07)

**Vous savez maintenant :**
1. Préparer des fenêtres temporelles (05).
2. Entraîner un LSTM multi-sorties (06–07).
3. Lire loss, MAE, R² et courbes de prédiction.

**Suite du projet :** notebook **08** (inférence + latence) et **09** (validation bout en bout).

**Documentation complémentaire :** `docs/DISCUSSION_MODELES_IA_RECOMMANDATIONS.md`"""))

    nb.cells = cells
    nbformat.write(nb, path)
    print(f"OK {path.name}")


def main():
    root = Path(__file__).resolve().parents[1] / "notebooks"
    enrich_nb04(root / "04_isolation_forest_training.ipynb")
    enrich_nb05(root / "05_lstm_training_preparation.ipynb")
    enrich_nb06(root / "06_lstm_training_4h_horizon.ipynb")
    enrich_nb07(root / "07_lstm_training_24h_horizon.ipynb")


if __name__ == "__main__":
    main()
