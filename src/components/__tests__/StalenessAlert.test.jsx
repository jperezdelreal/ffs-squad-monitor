import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StalenessAlert } from '../StalenessAlert'

describe('StalenessAlert', () => {
  it('renders nothing when heartbeat is fresh', () => {
    const { container } = render(
      <StalenessAlert staleness="fresh" heartbeatAgeMs={30_000} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders stale warning when heartbeat is stale', () => {
    render(<StalenessAlert staleness="stale" heartbeatAgeMs={360_000} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Heartbeat Stale')).toBeInTheDocument()
    expect(screen.getByText('⚠️')).toBeInTheDocument()
  })

  it('renders dead alert when heartbeat is dead', () => {
    render(<StalenessAlert staleness="dead" heartbeatAgeMs={2_400_000} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Heartbeat Dead')).toBeInTheDocument()
    expect(screen.getByText('💀')).toBeInTheDocument()
  })

  it('displays formatted age for stale heartbeat', () => {
    render(<StalenessAlert staleness="stale" heartbeatAgeMs={600_000} />)
    expect(screen.getByText('10m')).toBeInTheDocument()
  })

  it('displays formatted age for dead heartbeat', () => {
    render(<StalenessAlert staleness="dead" heartbeatAgeMs={7_200_000} />)
    expect(screen.getByText('2h')).toBeInTheDocument()
  })

  it('shows descriptive message for stale', () => {
    render(<StalenessAlert staleness="stale" heartbeatAgeMs={600_000} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Monitoring may be delayed')
  })

  it('shows descriptive message for dead', () => {
    render(<StalenessAlert staleness="dead" heartbeatAgeMs={2_400_000} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('scheduler may be stopped')
  })

  it('uses amber styling for stale', () => {
    const { container } = render(
      <StalenessAlert staleness="stale" heartbeatAgeMs={600_000} />
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert.className).toContain('bg-amber-500/10')
  })

  it('uses red styling for dead', () => {
    const { container } = render(
      <StalenessAlert staleness="dead" heartbeatAgeMs={2_400_000} />
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert.className).toContain('bg-red-500/10')
  })

  it('handles null heartbeatAgeMs gracefully', () => {
    render(<StalenessAlert staleness="dead" heartbeatAgeMs={null} />)
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})
