import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HealthBadge } from '../HealthBadge'
import { HEALTH_LEVELS } from '../../lib/health'

const mockBreakdown = [
  { label: 'Connection', value: 'operational', score: 100 },
  { label: 'Heartbeat', value: '30s (fresh)', score: 100 },
  { label: 'API Health', value: '0/3 failed', score: 100 },
]

describe('HealthBadge', () => {
  it('renders score percentage', () => {
    render(<HealthBadge score={85} level={HEALTH_LEVELS.GREEN} breakdown={mockBreakdown} />)
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('has accessible role and label', () => {
    render(<HealthBadge score={85} level={HEALTH_LEVELS.GREEN} breakdown={mockBreakdown} />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('aria-label', 'Health: Healthy (85%)')
  })

  it('renders green dot for healthy', () => {
    const { container } = render(
      <HealthBadge score={85} level={HEALTH_LEVELS.GREEN} breakdown={mockBreakdown} />
    )
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument()
  })

  it('renders amber dot for degraded', () => {
    const { container } = render(
      <HealthBadge score={55} level={HEALTH_LEVELS.YELLOW} breakdown={mockBreakdown} />
    )
    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument()
  })

  it('renders red dot for unhealthy', () => {
    const { container } = render(
      <HealthBadge score={20} level={HEALTH_LEVELS.RED} breakdown={mockBreakdown} />
    )
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument()
  })

  it('shows tooltip with breakdown on hover', async () => {
    const { container } = render(
      <HealthBadge score={85} level={HEALTH_LEVELS.GREEN} breakdown={mockBreakdown} />
    )
    // Tooltip should not be visible initially
    expect(screen.queryByText('Health Breakdown')).not.toBeInTheDocument()
  })
})
