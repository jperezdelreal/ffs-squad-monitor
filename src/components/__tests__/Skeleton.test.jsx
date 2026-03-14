import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonFeedItem,
  SkeletonList,
  SkeletonChart,
  SkeletonAgentCard,
  SkeletonGrid,
  SkeletonTimelineBar,
  SkeletonTableRow,
  SkeletonStatCard,
  SkeletonContainer,
} from '../Skeleton'

describe('Skeleton Components', () => {
  describe('Skeleton', () => {
    it('renders with default shimmer animation', () => {
      const { container } = render(<Skeleton />)
      const skeleton = container.firstChild
      expect(skeleton).toHaveClass('animate-shimmer')
      expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    })

    it('renders with pulse animation when shimmer is false', () => {
      const { container } = render(<Skeleton shimmer={false} />)
      expect(container.firstChild).toHaveClass('animate-pulse')
    })

    it('applies variant classes correctly', () => {
      const { container: text } = render(<Skeleton variant="text" />)
      expect(text.firstChild).toHaveClass('h-4')

      const { container: card } = render(<Skeleton variant="card" />)
      expect(card.firstChild).toHaveClass('rounded-xl')

      const { container: circle } = render(<Skeleton variant="circle" />)
      expect(circle.firstChild).toHaveClass('rounded-full')
    })

    it('applies custom className', () => {
      const { container } = render(<Skeleton className="w-full h-24" />)
      expect(container.firstChild).toHaveClass('w-full', 'h-24')
    })
  })

  describe('SkeletonText', () => {
    it('renders single line', () => {
      const { container } = render(<SkeletonText />)
      const skeletons = container.querySelectorAll('[aria-hidden]')
      expect(skeletons).toHaveLength(1)
    })

    it('renders multiple lines', () => {
      const { container } = render(<SkeletonText lines={3} />)
      const skeletons = container.querySelectorAll('[aria-hidden]')
      expect(skeletons).toHaveLength(3)
    })

    it('last line has reduced width', () => {
      const { container } = render(<SkeletonText lines={2} />)
      const lines = container.querySelectorAll('[aria-hidden]')
      expect(lines[1]).toHaveClass('w-3/4')
    })
  })

  describe('SkeletonCard', () => {
    it('renders with default content', () => {
      const { container } = render(<SkeletonCard />)
      expect(container.querySelector('.glass')).toBeInTheDocument()
      const skeletons = container.querySelectorAll('[aria-hidden]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders with custom children', () => {
      render(
        <SkeletonCard>
          <div data-testid="custom-content">Custom</div>
        </SkeletonCard>
      )
      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    })
  })

  describe('SkeletonFeedItem', () => {
    it('renders avatar and text placeholders', () => {
      const { container } = render(<SkeletonFeedItem />)
      const circle = container.querySelector('.rounded-full')
      expect(circle).toBeInTheDocument()
      const skeletons = container.querySelectorAll('[aria-hidden]')
      expect(skeletons.length).toBeGreaterThanOrEqual(3) // circle + 2 text lines
    })
  })

  describe('SkeletonList', () => {
    it('renders default count of items', () => {
      const { container } = render(<SkeletonList />)
      const items = container.querySelectorAll('.space-y-3 > div')
      expect(items).toHaveLength(5)
    })

    it('renders custom count', () => {
      const { container } = render(<SkeletonList count={3} />)
      const items = container.querySelectorAll('.space-y-3 > div')
      expect(items).toHaveLength(3)
    })

    it('renders custom item component', () => {
      const CustomItem = () => <div data-testid="custom-item">Item</div>
      render(<SkeletonList count={2} itemComponent={CustomItem} />)
      expect(screen.getAllByTestId('custom-item')).toHaveLength(2)
    })
  })

  describe('SkeletonChart', () => {
    it('renders chart placeholder with default height', () => {
      const { container } = render(<SkeletonChart />)
      const chart = container.querySelector('.h-64')
      expect(chart).toBeInTheDocument()
    })

    it('renders with custom height', () => {
      const { container } = render(<SkeletonChart height="h-48" />)
      const chart = container.querySelector('.h-48')
      expect(chart).toBeInTheDocument()
    })
  })

  describe('SkeletonAgentCard', () => {
    it('renders agent card structure', () => {
      const { container } = render(<SkeletonAgentCard />)
      const card = container.querySelector('.glass')
      expect(card).toBeInTheDocument()
      const circle = container.querySelector('.rounded-full')
      expect(circle).toBeInTheDocument()
    })
  })

  describe('SkeletonGrid', () => {
    it('renders grid with default dimensions', () => {
      const { container } = render(<SkeletonGrid />)
      const grid = container.querySelector('.grid')
      expect(grid).toBeInTheDocument()
      const items = grid.querySelectorAll(':scope > div')
      expect(items).toHaveLength(8) // 4 cols × 2 rows
    })

    it('renders custom grid dimensions', () => {
      const { container } = render(<SkeletonGrid cols={3} rows={3} />)
      const items = container.querySelectorAll('.grid > div')
      expect(items).toHaveLength(9) // 3 cols × 3 rows
    })

    it('applies correct grid column classes', () => {
      const { container: grid2 } = render(<SkeletonGrid cols={2} />)
      expect(grid2.querySelector('.grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2')

      const { container: grid4 } = render(<SkeletonGrid cols={4} />)
      expect(grid4.querySelector('.grid')).toHaveClass('lg:grid-cols-4')
    })
  })

  describe('SkeletonTimelineBar', () => {
    it('renders timeline bar structure', () => {
      const { container } = render(<SkeletonTimelineBar />)
      const circles = container.querySelectorAll('.rounded-full')
      expect(circles.length).toBeGreaterThan(0)
      const bar = container.querySelector('.h-20')
      expect(bar).toBeInTheDocument()
    })
  })

  describe('SkeletonTableRow', () => {
    it('renders default 4 columns', () => {
      const { container } = render(<SkeletonTableRow />)
      const cols = container.querySelectorAll('.flex > [aria-hidden]')
      expect(cols).toHaveLength(4)
    })

    it('renders custom column count', () => {
      const { container } = render(<SkeletonTableRow cols={6} />)
      const cols = container.querySelectorAll('.flex > [aria-hidden]')
      expect(cols).toHaveLength(6)
    })
  })

  describe('SkeletonStatCard', () => {
    it('renders stat card structure', () => {
      const { container } = render(<SkeletonStatCard />)
      const card = container.querySelector('.glass')
      expect(card).toBeInTheDocument()
      const skeletons = container.querySelectorAll('[aria-hidden]')
      expect(skeletons.length).toBeGreaterThanOrEqual(3) // title + value + description
    })
  })

  describe('SkeletonContainer', () => {
    it('wraps children in glass container', () => {
      render(
        <SkeletonContainer>
          <div data-testid="child">Content</div>
        </SkeletonContainer>
      )
      const container = screen.getByTestId('child').closest('.glass')
      expect(container).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(
        <SkeletonContainer className="custom-class">
          <div>Content</div>
        </SkeletonContainer>
      )
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})
