// Shared Framer Motion configuration for consistent animations

export const springPresets = {
  // Smooth, natural spring - good for most transitions
  default: {
    type: 'spring',
    stiffness: 260,
    damping: 20,
  },
  // Snappy, responsive - good for interactive elements
  snappy: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  },
  // Gentle, smooth - good for large movements
  gentle: {
    type: 'spring',
    stiffness: 120,
    damping: 14,
  },
  // Bouncy - good for attention-grabbing animations
  bouncy: {
    type: 'spring',
    stiffness: 300,
    damping: 10,
  },
}

export const durations = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
}

export const easing = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
}

// Common animation variants
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

export const slideInLeft = {
  initial: { opacity: 0, x: -300 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -300 },
}

export const slideInRight = {
  initial: { opacity: 0, x: 300 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 300 },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
}

// Stagger configuration for lists
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

// Layout transition for shared elements
export const layoutTransition = {
  layout: true,
  transition: springPresets.default,
}

// Micro-interactions - hover and tap feedback
export const hoverLift = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2 },
  tap: { scale: 0.98, y: 0 },
}

export const hoverGlow = {
  rest: { boxShadow: '0 0 0 rgba(6, 182, 212, 0)' },
  hover: { boxShadow: '0 8px 24px rgba(6, 182, 212, 0.2)' },
}

export const cardHover = {
  rest: { scale: 1, y: 0, transition: springPresets.snappy },
  hover: { scale: 1.02, y: -4, transition: springPresets.snappy },
  tap: { scale: 0.98, y: 0, transition: springPresets.snappy },
}

export const buttonPress = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
}

export const iconSpin = {
  rest: { rotate: 0 },
  hover: { rotate: 180, transition: { duration: 0.3 } },
}

export const iconBounce = {
  rest: { scale: 1 },
  hover: { scale: 1.2, rotate: [0, -10, 10, -10, 0], transition: springPresets.bouncy },
}

// Ripple effect for interactive elements
export const ripple = {
  initial: { scale: 0, opacity: 0.5 },
  animate: { scale: 2, opacity: 0 },
  transition: { duration: 0.6, ease: 'easeOut' },
}

// Toggle switch animation
export const toggleSwitch = {
  on: { x: 16, transition: springPresets.snappy },
  off: { x: 0, transition: springPresets.snappy },
}

export const toggleBackground = {
  on: { backgroundColor: 'rgb(6, 182, 212)', transition: springPresets.snappy },
  off: { backgroundColor: 'rgb(75, 85, 99)', transition: springPresets.snappy },
}
