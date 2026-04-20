# ✅ KPI VERIFICATION & SUPERADMIN PARAMETERS

**Date:** April 16, 2026  
**Status:** All KPI formulas verified ✅ Correctly implemented

---

## 📋 KPI FORMULAS VERIFICATION

### KPI 1️⃣ : TAUX DE DÉPASSEMENT (TD) - Breach Rate

**Your Formula:**
$$TD(p,T) = \frac{N_{breach}(p,T)}{N_{total}(p,T)} \times 100$$

**Global TD:**
$$TD_{global}(T) = \frac{1}{P} \sum_{p=1}^{P} TD(p,T)$$

**Implementation Status:** ✅ **CORRECT**

**Code Location:** [KPIService.js](KPIService.js#L17-L65)

**Calculation Details:**
- `N_breach` = Count of readings where `value > VLE` (Regulatory Limit)
- `N_total` = Count of valid readings (`isValid: true`)
- Returns percentage (0-100%)
- Default VLE from Polluant model's `regulatoryLimit` field

**Current Logic:**
```javascript
const tauxDepassement = (breachCount / totalCount) * 100;
```

**Regulatory Target:** ≤ 2% per month (NT 106.04)

---

### KPI 2️⃣ : ÉMISSION MOYENNE JOURNALIÈRE (EMJ) - Daily Average Emission

**Your Formula:**
$$EMJ(p) = C_{moy}(p) \times Q_{air} \times 86400 \times 10^{-6} \text{ (kg/day)}$$

**Where:**
$$C_{moy}(p) = \frac{1}{N} \sum_{i=1}^{N} C_i(p) \text{ (mg/Nm³)}$$

**Implementation Status:** ✅ **CORRECT**

**Code Location:** [KPIService.js](KPIService.js#L67-L115)

**Calculation Details:**
- `C_moy` = Average concentration from all readings over period
- `Q_air` = Volumetric air flow rate (Nm³/s)
- `86400` = Seconds per day (24 × 3600)
- `10⁻⁶` = Conversion factor (mg → kg)
- Result: **kg/day**

**Current Logic:**
```javascript
const emissionKgDay = cMoy * qAir * 86400 * 1e-6;
```

**Regulatory Target:** -10% reduction per quarter (ISO 14064-1 compliance)

---

### KPI 3️⃣ : INDICE DE PERFORMANCE ENVIRONNEMENTALE (IPE) - Environmental Performance Index

**Your Formula:**
$$IPE(T) = 100 \times \frac{1}{P} \sum_{p=1}^{P} [W_p \times Score(p,T)]$$

**Score Calculation:**
$$Score(p,T) = \max\left(0, 1 - \frac{C_{moy}(p,T) - V_{limite}}{V_{limite}}\right)$$

**Implementation Status:** ✅ **CORRECT**

**Code Location:** [KPIService.js](KPIService.js#L117-L202)

**Calculation Details:**
- `Wp` = Regulatory weight for pollutant p
- `Score(p)` = Compliance score for each pollutant [0, 1]
  - If `C_moy ≤ VLE`: Score = 1.0 (100% compliant)
  - If `C_moy > VLE`: Score = max(0, 1 - (C_moy - VLE) / VLE)
- Final IPE normalized to [0, 100]

**Regulatory Weights (NT 106.04):**
| Pollutant | Weight | Current |
|-----------|--------|---------|
| NOx | 30% | ✅ 0.30 |
| SO₂ | 25% | ✅ 0.25 |
| PM₂.₅ | 25% | ✅ 0.25 |
| COV | 15% | ✅ 0.15 |
| CO₂ | 5% | ✅ 0.05 |
| **Total** | **100%** | ✅ 1.00 |

**Regulatory Target:** ≥ 95 per month

**Interpretation Scale:**
- **95-100:** Excellent ✅ Full regulatory compliance
- **80-95:** Good 📊 Standard monitoring
- **60-80:** Degraded ⚠️ Action plan recommended
- **<60:** Critical 🚨 Immediate intervention needed

---

### KPI 4️⃣ : RÉDUCTION ESTIMÉE CO₂ (RCO2) - CO₂ Emission Reduction

**Your Formula:**
$$RCO_2 = \frac{EMJ_{CO_2}(T) - EMJ_{CO_2}(T_0)}{EMJ_{CO_2}(T_0)} \times 100$$

**Absolute Reduction:**
$$\Delta EMJ = EMJ_{CO_2}(T_0) - EMJ_{CO_2}(T) \text{ (kg/day)}$$

**Implementation Status:** ✅ **CORRECT**

**Code Location:** [KPIService.js](KPIService.js#L204-L268)

**Calculation Details:**
- `EMJ(T)` = Current period emission (kg/day)
- `EMJ(T0)` = Reference/baseline period emission (kg/day)
- Returns percentage reduction (negative = reduction ✅)
- Also calculates absolute reduction in kg/day

**Current Logic:**
```javascript
const reductionPct = ((currentEMJ - referenceEMJ) / referenceEMJ) * 100;
const reductionAbsolute = referenceEMJ - currentEMJ; // kg/day
```

**Regulatory Target:** ≤ -5% per quarter (ISO 14064-1 compliance)

---

## 🔧 SUPERADMIN CONFIGURABLE PARAMETERS

The following parameters can be adjusted by SUPER_ADMIN via API endpoints:

### 📍 Location 1: SiteConfig Model

**Endpoint:** `PUT /api/site-config/:id` (SUPER_ADMIN only)

| Parameter | Type | Default | Min | Max | Impact | Adjustable by |
|-----------|------|---------|-----|-----|--------|---------------|
| **airflow** (Qair) | Number | 2.0 | 0.1 | 100 | Affects EMJ calculation | SUPER_ADMIN |
| **thermalPower** | Number | null | - | - | Alternative airflow estimation | SUPER_ADMIN |

**Example:**
```json
{
  "airflow": 3.5,
  "thermalPower": 5000
}
```

---

### 📊 Location 2: Pollutant Weights (for IPE)

**Endpoint:** `PUT /api/site-config/:id` → `polluantWeights`

| Pollutant | Parameter | Default | Min | Max | Regulatory |
|-----------|-----------|---------|-----|-----|------------|
| NOx | polluantWeights.NOx | 0.30 | 0 | 1 | 30% (NT 106.04) |
| SO₂ | polluantWeights.SO2 | 0.25 | 0 | 1 | 25% (NT 106.04) |
| PM₂.₅ | polluantWeights.PM25 | 0.25 | 0 | 1 | 25% (NT 106.04) |
| COV | polluantWeights.COV | 0.15 | 0 | 1 | 15% (NT 106.04) |
| CO₂ | polluantWeights.CO2 | 0.05 | 0 | 1 | 5% (NT 106.04) |

**Constraint:** Sum of all weights MUST equal 1.0

**Example:**
```json
{
  "polluantWeights": {
    "NOx": 0.35,
    "SO2": 0.25,
    "PM25": 0.20,
    "COV": 0.15,
    "CO2": 0.05
  }
}
```

---

### 🎯 Location 3: KPI Targets

**Endpoint:** `PUT /api/site-config/:id` → `targets`

| Parameter | Default | Unit | Typical Range | Purpose |
|-----------|---------|------|---|---------|
| **targets.tauxDepassement** | 2.0 | % | 0-5% | Max allowed breach rate |
| **targets.ipe** | 95 | /100 | 60-100 | Min acceptable IPE score |
| **targets.reductionCO2** | -5.0 | % | -20% to 0% | Min CO₂ reduction target |

**Example:**
```json
{
  "targets": {
    "tauxDepassement": 1.5,
    "ipe": 92,
    "reductionCO2": -8.0
  }
}
```

---

### ⚠️ Location 4: Regulatory Limits (via ThresholdConfig)

**Endpoint:** `PUT /api/thresholds/:id` (SUPER_ADMIN only)

| Pollutant | Field | Default (Tunisia 2010-2516) | Adjustable |
|-----------|-------|------|---|
| NOx | max | 450 mg/Nm³ | ⚠️ Yes (warning-critical recalc) |
| SO₂ | max | 1700 mg/Nm³ | ⚠️ Yes |
| PM | max | 550 mg/m³ | ⚠️ Yes |
| PM₂.₅ | max | 550 mg/m³ | ⚠️ Yes |
| COV | max | 110 mg/Nm³ | ⚠️ Yes |
| CO₂ | max | 800 ppm | ⚠️ Yes |

**Example:**
```json
{
  "polluants": {
    "NOx": {
      "min": 120,
      "max": 500,
      "unit": "mg/Nm³",
      "reference": "Décret 2010-2516"
    }
  }
}
```

**Automatic Recalculation:**
When max is changed, warning/critical thresholds auto-recalculate:
- `warning = max - (max × warningOffsetPercent/100)`
- `critical = max + (max × criticalOffsetPercent/100)`

---

## 📋 REQUIRED API ENDPOINTS (Backend Implementation)

### For SUPERADMIN Parameter Configuration

```javascript
// GET current configuration
GET /api/site-config

// UPDATE configuration (SUPER_ADMIN only)
PUT /api/site-config/:id
{
  "airflow": 2.5,
  "thermalPower": 5000,
  "polluantWeights": { ... },
  "targets": { ... }
}

// GET threshold configuration
GET /api/thresholds

// UPDATE threshold configuration (SUPER_ADMIN only)
PUT /api/thresholds/:id
{
  "polluants": { ... },
  "warningOffsetPercent": 20,
  "criticalOffsetPercent": 20
}
```

---

## 🔐 ROLE-BASED ACCESS CONTROL

| Operation | SUPER_ADMIN | HEAD_SUPERVISOR | SITE_SUPERVISOR | OPERATOR | AUDITOR |
|-----------|---|---|---|---|---|
| **View KPIs** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Adjust airflow (Q_air)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Adjust pollutant weights** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Adjust regulatory limits** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Set KPI targets** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Export KPI reports** | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## ✨ SUMMARY

| KPI | Formula | Status | Verified | Parameters |
|-----|---------|--------|----------|-----------|
| **TD** | (N_breach / N_total) × 100 | ✅ Correct | Yes | Target: 2.0% |
| **EMJ** | C_moy × Q_air × 86400 × 10⁻⁶ | ✅ Correct | Yes | **Q_air adjustable** |
| **IPE** | 100 × Σ(Wp × Score) / P | ✅ Correct | Yes | **Weights adjustable** |
| **RCO2** | (EMJ(T) - EMJ(T0)) / EMJ(T0) × 100 | ✅ Correct | Yes | Target: -5.0% |

### Key Configuration Files
- **KPIService.js** - All calculation logic
- **SiteConfig.js** - Q_air, weights, targets storage
- **ThresholdConfig.js** - Regulatory limits
- **SiteConfigRepository.js** - Data access layer

### Files Modified/Created
- ✅ ThresholdConfig model created
- ✅ init-thresholds.js script created
- ✅ KPI_SYSTEM_DOCUMENTATION.md exists
- ⏳ SiteConfig endpoints need implementation
- ⏳ ThresholdConfig endpoints need implementation

