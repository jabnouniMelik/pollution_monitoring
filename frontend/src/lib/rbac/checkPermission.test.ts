import { describe, expect, it } from 'vitest'
import {
  canAccessResource,
  hasAnyPermission,
  hasMinimumRole,
  hasPermission,
} from './checkPermission'

describe('hasPermission', () => {
  it('SUPER_ADMIN has everything', () => {
    expect(hasPermission('SUPER_ADMIN', 'DELETE_SITE')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'RETRAIN_MODEL')).toBe(true)
  })

  it('AUDITOR is read-only', () => {
    expect(hasPermission('AUDITOR', 'VIEW_KPI')).toBe(true)
    expect(hasPermission('AUDITOR', 'DELETE_SITE')).toBe(false)
    expect(hasPermission('AUDITOR', 'ACKNOWLEDGE_ALERT')).toBe(false)
  })

  it('OPERATOR cannot generate reports', () => {
    expect(hasPermission('OPERATOR', 'GENERATE_REPORT')).toBe(false)
    expect(hasPermission('OPERATOR', 'VIEW_ALERTS')).toBe(true)
  })

  it('returns false for undefined role', () => {
    expect(hasPermission(undefined, 'VIEW_KPI')).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('returns true when at least one matches', () => {
    expect(hasAnyPermission('OPERATOR', ['DELETE_SITE', 'VIEW_KPI'])).toBe(true)
  })
  it('returns false when none matches', () => {
    expect(hasAnyPermission('OPERATOR', ['DELETE_SITE'])).toBe(false)
  })
})

describe('hasMinimumRole', () => {
  it('respects hierarchy', () => {
    expect(hasMinimumRole('HEAD_SUPERVISOR', 'SITE_SUPERVISOR')).toBe(true)
    expect(hasMinimumRole('OPERATOR', 'SITE_SUPERVISOR')).toBe(false)
  })
})

describe('canAccessResource', () => {
  it('SUPER_ADMIN accesses any resource', () => {
    expect(
      canAccessResource('SUPER_ADMIN', { site: 's1' }, { assignedSites: [] }),
    ).toBe(true)
  })

  it('OPERATOR only accesses assigned zones', () => {
    expect(
      canAccessResource('OPERATOR', { zone: 'z1' }, { assignedZones: ['z1'] }),
    ).toBe(true)
    expect(
      canAccessResource('OPERATOR', { zone: 'z2' }, { assignedZones: ['z1'] }),
    ).toBe(false)
    expect(
      canAccessResource('OPERATOR', { site: 's1' }, { assignedSites: ['s1'] }),
    ).toBe(false)
  })

  it('SITE_SUPERVISOR accesses own sites and zones', () => {
    expect(
      canAccessResource(
        'SITE_SUPERVISOR',
        { site: 's1' },
        { assignedSites: ['s1'] },
      ),
    ).toBe(true)
    expect(
      canAccessResource(
        'SITE_SUPERVISOR',
        { zone: 'z9' },
        { assignedZones: ['z9'] },
      ),
    ).toBe(true)
  })
})
