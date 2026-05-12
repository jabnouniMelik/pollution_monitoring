# AI Module — Documentation
### The machine learning component for predictions and anomaly detection

---

## What is the AI Module?

The AI module is a separate Python program that adds **intelligent analysis** capabilities to the system. While the backend handles real-time data and threshold alerts, the AI module goes further by:

1. **Predicting the future** — Using historical sensor data, it forecasts where pollution levels will be in the next 1 hour and 24 hours. This gives operators advance warning before a threshold is actually exceeded.

2. **Detecting anomalies** — It learns what "normal" sensor behavior looks like, and flags readings that are statistically unusual — even if they haven't crossed a legal threshold yet. This can catch sensor malfunctions, unusual industrial events, or early signs of a problem.

Think of it as a **weather forecaster for factory emissions** — it doesn't just tell you what the weather is right now, it tells you what to expect tomorrow.

---

## The Two AI Techniques Used

### Technique 1: LSTM Neural Network (for Predictions)

**LSTM** stands for Long Short-Term Memory. It is a type of artificial neural network specifically designed to learn patterns in sequences of data over time — like stock prices, weather data, or in our case, pollution measurements.

**How it works (simplified):**
1. The model is trained on months of historical sensor readings
2. It learns the typical patterns: daily cycles, weekly trends, correlations between pollutants
3. When given the last 60 measurements (the "lookback window"), it predicts the next 4 measurements (~1 hour ahead) or next 96 measurements (~24 hours ahead)
4. The prediction comes with a confidence interval (a range of likely values)

**One model per pollutant:** The system trains a separate LSTM model for each pollutant (CO₂, NOx, SO₂, PM2.5, COV). This specialization makes each model more accurate for its specific pollutant.

**Model architecture (simplified):**
```
Input: Last 60 measurements (all 8 sensors together)
  ↓
LSTM Layer 1 (64 memory cells) — learns short-term patterns
  ↓
LSTM Layer 2 (32 memory cells) — learns longer-term patterns
  ↓
Dense Layer (16 neurons) — combines patterns
  ↓
Output: Predicted values for the next 4 or 96 timesteps
```

---

### Technique 2: Isolation Forest (for Anomaly Detection)

**Isolation Forest** is a machine learning algorithm that detects outliers — values that don't fit the normal pattern.

**How it works (simplified):**
Imagine you have a forest of decision trees. For each data point, the algorithm tries to "isolate" it by randomly splitting the data. Normal points are hard to isolate (they're surrounded by similar points), while anomalies are easy to isolate (they're far from everything else). Points that get isolated quickly are flagged as anomalies.

**What counts as an anomaly?**
- A sensor reading that is statistically very different from recent readings
- A combination of readings that is unusual (e.g., CO₂ is high but temperature is low — that's unusual)
- A sudden spike or drop that doesn't match the expected pattern

**Why is this useful?**
- A sensor might be malfunctioning and sending wrong values — the AI catches this before it causes false alerts
- An unusual industrial event (equipment failure, process change) might not immediately exceed a threshold but is still worth investigating
- It provides an early warning system that complements the threshold-based alerts

---

## The Data Pipeline

Before the AI models can make predictions, the raw sensor data must be cleaned and prepared. This is called **preprocessing**:

```
Raw readings from MongoDB
        ↓
Step 1: RESAMPLE — Convert irregular timestamps to uniform intervals
        (sensors don't always send at exactly the right time)
        ↓
Step 2: FILL GAPS — Interpolate missing values
        (if a sensor missed a reading, estimate the value from neighbors)
        Maximum 5% consecutive missing values allowed
        ↓
Step 3: REMOVE OUTLIERS — Flag physically impossible values
        (e.g., CO₂ cannot be negative or above 5000 ppm)
        Uses Z-score (statistical distance from average) and IQR method
        ↓
Step 4: SMOOTH — Apply exponential moving average
        (reduces noise from sensor jitter)
        ↓
Step 5: FEATURE ENGINEERING — Add derived features
        - 10-minute rolling average
        - 30-minute rolling average
        - CO₂ ↔ NOx cross-correlation (these pollutants are related)
        ↓
Step 6: NORMALIZE — Scale all values to the range [0, 1]
        (neural networks work better with normalized data)
        ↓
Ready for model training or prediction
```

---

## The Pollutants Tracked by the AI

The AI module tracks all 8 sensor signals. The **order matters** — it defines the column order in the data matrix fed to the neural network:

| Position | Code | Full Name | Unit | Regulatory limit? |
|----------|------|-----------|------|-------------------|
| 1 | CO2 | Carbon Dioxide | ppm | Yes |
| 2 | NOX | Nitrogen Oxides | ppm | Yes |
| 3 | SO2 | Sulfur Dioxide | ppm | Yes |
| 4 | PM1 | Fine Particles PM1 | µg/m³ | Yes |
| 5 | PM25 | Fine Particles PM2.5 | µg/m³ | Yes |
| 6 | COV | Volatile Organic Compounds | ppb | Yes |
| 7 | TEMPERATURE | Air Temperature | °C | No (contextual) |
| 8 | HUMIDITY | Relative Humidity | %RH | No (contextual) |

Temperature and humidity don't have legal limits but are included as **contextual features** because they influence how other pollutants behave and disperse.

---

## Model Training

Models are trained on historical data from MongoDB. The data is split into three parts:

```
All historical data
├── 70% Training set    ← The model learns from this
├── 15% Validation set  ← Used to tune the model during training
└── 15% Test set        ← Used to evaluate final accuracy

Important: The split is done in TIME ORDER (no shuffling)
           We can't use future data to predict the past!
```

**Training stops automatically** when the model stops improving (called "early stopping"). This prevents the model from memorizing the training data instead of learning general patterns.

**Automatic retraining:** If the model's prediction accuracy degrades by more than 20% (measured by RMSE — Root Mean Square Error), the system triggers automatic retraining on the most recent 7 days of data.

---

## Alert Severity from AI

When the AI detects an anomaly or predicts a future threshold exceedance, it communicates the severity to the Node.js backend, which then creates the appropriate alert:

| AI Severity | Dashboard Alert | When |
|-------------|----------------|------|
| CRITICAL | 🔴 Critical | Predicted value > 1.5× legal limit |
| HIGH | 🟠 High | Predicted value > legal limit |
| MEDIUM | 🟡 Warning | Predicted value > warning threshold |
| LOW | 🟡 Warning | Mild anomaly detected |

**Alert types from AI:**
- `Threshold` — AI predicts a threshold will be exceeded
- `Anomaly` — Isolation Forest detected an unusual reading
- `SensorFault` — AI detected sensor drift or malfunction pattern

---

## New Database Collections (AI-specific)

The AI module adds 3 new collections to MongoDB:

| Collection | What it stores |
|------------|---------------|
| `anomaly_detections` | Each anomaly detected: which pollutant, what value, anomaly score, timestamp |
| `predictions` | Each prediction made: pollutant, predicted values, confidence interval, horizon |
| `ai_models` | Metadata about trained models: version, accuracy (RMSE), training date, pollutant |

---

## The API (FastAPI)

The AI module exposes a REST API on **port 8000** that the frontend calls to display predictions and anomalies:

| Endpoint | What it returns |
|----------|----------------|
| `GET /health` | Is the AI service running? |
| `GET /predictions/{pollutant}` | Predicted values for the next 1h and 24h |
| `GET /anomalies` | Recent anomaly detections |
| `POST /train/{pollutant}` | Trigger model retraining (admin only) |
| `GET /models` | List of trained models with their accuracy metrics |

---

## Folder Structure

```
ia/
│
├── config.py              ← All configuration: pollutant definitions, model paths,
│                            algorithm parameters, MongoDB connection settings
│
├── preprocessor.py        ← Data cleaning pipeline (resampling, gap filling,
│                            outlier removal, normalization)
│
├── model_trainer.py       ← Trains the LSTM and Isolation Forest models
│                            on historical data from MongoDB
│
├── predictor.py           ← Uses trained LSTM models to generate predictions
│                            (currently a stub — not yet implemented)
│
├── anomalie_detetctor.py  ← Uses Isolation Forest to detect anomalies
│                            (currently a stub — not yet implemented)
│
├── data_generator.py      ← Generates synthetic training data for testing
│                            when real historical data is not available
│
├── api.py                 ← FastAPI web server that exposes predictions
│                            and anomalies to the frontend
│                            (currently a stub — not yet implemented)
│
├── models/                ← Saved trained model files
│   ├── model_lstm_CO2.keras
│   ├── model_lstm_NOX.keras
│   ├── scaler_lstm_CO2.pkl
│   └── model_isolation_forest.pkl
│
├── data/                  ← Cached training data
└── requirements.txt       ← Python package dependencies
```

---

## Current Implementation Status

> ⚠️ **Important:** The AI module is **partially implemented**. Here is the current state:

| File | Status | Notes |
|------|--------|-------|
| `config.py` | ✅ Complete | All configuration defined |
| `preprocessor.py` | ✅ Complete | Data cleaning pipeline ready |
| `model_trainer.py` | ✅ Complete | Training pipeline ready |
| `data_generator.py` | ✅ Complete | Synthetic data generation ready |
| `anomalie_detetctor.py` | ⚠️ Stub | File exists but is empty |
| `predictor.py` | ⚠️ Stub | File exists but is empty |
| `api.py` | ⚠️ Stub | File exists but is empty |

The frontend **AI Predictions page** is built and ready to display data — it just needs the Python API to be implemented and running.

---

## Technology Stack

| Technology | What it is | Why it's used |
|-----------|-----------|---------------|
| **Python 3.10+** | Programming language | Industry standard for machine learning |
| **TensorFlow/Keras 2.16** | Deep learning framework | Builds and trains the LSTM neural network |
| **scikit-learn 1.6** | Machine learning library | Provides the Isolation Forest algorithm |
| **FastAPI** | Python web framework | Creates the REST API endpoints |
| **pandas 2.2** | Data manipulation library | Handles time-series data processing |
| **numpy 1.26** | Numerical computing library | Efficient array operations for the neural network |
| **matplotlib 3.9** | Plotting library | Generates training diagnostic charts |

---

## Starting the AI Module

```bash
cd ia

# Create a virtual environment (isolated Python environment)
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# Install all dependencies
pip install -r requirements.txt

# Train the models first (requires historical data in MongoDB)
python model_trainer.py

# Start the API server
python api.py
```

The service will start on `http://localhost:8000`.
