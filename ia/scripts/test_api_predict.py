"""Quick test of /predict endpoint with simulator-like 48h matrix."""
import json
import urllib.request
import numpy as np
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import LSTM_FEATURE_NAMES

SIM_BASELINE = {
    "CO2": 650, "NOX": 680, "SOX": 340, "PM25": 17,
    "PM10": 20.4, "COV": 90, "TEMPERATURE": 25, "HUMIDITY": 50,
}

np.random.seed(42)
rows = []
for h in range(48):
    wave = np.sin(h / 6)
    row = []
    for name in LSTM_FEATURE_NAMES:
        base = SIM_BASELINE[name]
        noise = 1 + 0.05 * (np.random.random() - 0.5)
        row.append(float(base * (1 + 0.08 * wave) * noise))
    rows.append(row)

body = json.dumps({"horizon_hours": 4, "lookback_values": rows}).encode()
req = urllib.request.Request(
    "http://localhost:8000/predict",
    data=body,
    headers={"Content-Type": "application/json"},
)
r = urllib.request.urlopen(req)
result = json.loads(r.read())

print(f"go_deploy: {result['go_deploy']}")
print(f"horizon_hours: {result['horizon_hours']}")
print(f"alert_source: {result['alert_source']}")

for step in result["forecasts"]:
    print(f"\n{step['step']}:")
    for name in ["CO2", "NOX", "SOX", "PM10", "PM25", "COV"]:
        p = step["pollutants"][name]
        print(f"  {name}: {p['value_physical']:.1f} [{p['prediction_source']}]")
