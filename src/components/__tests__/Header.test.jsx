import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Header } from '../Header'
import { HEALTH_LEVELS } from '../../lib/health'

// Mock ViewerCount and ActivityIndicator to avoid SSE/EventSource in tests
vi.mock('../ViewerCount', () => ({
  ViewerCount: () => null,
}))
vi.mock('../ActivityIndicator', () => ({
  ActivityIndicator: () => null,
}))

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

  it('shows Streaming when sseStatus is streaming', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="streaming" {...defaultHealthProps} />)
    expect(screen.getByText('Streaming')).toBeInTheDocument()
  })

  it('shows Offline when sseStatus is disconnected', () => {
    render(<Header lastUpdate={Date.now()} isConnected={false} sseStatus="disconnected" {...defaultHealthProps} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Polling when sseStatus is polling', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="polling" {...defaultHealthProps} />)
    expect(screen.getByText('Polling')).toBeInTheDocument()
  })

  it('shows Reconnecting when sseStatus is reconnecting', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="reconnecting" {...defaultHealthProps} />)
    expect(screen.getByText('Reconnecting\u2026')).toBeInTheDocument()
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

  it('renders connection status with correct aria-label for streaming', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="streaming" {...defaultHealthProps} />)
    expect(screen.getByTestId('connection-status')).toHaveAttribute('aria-label', 'Connection status: Streaming')
  })

  it('renders connection status with correct aria-label for disconnected', () => {
    render(<Header lastUpdate={Date.now()} isConnected={false} sseStatus="disconnected" {...defaultHealthProps} />)
    expect(screen.getByTestId('connection-status')).toHaveAttribute('aria-label', 'Connection status: Offline')
  })

  it('calls onSSEReconnect when clicking non-streaming status', () => {
    const onSSEReconnect = vi.fn()
    render(<Header lastUpdate={Date.now()} isConnected={false} sseStatus="disconnected" onSSEReconnect={onSSEReconnect} {...defaultHealthProps} />)
    fireEvent.click(screen.getByTestId('connection-status'))
    expect(onSSEReconnect).toHaveBeenCalledTimes(1)
  })

  it('does not call onSSEReconnect when clicking streaming status', () => {
    const onSSEReconnect = vi.fn()
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="streaming" onSSEReconnect={onSSEReconnect} {...defaultHealthProps} />)
    fireEvent.click(screen.getByTestId('connection-status'))
    expect(onSSEReconnect).not.toHaveBeenCalled()
  })

  it('renders the header element', () => {
    const { container } = render(<Header lastUpdate={null} isConnected={true} {...defaultHealthProps} />)
    expect(container.querySelector('header')).toBeInTheDocument()
  })

  it('renders health badge with score', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByText('85')).toBeInTheDocument()
  })

  it('renders health badge with accessible label', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} {...defaultHealthProps} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows double-dot icon when streaming', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="streaming" {...defaultHealthProps} />)
    expect(screen.getByTestId('icon-double-dot')).toBeInTheDocument()
  })

  it('shows spin icon when reconnecting', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="reconnecting" {...defaultHealthProps} />)
    expect(screen.getByTestId('icon-spin')).toBeInTheDocument()
  })

  it('shows single-dot icon when polling', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="polling" {...defaultHealthProps} />)
    expect(screen.getByTestId('icon-single-dot')).toBeInTheDocument()
  })

  it('shows hollow-dot icon when disconnected', () => {
    render(<Header lastUpdate={Date.now()} isConnected={false} sseStatus="disconnected" {...defaultHealthProps} />)
    expect(screen.getByTestId('icon-hollow-dot')).toBeInTheDocument()
  })

  it('shows tooltip on hover with connection details', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} sseStatus="streaming" {...defaultHealthProps} />)
    fireEvent.mouseEnter(screen.getByTestId('connection-status'))
    expect(screen.getByText('Connection Details')).toBeInTheDocument()
    expect(screen.getByText('Mode')).toBeInTheDocument()
    expect(screen.getByText('SSE')).toBeInTheDocument()
  })

  it('defaults to Offline when sseStatus is undefined', () => {
    render(<Header lastUpdate={null} isConnected={false} {...defaultHealthProps} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })
})
