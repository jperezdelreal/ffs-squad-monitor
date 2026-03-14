import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PulseDot, DataGlow, CounterAnimation, LiveTimestamp, BreathingBorder, SignalBars } from '../PulseIndicator'

describe('PulseDot', () => {
  it('renders with streaming status', () => {
    render(<PulseDot status="streaming" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Streaming data')
  })

  it('renders with polling status', () => {
    render(<PulseDot status="polling" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Polling for updates')
  })

  it('renders with disconnected status', () => {
    render(<PulseDot status="disconnected" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Disconnected')
  })

  it('shows label when showLabel is true', () => {
    const { container } = render(<PulseDot status="streaming" showLabel={true} />)
    expect(container.textContent).toContain('Live')
  })

  it('applies correct size classes', () => {
    const { container } = render(<PulseDot status="streaming" size="lg" />)
    expect(container.querySelector('.w-3.h-3')).toBeDefined()
  })
})

describe('DataGlow', () => {
  it('renders children', () => {
    render(<DataGlow><div>Test content</div></DataGlow>)
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('applies animation when isActive is true', () => {
    const { container } = render(<DataGlow isActive={true}><div>Glow</div></DataGlow>)
    expect(container.firstChild).toBeInTheDocument()
  })
})

describe('CounterAnimation', () => {
  it('renders initial value', () => {
    const { container } = render(<CounterAnimation value={42} />)
    expect(container.textContent).toBe('42')
  })

  it('animates to new value', async () => {
    const { container, rerender } = render(<CounterAnimation value={10} />)
    expect(container.textContent).toBe('10')
    
    rerender(<CounterAnimation value={20} />)
    
    await waitFor(() => {
      expect(container.textContent).toBe('20')
    }, { timeout: 1000 })
  })

  it('applies custom className', () => {
    const { container } = render(<CounterAnimation value={5} className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('LiveTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders "Never" when timestamp is null', () => {
    render(<LiveTimestamp timestamp={null} />)
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('renders "just now" for recent timestamps', () => {
    const now = Date.now()
    render(<LiveTimestamp timestamp={now - 2000} />)
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('renders seconds ago', () => {
    const now = Date.now()
    render(<LiveTimestamp timestamp={now - 30000} />)
    expect(screen.getByText(/30s ago/)).toBeInTheDocument()
  })

  it('renders minutes ago', () => {
    const now = Date.now()
    render(<LiveTimestamp timestamp={now - 300000} />)
    expect(screen.getByText(/5m ago/)).toBeInTheDocument()
  })

  it('renders hours ago', () => {
    const now = Date.now()
    render(<LiveTimestamp timestamp={now - 7200000} />)
    expect(screen.getByText(/2h ago/)).toBeInTheDocument()
  })

  it('renders days ago', () => {
    const now = Date.now()
    render(<LiveTimestamp timestamp={now - 172800000} />)
    expect(screen.getByText(/2d ago/)).toBeInTheDocument()
  })

  it('includes prefix when provided', () => {
    const now = Date.now()
    render(<LiveTimestamp timestamp={now - 30000} prefix="Updated" />)
    expect(screen.getByText(/Updated 30s ago/)).toBeInTheDocument()
  })
})

describe('BreathingBorder', () => {
  it('renders children', () => {
    render(<BreathingBorder><div>Content</div></BreathingBorder>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies border classes', () => {
    const { container } = render(<BreathingBorder isActive={true}><div>Test</div></BreathingBorder>)
    expect(container.firstChild).toHaveClass('border')
  })
})

describe('SignalBars', () => {
  it('renders three bars', () => {
    const { container } = render(<SignalBars strength={3} />)
    const bars = container.querySelectorAll('.w-1')
    expect(bars).toHaveLength(3)
  })

  it('applies correct aria-label', () => {
    render(<SignalBars strength={2} />)
    expect(screen.getByLabelText('Signal strength: 2/3')).toBeInTheDocument()
  })

  it('shows correct number of active bars', () => {
    const { container } = render(<SignalBars strength={2} />)
    const activeBars = container.querySelectorAll('.bg-emerald-400')
    expect(activeBars).toHaveLength(2)
  })

  it('shows all inactive bars when strength is 0', () => {
    const { container } = render(<SignalBars strength={0} />)
    const inactiveBars = container.querySelectorAll('.bg-gray-600')
    expect(inactiveBars).toHaveLength(3)
  })
})
