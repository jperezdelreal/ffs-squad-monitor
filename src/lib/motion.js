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
