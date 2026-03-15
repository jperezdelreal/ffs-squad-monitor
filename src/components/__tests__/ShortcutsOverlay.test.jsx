import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShortcutsOverlay } from '../ShortcutsOverlay'

describe('ShortcutsOverlay', () => {
  const mockShortcuts = [
    { key: '/', description: 'Focus search', category: 'Navigation' },
    { key: 'r', description: 'Refresh data', category: 'Actions' },
    { key: '?', description: 'Show shortcuts', category: 'Help' },
  ]

  it('renders nothing when closed', () => {
    const { container } = render(
      <ShortcutsOverlay isOpen={false} onClose={vi.fn()} shortcuts={mockShortcuts} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders shortcuts when open', () => {
    render(
      <ShortcutsOverlay isOpen={true} onClose={vi.fn()} shortcuts={mockShortcuts} />
    )
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Keyboard Shortcuts/)).toBeInTheDocument()
    expect(screen.getByText('Focus search')).toBeInTheDocument()
    expect(screen.getByText('Refresh data')).toBeInTheDocument()
  })

  it('displays keyboard shortcuts grouped by category', () => {
    render(
      <ShortcutsOverlay isOpen={true} onClose={vi.fn()} shortcuts={mockShortcuts} />
    )
    
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByText('Help')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(
      <ShortcutsOverlay isOpen={true} onClose={onClose} shortcuts={mockShortcuts} />
    )
    
    const closeButton = screen.getByLabelText('Close keyboard shortcuts')
    fireEvent.click(closeButton)
    
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn()
    render(
      <ShortcutsOverlay isOpen={true} onClose={onClose} shortcuts={mockShortcuts} />
    )
    
    fireEvent.keyDown(window, { key: 'Escape' })
    
    expect(onClose).toHaveBeenCalled()
  })

  it('has proper ARIA attributes', () => {
    render(
      <ShortcutsOverlay isOpen={true} onClose={vi.fn()} shortcuts={mockShortcuts} />
    )
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'shortcuts-title')
  })

  it('displays keyboard keys in kbd elements', () => {
    render(
      <ShortcutsOverlay isOpen={true} onClose={vi.fn()} shortcuts={mockShortcuts} />
    )
    
    const kbdElements = screen.getAllByText((content, element) => element.tagName === 'KBD')
    expect(kbdElements.length).toBeGreaterThan(0)
  })
})
