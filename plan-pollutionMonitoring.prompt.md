## Plan: Fusion Datasets Pour Module IA

Construire un dataset d'entraînement unifié en 3 couches: (1) base réelle publique pour NO2/SO2/CO/PM2.5/météo, (2) enrichissement pour comportement capteurs/anomalies, (3) adaptation finale sur données IoT locales. Cette approche réduit le risque de mismatch domaine tout en démarrant rapidement le pipeline IF + LSTM.

**Steps**
1. Définir le schéma canonique cible (colonnes normalisées) avec clés minimales: timestamp_utc, site_id, sensor_type, pollutant, value, unit, temp_c, rh_percent, pressure_hpa, wind_speed_ms, source_name. Cette étape bloque toutes les suivantes.
2. Ingestion source A (EPA AQS hourly): extraire NO2/SO2/CO/PM2.5/PM10 + météo, conserver uniquement colonnes utiles, convertir timestamps en UTC. *depends on 1*
3. Ingestion source B (Beijing multi-site): mapper PM2.5/PM10/SO2/NO2/CO + TEMP vers le même schéma canonique. *parallel with 2 after step 1*
4. Ingestion source C (UCI Air Quality): utiliser surtout pour robustesse capteur (drift, missing, capteurs cross-sensitive), mapper NOx/NO2/CO + T/RH/AH. *parallel with 2 after step 1*
5. Harmoniser les unités par polluant avant concaténation: NO2/SO2/CO en ppb ou ug/m3 de façon cohérente, PM en ug/m3, température en C, humidité en %RH. Documenter une seule unité cible par variable. *depends on 2,3,4*
6. Contrôle qualité global: doublons (site+pollutant+timestamp), valeurs hors plage physique, taux de manquants par colonne/site/polluant, trous temporels > 3 pas. *depends on 5*
7. Traitement manquants et bruit selon ta spec: interpolation linéaire pour trous courts (<5% séquences), lissage EMA alpha=0.3, marquage flags imputed/is_outlier. *depends on 6*
8. Feature engineering commun: mean_10m, std_10m, rate_of_change, rolling_max_30m, index de pollution, corrélation CO2-NOx (ou proxy CO-NO2 en pré-entraînement public). *depends on 7*
9. Construction jeux ML par tâche:
- IF (anomalies): fenêtre glissante multivariée, contamination initiale 0.05.
- LSTM (prévision): tenseur lookback 60, horizon 4 (1h) et 96 (24h) selon granularité re-échantillonnée.
*depends on 8*
10. Stratégie anti-domain shift: pré-entraînement sur données publiques, puis fine-tuning obligatoire sur données IoT locales (ESP32) avant validation finale. *depends on 9*
11. Données manquantes critiques (CO2/PM1/COV): générer provisoirement via simulation calibrée et marquer clairement synthetic=true; remplacer progressivement par données réelles dès disponibilité. *depends on 10*
12. Split temporel strict train/val/test (pas de shuffle): 70/15/15 par site et par polluant pour éviter fuite temporelle. *depends on 9*

**Relevant files**
- ia/preprocessor.py — implémenter normalisation unités, nettoyage, interpolation, lissage EMA, flags qualité.
- ia/model_trainer.py — assembler datasets fusionnés, créer features, split temporel, entraînement IF/LSTM.
- ia/data_generator.py — générer CO2/PM1/COV synthétiques calibrés en attendant données terrain.
- ia/config.py — centraliser unités cibles, plages physiques, mappings de colonnes par source.
- backend/models/Reading.js — vérifier compatibilité schéma d'entrée (unit, value, timestamp, isValid, rawValue).
- backend/models/Polluant.js — aligner seuils réglementaires et unités utilisées par les modèles.

**Verification**
1. Vérifier couverture par variable cible (% de lignes non nulles) pour chaque source avant fusion.
2. Vérifier distribution par polluant avant/après harmonisation d'unités (moyenne, p95, max).
3. Vérifier continuité temporelle par site/polluant après resampling.
4. Vérifier labels/flags qualité (imputed, outlier, synthetic) présents et cohérents.
5. Exécuter entraînement IF baseline et valider recall cible prioritaire (>0.90 sur anomalies injectées).
6. Exécuter entraînement LSTM baseline et suivre RMSE/MAE/MAPE/R2 par polluant.
7. Comparer performance pré-entraînement public vs fine-tuning données locales; accepter le modèle local même si légèrement moins bon offline mais meilleur en conditions réelles.

**Decisions**
- Inclus: datasets publics pour accélérer prototypage et robustesse.
- Exclus: mise en production directe d'un modèle entraîné uniquement sur données publiques.
- Inclus: génération synthétique temporaire pour CO2/PM1/COV.
- Exclus: conclusions réglementaires finales sans recalibrage local par site industriel.

**Further Considerations**
1. Unité cible CO/NO2/SO2: choisir ppb (proche capteurs gaz) ou ug/m3 (proche normes). Reco: garder unité capteur native puis convertir à l'affichage réglementaire.
2. Granularité d'entraînement: hourly public vs 10-30s local. Reco: entraîner baseline hourly puis fine-tune local à granularité réelle.
3. Approche multi-sites vs par site: Reco: modèle global initial + adaptation par site (calibration légère) pour réduire drift local.
