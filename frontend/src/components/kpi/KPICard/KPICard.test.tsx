import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KPICard } from './KPICard'

describe('<KPICard />', () => {
  it('renders TD KPI with warning status', () => {
    render(
      <KPICard
        label="Taux de Dépassement"
        sublabel="TD — mars 2026"
        value={4.2}
        unit="%"
        target={2}
        type="TD"
        delta={0.8}
        status="warning"
      />,
    )

    expect(screen.getByText('Taux de Dépassement')).toBeInTheDocument()
    expect(screen.getByText(/4,?\.?2/)).toBeInTheDocument()
    expect(screen.getByText(/cible ≤/)).toBeInTheDocument()
  })

  it('renders IPE KPI with /100 suffix', () => {
    render(
      <KPICard
        label="IPE"
        value={96.8}
        target={95}
        type="IPE"
        status="success"
      />,
    )

    expect(screen.getByText('/100')).toBeInTheDocument()
    // Success checkmark is appended inline with target
    expect(screen.getByText(/cible ≥/)).toBeInTheDocument()
  })

  it('exposes aria-label for screen readers', () => {
    render(<KPICard label="RCO₂" value={-6} unit="%" type="RCO2" status="success" />)
    expect(screen.getByRole('group', { name: /RCO₂/ })).toBeInTheDocument()
  })
})
