import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PipelineVisualizer } from '../PipelineVisualizer'

const mockIssues = [
  {
    number: 1,
    title: 'GDD for game',
    state: 'open',
    repoGithub: 'jperezdelreal/GameRepo',
    labels: ['pipeline:gdd'],
    url: 'https://github.com/jperezdelreal/GameRepo/issues/1',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    number: 2,
    title: 'Implement gameplay',
    state: 'open',
    repoGithub: 'jperezdelreal/GameRepo',
    labels: ['pipeline:code'],
    url: 'https://github.com/jperezdelreal/GameRepo/issues/2',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    number: 3,
    title: 'Deploy pipeline',
    state: 'closed',
    repoGithub: 'jperezdelreal/GameRepo',
    labels: ['pipeline:deploy'],
    url: 'https://github.com/jperezdelreal/GameRepo/issues/3',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    number: 4,
    title: 'Blocked build',
    state: 'open',
    repoGithub: 'jperezdelreal/GameRepo',
    labels: ['pipeline:build', 'blocked-by:deps'],
    url: 'https://github.com/jperezdelreal/GameRepo/issues/4',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    number: 5,
    title: 'Proposal for second repo',
    state: 'closed',
    repoGithub: 'jperezdelreal/SecondRepo',
    labels: ['pipeline:proposal'],
    url: 'https://github.com/jperezdelreal/SecondRepo/issues/5',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

function makeBottleneckIssues(count) {
  return Array.from({ length: count }, (_, i) => ({
    number: 100 + i,
    title: 'Bottleneck issue ' + (i + 1),
    state: 'open',
    repoGithub: 'jperezdelreal/BottleneckRepo',
    labels: ['pipeline:code'],
    url: 'https://github.com/jperezdelreal/BottleneckRepo/issues/' + (100 + i),
    createdAt: '2026-03-' + String(10 + i).padStart(2, '0') + 'T10:00:00Z',
  }))
}

describe('PipelineVisualizer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = render(<PipelineVisualizer />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders pipeline grid after loading', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('Pipeline Status')).toBeInTheDocument()
    })
    expect(screen.getByText('2 repositories tracked')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('fail')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })
    expect(screen.getByText('Failed to fetch issues data')).toBeInTheDocument()
  })

  it('shows error on non-ok response', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
    })
  })

  it('retries on error when Retry button is clicked', async () => {
    let callCount = 0
    global.fetch = vi.fn(() => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('fail'))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry'))
    await waitFor(() => {
      expect(screen.getByText('Pipeline Status')).toBeInTheDocument()
    })
  })

  it('renders stage headers', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('Proposal')).toBeInTheDocument()
    })
    expect(screen.getByText('GDD')).toBeInTheDocument()
    expect(screen.getByText('Issues')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('Build')).toBeInTheDocument()
    expect(screen.getByText('Deploy')).toBeInTheDocument()
  })

  it('renders repos as rows', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('GameRepo')).toBeInTheDocument()
    })
    expect(screen.getByText('SecondRepo')).toBeInTheDocument()
  })

  it('shows empty pipeline state when no issues returned', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('No Pipeline Data')).toBeInTheDocument()
    })
  })

  it('opens modal when a pipeline cell is clicked', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('GameRepo')).toBeInTheDocument()
    })

    // Click a status cell — find one with the in-progress icon
    const inProgressIcons = screen.getAllByText('⚡')
    fireEvent.click(inProgressIcons[0])

    await waitFor(() => {
      expect(screen.getByText('×')).toBeInTheDocument()
    })
  })

  it('closes modal when close button is clicked', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('GameRepo')).toBeInTheDocument()
    })

    const inProgressIcons = screen.getAllByText('⚡')
    fireEvent.click(inProgressIcons[0])

    await waitFor(() => {
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('×'))
    await waitFor(() => {
      expect(screen.queryByText('×')).not.toBeInTheDocument()
    })
  })

  it('closes modal when backdrop is clicked', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    const { container } = render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('GameRepo')).toBeInTheDocument()
    })

    const inProgressIcons = screen.getAllByText('⚡')
    fireEvent.click(inProgressIcons[0])

    await waitFor(() => {
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    const backdrop = container.querySelector('.fixed.inset-0')
    fireEvent.click(backdrop)
    await waitFor(() => {
      expect(screen.queryByText('×')).not.toBeInTheDocument()
    })
  })

  it('renders refresh button and reloads', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('Pipeline Status')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Refresh'))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('renders legend items', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })

  it('handles issues without repoGithub using fallback repo', async () => {
    const issueMissingRepo = [{
      number: 99,
      title: 'No repo field',
      state: 'open',
      repo: 'fallback',
      labels: ['pipeline:proposal'],
      url: 'https://example.com',
    }]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(issueMissingRepo),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('fallback')).toBeInTheDocument()
    })
  })

  it('shows status icons for different statuses', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockIssues),
      })
    )

    render(<PipelineVisualizer />)
    await waitFor(() => {
      expect(screen.getByText('GameRepo')).toBeInTheDocument()
    })

    // Verify different status icons are rendered
    expect(screen.getAllByText('⏸️').length).toBeGreaterThan(0) // pending stages
    expect(screen.getAllByText('⚡').length).toBeGreaterThan(0) // in-progress stages
    expect(screen.getAllByText('✅').length).toBeGreaterThan(0) // complete stages
    expect(screen.getAllByText('🚫').length).toBeGreaterThan(0) // blocked stages
  })

  it('shows bottleneck indicator when 5+ open issues in a stage', async () => {
    const bottleneckData = makeBottleneckIssues(6)
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(bottleneckData) }))
    const { container } = render(<PipelineVisualizer />)
    await waitFor(() => { expect(screen.getByText('BottleneckRepo')).toBeInTheDocument() })
    expect(container.textContent).toMatch(/STUCK/)
  })

  it('does not show bottleneck for fewer than 5 open issues', async () => {
    const fewIssues = makeBottleneckIssues(4)
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fewIssues) }))
    render(<PipelineVisualizer />)
    await waitFor(() => { expect(screen.getByText('BottleneckRepo')).toBeInTheDocument() })
    expect(screen.queryByText('STUCK')).not.toBeInTheDocument()
  })

  it('shows average time in stage for open issues', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockIssues) }))
    const { container } = render(<PipelineVisualizer />)
    await waitFor(() => { expect(screen.getByText('GameRepo')).toBeInTheDocument() })
    expect(container.textContent).toMatch(/avg \d+[dh]/)
  })

  it('shows bottleneck legend entry', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockIssues) }))
    const { container } = render(<PipelineVisualizer />)
    await waitFor(() => { expect(screen.getByText('Pipeline Status')).toBeInTheDocument() })
    expect(container.textContent).toMatch(/Bottleneck/)
  })

  it('shows bottleneck info in modal when bottleneck cell clicked', async () => {
    const bottleneckData = makeBottleneckIssues(6)
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(bottleneckData) }))
    const { container } = render(<PipelineVisualizer />)
    await waitFor(() => { expect(screen.getByText('BottleneckRepo')).toBeInTheDocument() })
    const stuckBadge = screen.getByText('STUCK')
    fireEvent.click(stuckBadge.closest('[class*="cursor-pointer"]'))
    await waitFor(() => { expect(container.textContent).toMatch(/6 issues accumulated/) })
    expect(container.textContent).toMatch(/Avg time in stage/)
  })

})
