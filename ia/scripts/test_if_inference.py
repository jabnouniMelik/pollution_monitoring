"""Smoke test Isolation Forest — nécessite notebook 04 exécuté."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from if_inference import IFAnomalyDetector  # noqa: E402


def main() -> None:
    det = IFAnomalyDetector()
    # Valeurs physiques plausibles (ordre IF_FEATURE_NAMES)
    sample = [0.5, 0.08, 12.0, 14.0, 420.0, 55.0]
    out = det.detect(sample)
    print("OK — détection IF")
    print(out)


if __name__ == "__main__":
    main()
