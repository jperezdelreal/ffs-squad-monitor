import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from '../Sidebar'

describe('Sidebar', () => {
  const defaultProps = {
    activeView: 'activity',
    onViewChange: vi.fn(),
  }

  it('renders all navigation items', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('Activity Feed')).toBeInTheDocument()
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Team Board')).toBeInTheDocument()
    expect(screen.getByText('Cost Tracker')).toBeInTheDocument()
  })

  it('renders the FFS Monitor branding', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('FFS Monitor')).toBeInTheDocument()
    expect(screen.getByText('First Frame Studios')).toBeInTheDocument()
  })

  it('renders the version footer', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument()
  })

  it('highlights the active view', () => {
    const { container } = render(<Sidebar activeView="pipeline" onViewChange={vi.fn()} />)
    const buttons = container.querySelectorAll('button')
    const pipelineBtn = Array.from(buttons).find(b => b.textContent.includes('Pipeline'))
    expect(pipelineBtn.className).toContain('from-cyan-500/20')
  })

  it('calls onViewChange when a nav item is clicked', () => {
    const onViewChange = vi.fn()
    render(<Sidebar activeView="activity" onViewChange={onViewChange} />)

    fireEvent.click(screen.getByText('Pipeline'))
    expect(onViewChange).toHaveBeenCalledWith('pipeline')

    fireEvent.click(screen.getByText('Team Board'))
    expect(onViewChange).toHaveBeenCalledWith('team')

    fireEvent.click(screen.getByText('Cost Tracker'))
    expect(onViewChange).toHaveBeenCalledWith('cost')
  })

  it('renders nav item icons', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('📊')).toBeInTheDocument()
    expect(screen.getByText('🔄')).toBeInTheDocument()
    expect(screen.getByText('👥')).toBeInTheDocument()
    expect(screen.getByText('💰')).toBeInTheDocument()
  })

  it('renders the aside element', () => {
    const { container } = render(<Sidebar {...defaultProps} />)
    expect(container.querySelector('aside')).toBeInTheDocument()
  })

  it('does not highlight inactive views', () => {
    const { container } = render(<Sidebar activeView="activity" onViewChange={vi.fn()} />)
    const buttons = container.querySelectorAll('button')
    const teamBtn = Array.from(buttons).find(b => b.textContent.includes('Team Board'))
    expect(teamBtn.className).not.toContain('from-cyan-500/20')
  })
})