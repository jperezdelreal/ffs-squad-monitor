import React from 'react';

// Base skeleton with shimmer animation
export function Skeleton({ className = '', variant = 'default', shimmer = true }) {
  const baseClasses = shimmer 
    ? 'bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%] animate-shimmer'
    : 'bg-white/5 animate-pulse';
  
  const variantClasses = {
    default: 'rounded',
    text: 'rounded h-4',
    card: 'rounded-xl',
    circle: 'rounded-full',
    button: 'rounded-lg',
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`}
      aria-hidden="true"
    />
  );
}

// Skeleton for text lines
export function SkeletonText({ lines = 1, className = '', lineClassName = '' }) {
  if (lines === 1) {
    return <Skeleton variant="text" className={className} />;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(lines)].map((_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          className={`${lineClassName} ${i === lines - 1 ? 'w-3/4' : ''}`}
        />
      ))}
    </div>
  );
}

// Skeleton for card containers
export function SkeletonCard({ className = '', children }) {
  return (
    <div className={`glass rounded-xl p-6 ${className}`}>
      {children || (
        <>
          <Skeleton variant="text" className="w-1/4 mb-4 h-6" />
          <SkeletonText lines={3} />
        </>
      )}
    </div>
  );
}

// Skeleton for activity feed items
export function SkeletonFeedItem() {
  return (
    <div className="flex gap-4 animate-fade-in">
      <Skeleton variant="circle" className="w-12 h-12 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2 h-3" />
      </div>
    </div>
  );
}

// Skeleton for list with multiple items
export function SkeletonList({ count = 5, itemComponent: ItemComponent = SkeletonFeedItem, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <ItemComponent key={i} />
      ))}
    </div>
  );
}

// Skeleton for chart placeholders
export function SkeletonChart({ height = 'h-64', className = '' }) {
  return (
    <SkeletonCard className={className}>
      <Skeleton variant="text" className="w-1/3 mb-4 h-6" />
      <Skeleton className={`${height} rounded-lg`} />
    </SkeletonCard>
  );
}

// Skeleton for agent/team cards
export function SkeletonAgentCard() {
  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" className="w-10 h-10" />
        <div className="flex-1">
          <Skeleton variant="text" className="w-1/2 mb-2 h-5" />
          <Skeleton variant="text" className="w-3/4 h-3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton variant="text" className="h-3" />
        <Skeleton variant="text" className="w-2/3 h-3" />
      </div>
    </div>
  );
}

// Skeleton for grid layouts (pipeline, team board)
export function SkeletonGrid({ 
  cols = 4, 
  rows = 2, 
  itemComponent: ItemComponent = () => <Skeleton className="h-40 rounded-xl" />,
  className = '' 
}) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    8: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8',
  };

  return (
    <div className={`grid ${gridCols[cols] || gridCols[4]} gap-4 ${className}`}>
      {[...Array(cols * rows)].map((_, i) => (
        <ItemComponent key={i} />
      ))}
    </div>
  );
}

// Skeleton for timeline/swimlane bars
export function SkeletonTimelineBar() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton variant="circle" className="w-6 h-6" />
        <Skeleton variant="text" className="w-24 h-4" />
      </div>
      <Skeleton className="h-20 rounded-lg" />
    </div>
  );
}

// Skeleton for table rows
export function SkeletonTableRow({ cols = 4 }) {
  return (
    <div className="flex gap-4 py-3 border-b border-white/5">
      {[...Array(cols)].map((_, i) => (
        <Skeleton key={i} variant="text" className={i === 0 ? 'w-1/4' : 'flex-1'} />
      ))}
    </div>
  );
}

// Skeleton for stats/metric cards
export function SkeletonStatCard() {
  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <Skeleton variant="text" className="w-1/2 mb-2 h-4" />
      <Skeleton variant="text" className="w-3/4 h-8 mb-1" />
      <Skeleton variant="text" className="w-full h-3" />
    </div>
  );
}

// Loading container with shimmer effect
export function SkeletonContainer({ children, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="glass rounded-xl p-6 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
