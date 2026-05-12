# Requirements Document

## Introduction

This document defines the requirements for the AI/ML pipeline module of the IoT Pollution Monitoring System. The pipeline ingests real public datasets (EPA AQS, Beijing Multi-Site, UCI Air Quality), builds a unified training dataset through a 12-step preparation process, trains two models (Isolation Forest for anomaly detection and LSTM for pollutant forecasting), and integrates the trained models into the existing Node.js/Express backend. All dataset preparation and model training tasks are implemented as Jupyter notebooks (.ipynb). No synthetic data generation is performed; missing critical variables (CO2/PM1/VOC) are marked with `synthetic=true` as placeholders until real IoT data is available.

The pipeline must be compatible with the existing backend schema: `Reading` (sensorId, PolluantId, nodeId, value, unit, isValid, rawValue, timestamp) and `Polluant` (name, formula, unit, regulatoryLimit, warningThreshold, conversionFactor).

---

## Glossary

- **Pipeline**: The end-to-end data processing and model training workflow implemented in Python.
- **Canonical_Schema**: The normalized column set used across all data sources: `timestamp_utc`, `site_id`, `sensor_type`, `pollutant`, `value`, `unit`, `temp_c`, `rh_percent`, `pressure_hpa`, `wind_speed_ms`, `source_name`.
- **Preprocessor**: The Python module (`ia/preprocessor.py`) responsible for unit normalization, cleaning, interpolation, EMA smoothing, and quality flags.
- **Model_Trainer**: The Python module (`ia/model_trainer.py`) responsible for assembling fused datasets, feature engineering, temporal splitting, and training IF/LSTM models.
- **Config**: The Python module (`ia/config.py`) centralizing target units, physical ranges, and column mappings per source.
- **EPA_AQS**: The U.S. Environmental Protection Agency Air Quality System hourly dataset providing NO2, SO2, CO, PM2.5, PM10, and weather data.
- **Beijing_Dataset**: The Beijing Multi-Site Air Quality dataset providing PM2.5, PM10, SO2, NO2, CO, and temperature data.
- **UCI_Dataset**: The UCI Air Quality dataset providing NOx, NO2, CO, temperature, relative humidity, and absolute humidity data, used primarily for sensor robustness (drift, missing values, cross-sensitivity).
- **IF_Model**: The Isolation Forest model used for multivariate anomaly detection.
- **LSTM_Model**: The Long Short-Term Memory recurrent neural network used for pollutant time-series forecasting.
- **Quality_Flag**: A boolean column (`imputed` or `is_outlier`) added to each row to indicate data treatment applied.
- **Temporal_Split**: A strict chronological train/validation/test partition (70%/15%/15%) with no shuffling, applied per site and per pollutant.
- **Domain_Shift**: The distribution mismatch between public training data and local IoT sensor data.
- **Fine_Tuning**: Retraining a pre-trained model on local IoT data to reduce domain shift.
- **AI_Service**: The Python FastAPI (or Flask) microservice exposing trained model predictions to the Node.js backend.
- **Notebook**: A Jupyter notebook (.ipynb) file used for interactive dataset preparation and model training tasks.
- **EMA**: Exponential Moving Average smoothing with configurable alpha parameter.
- **Lookback_Window**: The number of past time steps fed as input to the LSTM model (default: 60).
- **Forecast_Horizon**: The number of future time steps predicted by the LSTM model (short: 4 steps = 1h, long: 96 steps = 24h).
- **Contamination**: The expected proportion of anomalies in the training dataset for Isolation Forest (default: 0.05).
- **Physical_Range**: The valid min/max value bounds for each pollutant and meteorological variable, defined in `Config`.

---

## Requirements

### Requirement 1: Canonical Schema Definition

**User Story:** As a data engineer, I want a single normalized column schema shared across all data sources, so that all downstream processing steps operate on a consistent data structure.

#### Acceptance Criteria

1. THE `Config` SHALL define the Canonical_Schema with exactly these columns: `timestamp_utc` (UTC datetime), `site_id` (string), `sensor_type` (string), `pollutant` (string), `value` (float), `unit` (string), `temp_c` (float, nullable), `rh_percent` (float, nullable), `pressure_hpa` (float, nullable), `wind_speed_ms` (float, nullable), `source_name` (string).
2. THE `Config` SHALL define one and only one target unit per pollutant: NO2 in µg/m³, SO2 in µg/m³, CO in mg/m³, PM2.5 in µg/m³, PM10 in µg/m³, NOx in µg/m³, temperature in °C, relative humidity in %RH.
3. THE `Config` SHALL define Physical_Range bounds for each pollutant and meteorological variable used in quality control.
4. WHEN a source column mapping is defined in `Config`, THE `Preprocessor` SHALL apply that mapping without hardcoding column names in processing notebooks.

---

### Requirement 2: EPA AQS Source Ingestion

**User Story:** As a data engineer, I want to ingest EPA AQS hourly data into the Canonical_Schema, so that I have a reliable base of NO2, SO2, CO, PM2.5, PM10, and weather measurements with UTC timestamps.

#### Acceptance Criteria

1. WHEN the EPA AQS ingestion notebook is executed, THE `Preprocessor` SHALL load raw EPA AQS CSV files and map them to the Canonical_Schema using the column mappings defined in `Config`.
2. WHEN ingesting EPA AQS data, THE `Preprocessor` SHALL convert all timestamps to UTC and store them in the `timestamp_utc` column.
3. WHEN ingesting EPA AQS data, THE `Preprocessor` SHALL set `source_name` to `"EPA_AQS"` for all rows.
4. WHEN ingesting EPA AQS data, THE `Preprocessor` SHALL retain only the columns defined in the Canonical_Schema and discard all other source columns.
5. IF a required Canonical_Schema column cannot be mapped from the EPA AQS source, THEN THE `Preprocessor` SHALL set that column to null and log a warning identifying the column name and source file.

---

### Requirement 3: Beijing Multi-Site Source Ingestion

**User Story:** As a data engineer, I want to ingest the Beijing Multi-Site dataset into the Canonical_Schema, so that I have additional PM2.5, PM10, SO2, NO2, and CO measurements from multiple urban monitoring sites.

#### Acceptance Criteria

1. WHEN the Beijing ingestion notebook is executed, THE `Preprocessor` SHALL load raw Beijing Multi-Site CSV files and map PM2.5, PM10, SO2, NO2, CO, and TEMP columns to the Canonical_Schema using `Config` mappings.
2. WHEN ingesting Beijing data, THE `Preprocessor` SHALL convert all timestamps to UTC and set `source_name` to `"BEIJING_MULTISITE"`.
3. WHEN ingesting Beijing data, THE `Preprocessor` SHALL map each monitoring station identifier to the `site_id` column.
4. IF a Beijing source file is missing or unreadable, THEN THE `Preprocessor` SHALL raise a descriptive error identifying the missing file path and halt ingestion for that source.

---

### Requirement 4: UCI Air Quality Source Ingestion

**User Story:** As a data engineer, I want to ingest the UCI Air Quality dataset into the Canonical_Schema, so that I can use its sensor drift, missing value, and cross-sensitivity patterns to improve model robustness.

#### Acceptance Criteria

1. WHEN the UCI ingestion notebook is executed, THE `Preprocessor` SHALL load raw UCI Air Quality CSV files and map NOx, NO2, CO, temperature (T), relative humidity (RH), and absolute humidity (AH) columns to the Canonical_Schema using `Config` mappings.
2. WHEN ingesting UCI data, THE `Preprocessor` SHALL convert all timestamps to UTC and set `source_name` to `"UCI_AIR_QUALITY"`.
3. WHEN ingesting UCI data, THE `Preprocessor` SHALL preserve rows with sensor drift and missing value patterns without removing them, as these patterns are required for sensor robustness training.
4. IF the UCI source file uses semicolons as delimiters or commas as decimal separators, THEN THE `Preprocessor` SHALL handle these format variations automatically.

---

### Requirement 5: Unit Harmonization

**User Story:** As a data engineer, I want all pollutant values converted to a single target unit before dataset fusion, so that model training is not affected by unit inconsistencies across sources.

#### Acceptance Criteria

1. WHEN datasets from multiple sources are concatenated, THE `Preprocessor` SHALL apply unit conversion factors defined in `Config` to normalize all pollutant values to their target units before concatenation.
2. THE `Preprocessor` SHALL document the conversion formula applied for each pollutant-unit pair in a dedicated section of the harmonization notebook.
3. WHEN unit harmonization is applied to a value, THE `Preprocessor` SHALL update the `unit` column to reflect the target unit.
4. IF a value's source unit is not recognized by `Config`, THEN THE `Preprocessor` SHALL raise a descriptive error identifying the unrecognized unit and the affected rows.
5. WHEN unit harmonization is complete, THE `Preprocessor` SHALL produce a distribution summary (mean, p95, max) per pollutant before and after conversion for verification.

---

### Requirement 6: Global Quality Control

**User Story:** As a data engineer, I want to detect and flag duplicate records, out-of-range values, high missing rates, and temporal gaps in the fused dataset, so that downstream models are not trained on corrupted data.

#### Acceptance Criteria

1. WHEN quality control is executed, THE `Preprocessor` SHALL identify and remove duplicate rows defined as rows sharing the same (`site_id`, `pollutant`, `timestamp_utc`) combination, retaining the first occurrence.
2. WHEN quality control is executed, THE `Preprocessor` SHALL flag rows where `value` falls outside the Physical_Range defined in `Config` by setting `is_outlier` to `True`.
3. WHEN quality control is executed, THE `Preprocessor` SHALL compute and report the missing rate (% null values) per column, per site, and per pollutant.
4. WHEN quality control is executed, THE `Preprocessor` SHALL detect temporal gaps greater than 3 consecutive time steps per site/pollutant series and log each gap with its start timestamp, end timestamp, and duration.
5. AFTER quality control is complete, THE `Preprocessor` SHALL produce a quality report summarizing: duplicate count removed, outlier count flagged, missing rate per variable, and temporal gap count per site.

---

### Requirement 7: Missing Data and Noise Treatment

**User Story:** As a data engineer, I want short gaps filled by interpolation and noisy signals smoothed by EMA, so that the training dataset has sufficient temporal continuity for sequence models.

#### Acceptance Criteria

1. WHEN a pollutant time series has a gap shorter than 5% of the total sequence length, THE `Preprocessor` SHALL fill the gap using linear interpolation and set the `imputed` flag to `True` for all interpolated rows.
2. WHEN a pollutant time series has a gap of 5% or more of the total sequence length, THE `Preprocessor` SHALL leave the gap unfilled and log it as a long gap requiring manual review.
3. WHEN EMA smoothing is applied, THE `Preprocessor` SHALL use alpha=0.3 and apply it per site/pollutant series after interpolation.
4. WHEN EMA smoothing is applied, THE `Preprocessor` SHALL preserve the original value in a `raw_value` column before overwriting `value` with the smoothed value.
5. THE `Preprocessor` SHALL ensure that every row in the output dataset has an `imputed` column (boolean) and an `is_outlier` column (boolean), with default value `False` for rows that were not treated.

---

### Requirement 8: Feature Engineering

**User Story:** As a data engineer, I want rolling statistical features and a pollution index computed for each site/pollutant series, so that models have richer temporal context for anomaly detection and forecasting.

#### Acceptance Criteria

1. WHEN feature engineering is executed, THE `Model_Trainer` SHALL compute `mean_10m` (10-minute rolling mean), `std_10m` (10-minute rolling standard deviation), `rate_of_change` (difference between current and previous value), and `rolling_max_30m` (30-minute rolling maximum) per site/pollutant series.
2. WHEN feature engineering is executed, THE `Model_Trainer` SHALL compute a composite pollution index as the weighted sum of normalized pollutant values, using weights defined in `Config`.
3. WHEN feature engineering is executed, THE `Model_Trainer` SHALL compute a CO-NO2 correlation proxy as the rolling Pearson correlation between CO and NO2 values over a 60-minute window per site.
4. IF a rolling window extends beyond the available data at the start of a series, THE `Model_Trainer` SHALL set the corresponding feature value to null and exclude those rows from model training datasets.
5. WHEN feature engineering is complete, THE `Model_Trainer` SHALL verify that `rolling_max_30m >= mean_10m` holds for all non-null rows and log any violations as data quality warnings.

---

### Requirement 9: ML Dataset Construction

**User Story:** As a data scientist, I want separate ML-ready datasets built for the Isolation Forest and LSTM models, so that each model receives input tensors in the correct format for its training task.

#### Acceptance Criteria

1. WHEN building the IF dataset, THE `Model_Trainer` SHALL construct multivariate sliding windows over the engineered feature set with a window size defined in `Config` and an initial contamination parameter of 0.05.
2. WHEN building the LSTM dataset, THE `Model_Trainer` SHALL construct input tensors with shape `(n_samples, lookback=60, n_features)` and output tensors with shape `(n_samples, horizon)` where horizon is 4 (1-hour forecast) or 96 (24-hour forecast).
3. WHEN building the LSTM dataset, THE `Model_Trainer` SHALL resample all series to a consistent hourly granularity before constructing tensors.
4. WHEN building ML datasets, THE `Model_Trainer` SHALL apply the Temporal_Split (70% train / 15% validation / 15% test) strictly by chronological order per site and per pollutant, with no shuffling.
5. AFTER the Temporal_Split is applied, THE `Model_Trainer` SHALL verify that the maximum timestamp in the training set is strictly earlier than the minimum timestamp in the validation set, and the maximum timestamp in the validation set is strictly earlier than the minimum timestamp in the test set.

---

### Requirement 10: Isolation Forest Training

**User Story:** As a data scientist, I want to train an Isolation Forest model on the multivariate pollution dataset, so that I can detect anomalous sensor readings with high recall.

#### Acceptance Criteria

1. WHEN the IF training notebook is executed, THE `Model_Trainer` SHALL train an Isolation Forest model using the training split of the IF dataset with contamination=0.05.
2. WHEN evaluating the trained IF model, THE `Model_Trainer` SHALL inject a labeled set of synthetic anomalies into the test split and measure recall on those injected anomalies.
3. WHEN the IF model achieves recall >= 0.90 on injected anomalies, THE `Model_Trainer` SHALL serialize the trained model to `ia/models/isolation_forest.pkl` and log the evaluation metrics.
4. IF the IF model achieves recall < 0.90, THEN THE `Model_Trainer` SHALL log the failure, report the achieved recall value, and halt serialization until the model is retrained with adjusted parameters.
5. THE `Model_Trainer` SHALL save the IF model training metadata (training date, dataset version, contamination value, recall score) to `ia/models/isolation_forest_metadata.json`.

---

### Requirement 11: LSTM Training

**User Story:** As a data scientist, I want to train an LSTM model on the pollutant time-series dataset, so that I can forecast future pollutant concentrations at 1-hour and 24-hour horizons.

#### Acceptance Criteria

1. WHEN the LSTM training notebook is executed, THE `Model_Trainer` SHALL train an LSTM model using the training split of the LSTM dataset with lookback=60 and the configured forecast horizon.
2. WHEN evaluating the trained LSTM model, THE `Model_Trainer` SHALL compute RMSE, MAE, MAPE, and R² metrics on the test split per pollutant and log them to `ia/models/lstm_metrics.json`.
3. THE `Model_Trainer` SHALL serialize the trained LSTM model weights to `ia/models/lstm_model.h5` (or equivalent format) after each successful training run.
4. THE `Model_Trainer` SHALL save the LSTM model training metadata (training date, dataset version, lookback, horizon, metrics per pollutant) to `ia/models/lstm_metadata.json`.
5. WHERE a 24-hour forecast horizon is configured, THE `Model_Trainer` SHALL train a separate LSTM model for horizon=96 and save it independently from the 1-hour model.

---

### Requirement 12: Anti-Domain Shift Strategy

**User Story:** As a data scientist, I want models pre-trained on public data to be fine-tuned on local IoT data before production deployment, so that predictions are accurate for the specific industrial sites being monitored.

#### Acceptance Criteria

1. THE `Model_Trainer` SHALL support a fine-tuning mode that loads a pre-trained model checkpoint and continues training on a provided local IoT dataset.
2. WHEN fine-tuning is executed, THE `Model_Trainer` SHALL apply the same Temporal_Split and feature engineering pipeline used during pre-training to the local IoT dataset.
3. WHEN fine-tuning is complete, THE `Model_Trainer` SHALL compare test-set metrics (RMSE for LSTM, recall for IF) between the pre-trained model and the fine-tuned model and log the comparison to `ia/models/finetuning_comparison.json`.
4. THE `Model_Trainer` SHALL accept a fine-tuned model even if its offline metrics are slightly lower than the pre-trained model, provided the fine-tuned model was trained on local IoT data from the target site.
5. WHEN local IoT data is not yet available, THE `Model_Trainer` SHALL use the pre-trained public model as the default and log a warning indicating that fine-tuning has not been performed.

---

### Requirement 13: Missing Critical Variable Handling

**User Story:** As a data engineer, I want missing critical variables (CO2, PM1, VOC) to be clearly marked rather than generated, so that the dataset accurately reflects data availability and models are not trained on fabricated values.

#### Acceptance Criteria

1. WHEN a row in the fused dataset is missing CO2, PM1, or VOC values and no real measurement is available, THE `Preprocessor` SHALL set those column values to null and set a `synthetic` flag column to `True` for that row.
2. THE `Preprocessor` SHALL never generate estimated or simulated values for CO2, PM1, or VOC columns; only real measurements from public datasets or local IoT sensors are permitted.
3. WHEN real CO2, PM1, or VOC measurements become available from local IoT sensors, THE `Preprocessor` SHALL replace the null values and set `synthetic` to `False` for the corresponding rows.
4. THE `Model_Trainer` SHALL exclude rows where `synthetic=True` from model training and validation splits, and log the count of excluded rows per variable.

---

### Requirement 14: Jupyter Notebook Workflow

**User Story:** As a data scientist, I want all dataset preparation and model training steps implemented as Jupyter notebooks, so that I can interactively inspect intermediate results, visualize distributions, and iterate on processing parameters.

#### Acceptance Criteria

1. THE Pipeline SHALL implement each of the 12 preparation steps as a separate Jupyter notebook (.ipynb) file organized under `ia/notebooks/`.
2. WHEN a notebook is executed from top to bottom, THE Pipeline SHALL produce all expected outputs (cleaned datasets, trained models, evaluation metrics) without requiring manual intervention between cells.
3. THE Pipeline SHALL organize notebooks in the following structure: `ia/notebooks/01_canonical_schema.ipynb`, `ia/notebooks/02_ingest_epa.ipynb`, `ia/notebooks/03_ingest_beijing.ipynb`, `ia/notebooks/04_ingest_uci.ipynb`, `ia/notebooks/05_unit_harmonization.ipynb`, `ia/notebooks/06_quality_control.ipynb`, `ia/notebooks/07_missing_noise_treatment.ipynb`, `ia/notebooks/08_feature_engineering.ipynb`, `ia/notebooks/09_ml_datasets.ipynb`, `ia/notebooks/10_train_isolation_forest.ipynb`, `ia/notebooks/11_train_lstm.ipynb`, `ia/notebooks/12_finetuning.ipynb`.
4. WHEN a notebook depends on outputs from a previous notebook, THE Pipeline SHALL load those outputs from a shared `ia/data/processed/` directory using file paths defined in `Config`.
5. THE Pipeline SHALL include a `requirements.txt` or `environment.yml` file listing all Python dependencies with pinned versions required to execute the notebooks.

---

### Requirement 15: AI Service Integration with Node.js Backend

**User Story:** As a backend developer, I want the trained AI models exposed through a Python microservice API, so that the Node.js backend can request anomaly scores and pollutant forecasts without embedding Python in the Node.js process.

#### Acceptance Criteria

1. THE `AI_Service` SHALL expose a REST endpoint `POST /predict/anomaly` that accepts a JSON payload compatible with the Reading schema (`sensorId`, `polluantId`, `nodeId`, `value`, `unit`, `timestamp`) and returns an anomaly score and a boolean `is_anomaly` flag.
2. THE `AI_Service` SHALL expose a REST endpoint `POST /predict/forecast` that accepts a JSON array of the last 60 readings for a given sensor and returns a forecast array of length equal to the configured horizon.
3. WHEN the Node.js backend receives a new Reading via MQTT ingestion, THE `AI_Service` SHALL be called asynchronously so that anomaly detection does not block the MQTT ingestion response.
4. WHEN the `AI_Service` detects an anomaly (`is_anomaly=True`), THE Node.js backend SHALL create an Alert with `type="Anomaly"` and `severity` determined by the anomaly score magnitude, following the existing alert severity rules.
5. IF the `AI_Service` is unavailable or returns an error, THEN THE Node.js backend SHALL log the error, continue normal Reading ingestion and threshold-based alerting, and NOT raise an exception that would block the MQTT pipeline.
6. THE `AI_Service` SHALL return predictions within 500ms for the anomaly endpoint and within 2000ms for the forecast endpoint under normal operating conditions.
7. WHEN a new fine-tuned model is deployed, THE `AI_Service` SHALL reload the model without requiring a full service restart, using a model reload endpoint `POST /models/reload`.

---

### Requirement 16: Data Coverage and Quality Verification

**User Story:** As a data engineer, I want automated verification checks at each pipeline stage, so that I can confirm data quality before proceeding to the next step.

#### Acceptance Criteria

1. WHEN the ingestion stage is complete for each source, THE `Preprocessor` SHALL compute and display the coverage percentage (% non-null rows) for each target variable per source.
2. WHEN unit harmonization is complete, THE `Preprocessor` SHALL display the distribution summary (mean, p95, max) per pollutant before and after conversion.
3. WHEN the resampling stage is complete, THE `Preprocessor` SHALL verify temporal continuity per site/pollutant by checking that no gap larger than 3 time steps remains after treatment.
4. WHEN the full pipeline is complete, THE `Preprocessor` SHALL verify that Quality_Flag columns (`imputed`, `is_outlier`, `synthetic`) are present in the output dataset and that no row is missing these flags.
5. WHEN the IF model training is complete, THE `Model_Trainer` SHALL verify that recall on injected anomalies is >= 0.90 and display the confusion matrix.
6. WHEN the LSTM model training is complete, THE `Model_Trainer` SHALL display RMSE, MAE, MAPE, and R² per pollutant on the test split.

---

## Correctness Properties

The following properties are derived from the acceptance criteria and are suitable for property-based testing.

### P1: Canonical Schema Completeness (Invariant)
FOR ALL rows in any dataset produced by the `Preprocessor`, every column defined in the Canonical_Schema SHALL be present. No column name from the Canonical_Schema SHALL be absent from the output DataFrame columns.

### P2: Unit Conversion Round-Trip (Round-Trip Property)
FOR ALL pollutant values `v` with a defined conversion factor `f` in `Config`, applying the forward conversion `v * f` followed by the inverse conversion `(v * f) / f` SHALL return a value equal to `v` within floating-point tolerance (1e-9).

### P3: Quality Flag Consistency (Invariant)
FOR ALL rows in the output dataset, IF a value was filled by interpolation, THEN `imputed=True`. FOR ALL rows, IF a value was outside the Physical_Range at the time of quality control, THEN `is_outlier=True`. No row SHALL have `imputed=True` or `is_outlier=True` without a corresponding treatment having been applied.

### P4: Temporal Split Ordering (Invariant)
FOR ALL (site_id, pollutant) pairs in the ML datasets, the maximum timestamp in the training split SHALL be strictly less than the minimum timestamp in the validation split, and the maximum timestamp in the validation split SHALL be strictly less than the minimum timestamp in the test split.

### P5: LSTM Tensor Shape (Invariant)
FOR ALL samples in the LSTM dataset with lookback=L and horizon=H, the input tensor shape SHALL be `(L, n_features)` and the output tensor shape SHALL be `(H,)`. The total number of samples SHALL equal `n_timesteps - L - H + 1`.

### P6: Duplicate-Free After QC (Invariant)
FOR ALL rows in the dataset after quality control, no two rows SHALL share the same (`site_id`, `pollutant`, `timestamp_utc`) combination.

### P7: Rolling Max >= Rolling Mean (Metamorphic Property)
FOR ALL non-null rows in the engineered feature dataset, `rolling_max_30m >= mean_10m` SHALL hold. A violation of this property indicates a bug in the rolling window computation.

### P8: EMA Boundedness (Invariant)
FOR ALL values in a smoothed series, the EMA-smoothed value SHALL be bounded by the minimum and maximum of the original series values used in the smoothing window. No smoothed value SHALL exceed the original series range.

### P9: Synthetic Flag Exclusivity (Invariant)
FOR ALL rows where `synthetic=True`, the `value` column for CO2, PM1, or VOC SHALL be null. No row SHALL have `synthetic=True` AND a non-null value for those variables simultaneously.

### P10: AI Service Response Schema (Invariant)
FOR ALL valid Reading payloads sent to `POST /predict/anomaly`, the response SHALL contain the fields `anomaly_score` (float in [0, 1]) and `is_anomaly` (boolean). FOR ALL valid payloads sent to `POST /predict/forecast`, the response SHALL contain a `forecast` array of length equal to the configured horizon.

### P11: Model Serialization Round-Trip (Round-Trip Property)
FOR ALL trained models, saving the model to disk and reloading it SHALL produce identical predictions for the same input data. The prediction difference between the original and reloaded model SHALL be zero (exact equality for IF labels, within 1e-6 for LSTM float outputs).
