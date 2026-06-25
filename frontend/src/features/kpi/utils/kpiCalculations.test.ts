import { describe, expect, it } from 'vitest'
import {
  calculateEMJ,
  calculateIPE,
  calculateRCO2,
  calculateRCO2GoalAttainment,
  calculateTD,
  getKPIStatus,
  type Reading,
} from './kpiCalculations'
import type { ThresholdConfig } from '../types/kpi.types'

const makeReading = (value: number, pollutant = 'NOX'): Reading => ({
  timestamp: new Date().toISOString(),
  measurements: { [pollutant]: { value, unit: 'mg/Nm³' } },
})

describe('calculateTD', () => {
  it('returns 0 for empty readings', () => {
    expect(calculateTD([], 'NOX', 500)).toBe(0)
  })

  it('computes exceedance percentage', () => {
    const readings = [makeReading(600), makeReading(200), makeReading(700), makeReading(100)]
    // 2 of 4 exceed 500 => 50 %
    expect(calculateTD(readings, 'NOX', 500)).toBe(50)
  })

  it('ignores other pollutants', () => {
    const readings = [makeReading(600, 'SO2'), makeReading(100, 'NOX')]
    expect(calculateTD(readings, 'NOX', 500)).toBe(0)
  })
})

describe('calculateEMJ', () => {
  it('converts concentration and airflow to kg/day', () => {
    // 10 mg/Nm³ * 1 Nm³/s * 86400 s = 864000 mg = 0.864 kg
    expect(calculateEMJ(10, 1)).toBeCloseTo(0.864, 3)
  })

  it('returns 0 for invalid input', () => {
    expect(calculateEMJ(Number.NaN, 1)).toBe(0)
  })
})

describe('calculateIPE', () => {
  const thresholds: ThresholdConfig = {
    pollutants: {
      NOX: { min: 0, max: 500, warning: 400, critical: 500, unit: 'mg/Nm³' },
      SO2: { min: 0, max: 1700, warning: 1500, critical: 1700, unit: 'mg/Nm³' },
    },
  }

  it('returns 100 when no weights match', () => {
    expect(calculateIPE({ NOX: 100 }, thresholds, {})).toBe(100)
  })

  it('produces high score for low pollution', () => {
    const score = calculateIPE({ NOX: 50, SO2: 100 }, thresholds, { NOX: 0.5, SO2: 0.5 })
    expect(score).toBeGreaterThan(90)
  })

  it('produces low score for high pollution', () => {
    const score = calculateIPE({ NOX: 500, SO2: 1700 }, thresholds, { NOX: 0.5, SO2: 0.5 })
    expect(score).toBeLessThan(10)
  })
})

describe('calculateRCO2', () => {
  it('returns 0 for zero baseline', () => {
    expect(calculateRCO2(100, 0)).toBe(0)
  })

  it('returns negative value when current < reference (reduction)', () => {
    expect(calculateRCO2(760, 800)).toBeCloseTo(-5, 3)
    expect(calculateRCO2(900, 1000)).toBeCloseTo(-10, 3)
  })
})

describe('calculateRCO2GoalAttainment', () => {
  it('returns 100% when target met exactly', () => {
    expect(calculateRCO2GoalAttainment(-5, -5)).toBe(100)
  })
  it('returns partial attainment below target', () => {
    expect(calculateRCO2GoalAttainment(-3.2, -5)).toBeCloseTo(64, 0)
  })
})

describe('getKPIStatus', () => {
  it('TD <= target is success', () => {
    expect(getKPIStatus(1.5, 2, 'TD')).toBe('success')
  })
  it('TD above 1.5x target is danger', () => {
    expect(getKPIStatus(4, 2, 'TD')).toBe('danger')
  })
  it('IPE >= target is success', () => {
    expect(getKPIStatus(96, 95, 'IPE')).toBe('success')
  })
  it('IPE below 90% of target is danger', () => {
    expect(getKPIStatus(80, 95, 'IPE')).toBe('danger')
  })
})
