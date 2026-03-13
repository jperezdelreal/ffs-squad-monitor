import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Header } from '../Header'
import { HEALTH_LEVELS } from '../../lib/health'

const defaultHealthProps = {
  healthScore: 85,
  healthLevel: HEALTH_LEVELS.GREEN,
  healthBreakdown: [
    { label: 'Connection', value: 'operational', score: 100 },
    { label: 'Heartbeat', value: '30s (fresh)', score: 100 },
    { label: 'API Health', value: '0/3 failed', score: 100 },
  ],
}

describe('Header', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the title and subtitle', () => {
    render(<Header lastUpdate={null} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('Squad Monitor')).toBeInTheDocument()
    expect(screen.getByText('FFS Operations')).toBeInTheDocument()
  })

  it('shows Live when connected', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows Offline when disconnected', () => {
    render(<Header lastUpdate={Date.now()} isConnected={false} {...defaultHealthProps} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Never when lastUpdate is null', () => {
    render(<Header lastUpdate={null} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('shows seconds ago for recent updates', () => {
    const thirtySecondsAgo = Date.now() - 30 * 1000
    render(<Header lastUpdate={thirtySecondsAgo} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('30s ago')).toBeInTheDocument()
  })

  it('shows minutes ago for updates within the hour', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    render(<Header lastUpdate={fiveMinutesAgo} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('shows hours ago for older updates', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    render(<Header lastUpdate={twoHoursAgo} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('2h ago')).toBeInTheDocument()
  })

  it('applies connected indicator styling when connected', () => {
    const { container } = render(<Header lastUpdate={Date.now()} isConnected={true} {...defaultHealthProps} />)
    const dot = container.querySelector('.bg-emerald-500')
    expect(dot).toBeInTheDocument()
  })

  it('applies disconnected indicator styling when offline', () => {
    const { container } = render(<Header lastUpdate={Date.now()} isConnected={false} {...defaultHealthProps} />)
    const dot = container.querySelector('.bg-red-500')
    expect(dot).toBeInTheDocument()
  })

  it('renders the header element', () => {
    const { container } = render(<Header lastUpdate={null} isConnected={true} {...defaultHealthProps} />)
    expect(container.querySelector('header')).toBeInTheDocument()
  })

  it('renders health badge with score', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('renders health badge with accessible label', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})