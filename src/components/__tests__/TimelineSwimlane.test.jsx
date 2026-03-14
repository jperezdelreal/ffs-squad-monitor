import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TimelineSwimlane } from '../TimelineSwimlane'
import { useStore } from '../../store/store'

const mockAgents = [
  { id: 'ripley', name: 'Ripley', role: 'Lead', emoji: '\u{1F9D1}\u200D\u{1F680}' },
  { id: 'dallas', name: 'Dallas', role: 'Frontend Dev', emoji: '\u{1F468}\u200D\u2708\uFE0F' },
  { id: 'lambert', name: 'Lambert', role: 'Backend Dev', emoji: '\u{1F469}\u200D\u{1F52C}' },
]

const now = Date.now()
const daysAgo = (d) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString()

const mockIssues = [
  {
    number: 10,
    title: 'Build auth module',
    state: 'open',
    labels: ['squad:ripley'],
    createdAt: daysAgo(3),
    url: 'https://github.com/example/repo/issues/10',
    repo: 'example-repo',
  },
  {
    number: 20,
    title: 'Fix blocked pipeline',
    state: 'open',
    labels: ['squad:dallas', 'blocked-by:upstream'],
    createdAt: daysAgo(5),
    url: 'https://github.com/example/repo/issues/20',
    repo: 'example-repo',
  },
  {
    number: 30,
    title: 'Deploy v2 service',
    state: 'closed',
    labels: ['squad:lambert'],
    createdAt: daysAgo(6),
    closedAt: daysAgo(2),
    url: 'https://github.com/example/repo/issues/30',
    repo: 'example-repo',
  },
  {
    number: 40,
    title: 'Ancient issue',
    state: 'closed',
    labels: ['squad:ripley'],
    createdAt: daysAgo(100),
    closedAt: daysAgo(90),
    url: 'https://github.com/example/repo/issues/40',
    repo: 'example-repo',
  },
]

function setStoreState(overrides = {}) {
  useStore.setState({
    issues: mockIssues,
    agents: mockAgents,
    issuesLoading: false,
    agentsLoading: false,
    fetchIssues: vi.fn(),
    fetchAgents: vi.fn(),
    ...overrides,
  })
}

describe('TimelineSwimlane', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state when issues are loading and empty', () => {
    setStoreState({ issues: [], issuesLoading: true })
    render(<TimelineSwimlane />)
    expect(screen.getByTestId('timeline-loading')).toBeInTheDocument()
  })

  it('shows empty state when no agents exist', () => {
    setStoreState({ agents: [] })
    render(<TimelineSwimlane />)
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument()
    expect(screen.getByText('No Timeline Data')).toBeInTheDocument()
  })

  it('renders timeline view with header', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    expect(screen.getByTestId('timeline-view')).toBeInTheDocument()
    expect(screen.getByText('Timeline Swimlane')).toBeInTheDocument()
    expect(screen.getByText('Gantt-style agent activity over time')).toBeInTheDocument()
  })

  it('renders one swimlane row per agent', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    expect(screen.getByTestId('swimlane-ripley')).toBeInTheDocument()
    expect(screen.getByTestId('swimlane-dallas')).toBeInTheDocument()
    expect(screen.getByTestId('swimlane-lambert')).toBeInTheDocument()
  })

  it('renders agent names and roles in swimlane labels', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    expect(screen.getAllByText('Ripley').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Dallas').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Lambert').length).toBeGreaterThanOrEqual(1)
  })

  it('renders status legend', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })

  it('renders all time range buttons', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    expect(screen.getByText('Last 24h')).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.getByText('Last 14 days')).toBeInTheDocument()
  })

  it('switches time range on button click', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    const btn24h = screen.getByText('Last 24h')
    fireEvent.click(btn24h)
    expect(btn24h.closest('button').className).toContain('bg-cyan-500')
  })

  it('shows task bars for issues with squad labels', () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).toContain('#10')
    expect(container.textContent).toContain('Build auth module')
  })

  it('filters out issues entirely outside time range', () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).not.toContain('#40')
    expect(container.textContent).not.toContain('Ancient issue')
  })

  it('shows blocked task with blocked status', () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).toContain('Fix blocked pipeline')
  })

  it('shows completed task for closed issues', () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).toContain('Deploy v2 service')
  })

  it('hides agent swimlane when toggled off', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    const filterButtons = screen.getAllByRole('button').filter(
      btn => btn.className.includes('rounded-full') && btn.textContent.includes('Ripley')
    )
    expect(filterButtons.length).toBeGreaterThan(0)
    fireEvent.click(filterButtons[0])
    expect(screen.queryByTestId('swimlane-ripley')).not.toBeInTheDocument()
  })

  it('shows re-enabled agent after toggle on', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    const filterButtons = screen.getAllByRole('button').filter(
      btn => btn.className.includes('rounded-full') && btn.textContent.includes('Ripley')
    )
    fireEvent.click(filterButtons[0])
    expect(screen.queryByTestId('swimlane-ripley')).not.toBeInTheDocument()
    fireEvent.click(filterButtons[0])
    expect(screen.getByTestId('swimlane-ripley')).toBeInTheDocument()
  })

  it('shows message when all agents filtered', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    mockAgents.forEach(a => {
      const btns = screen.getAllByRole('button').filter(
        btn => btn.className.includes('rounded-full') && btn.textContent.includes(a.name)
      )
      if (btns.length) fireEvent.click(btns[0])
    })
    expect(screen.getByTestId('timeline-no-agents')).toBeInTheDocument()
  })

  it('shows zoom controls', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument()
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('zooms in on button click', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    fireEvent.click(screen.getByTitle('Zoom in'))
    expect(screen.getByText('125%')).toBeInTheDocument()
  })

  it('zooms out on button click', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    fireEvent.click(screen.getByTitle('Zoom out'))
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('clamps zoom to minimum 50%', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByTitle('Zoom out'))
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('clamps zoom to maximum 400%', () => {
    setStoreState()
    render(<TimelineSwimlane />)
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByTitle('Zoom in'))
    expect(screen.getByText('400%')).toBeInTheDocument()
  })

  it('shows task count summary', () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).toMatch(/\d+ tasks? across \d+ agents?/)
  })

  it('shows zoom/pan hint', () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).toContain('Ctrl+Scroll to zoom')
  })

  it('calls fetchIssues when issues are empty', () => {
    const fetchIssues = vi.fn()
    const fetchAgents = vi.fn()
    setStoreState({ issues: [], fetchIssues, fetchAgents })
    render(<TimelineSwimlane />)
    expect(fetchIssues).toHaveBeenCalled()
  })

  it('calls fetchAgents when agents are empty', () => {
    const fetchIssues = vi.fn()
    const fetchAgents = vi.fn()
    setStoreState({ agents: [], fetchIssues, fetchAgents })
    render(<TimelineSwimlane />)
    expect(fetchAgents).toHaveBeenCalled()
  })

  it('does not call fetchIssues when issues already loaded', () => {
    const fetchIssues = vi.fn()
    setStoreState({ fetchIssues })
    render(<TimelineSwimlane />)
    expect(fetchIssues).not.toHaveBeenCalled()
  })

  it('shows tooltip on task bar hover', async () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    const taskBars = container.querySelectorAll('.rounded-md.cursor-pointer')
    expect(taskBars.length).toBeGreaterThan(0)

    fireEvent.mouseEnter(taskBars[0])
    await waitFor(() => {
      const tooltipContent = container.querySelector('.fixed.z-50')
      expect(tooltipContent).not.toBeNull()
    })
  })

  it('hides tooltip on mouse leave', async () => {
    setStoreState()
    const { container } = render(<TimelineSwimlane />)
    const taskBars = container.querySelectorAll('.rounded-md.cursor-pointer')
    if (taskBars.length > 0) {
      fireEvent.mouseEnter(taskBars[0])
      await waitFor(() => {
        expect(container.querySelector('.fixed.z-50')).not.toBeNull()
      })
      fireEvent.mouseLeave(taskBars[0])
      await waitFor(() => {
        expect(container.querySelector('.fixed.z-50')).toBeNull()
      })
    }
  })

  it('opens GitHub URL on task bar click', () => {
    setStoreState()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = render(<TimelineSwimlane />)
    const taskBars = container.querySelectorAll('.rounded-md.cursor-pointer')
    if (taskBars.length > 0) {
      fireEvent.click(taskBars[0])
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('github.com'),
        '_blank',
        'noopener',
      )
    }
    openSpy.mockRestore()
  })

  it('shows no activity message for agent with no tasks in range', () => {
    setStoreState({ issues: [mockIssues[0]] })
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).toContain('No activity in this period')
  })

  it('ignores issues without squad labels', () => {
    setStoreState({
      issues: [
        { number: 99, title: 'Unlabeled issue', state: 'open', labels: [], createdAt: daysAgo(1) },
      ],
    })
    const { container } = render(<TimelineSwimlane />)
    expect(container.textContent).not.toContain('Unlabeled issue')
  })
})
