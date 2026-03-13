import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Header } from '../Header'

describe('Header', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the title and subtitle', () => {
    render(<Header lastUpdate={null} isConnected={true} />)
    expect(screen.getByText('Squad Monitor')).toBeInTheDocument()
    expect(screen.getByText('FFS Operations')).toBeInTheDocument()
  })

  it('shows Live when connected', () => {
    render(<Header lastUpdate={Date.now()} isConnected={true} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows Offline when disconnected', () => {
    render(<Header lastUpdate={Date.now()} isConnected={false} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Never when lastUpdate is null', () => {
    render(<Header lastUpdate={null} isConnected={true} />)
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('shows seconds ago for recent updates', () => {
    const thirtySecondsAgo = Date.now() - 30 * 1000
    render(<Header lastUpdate={thirtySecondsAgo} isConnected={true} />)
    expect(screen.getByText('30s ago')).toBeInTheDocument()
  })

  it('shows minutes ago for updates within the hour', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    render(<Header lastUpdate={fiveMinutesAgo} isConnected={true} />)
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('shows hours ago for older updates', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    render(<Header lastUpdate={twoHoursAgo} isConnected={true} />)
    expect(screen.getByText('2h ago')).toBeInTheDocument()
  })

  it('applies connected indicator styling when connected', () => {
    const { container } = render(<Header lastUpdate={Date.now()} isConnected={true} />)
    const dot = container.querySelector('.bg-emerald-500')
    expect(dot).toBeInTheDocument()
  })

  it('applies disconnected indicator styling when offline', () => {
    const { container } = render(<Header lastUpdate={Date.now()} isConnected={false} />)
    const dot = container.querySelector('.bg-red-500')
    expect(dot).toBeInTheDocument()
  })

  it('renders the header element', () => {
    const { container } = render(<Header lastUpdate={null} isConnected={true} />)
    expect(container.querySelector('header')).toBeInTheDocument()
  })
})