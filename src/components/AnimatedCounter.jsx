import { useEffect, useRef } from 'react'
import { animate } from 'framer-motion'

export function AnimatedCounter({ value, duration = 0.5, className = '' }) {
  const nodeRef = useRef(null)
  const prevValue = useRef(value)

  useEffect(() => {
    const node = nodeRef.current
    if (!node || value === prevValue.current) return

    const controls = animate(prevValue.current, value, {
      duration,
      onUpdate: (latest) => {
        node.textContent = Math.round(latest).toLocaleString()
      },
    })

    prevValue.current = value

    return () => controls.stop()
  }, [value, duration])

  return <span ref={nodeRef} className={className}>{value.toLocaleString()}</span>
}
