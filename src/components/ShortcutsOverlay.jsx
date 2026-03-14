import { useEffect, useRef } from 'react'

export function ShortcutsOverlay({ isOpen, onClose, shortcuts }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Handle Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Handle click outside
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setTimeout(() => onClose(), 50)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {})

  const categoryOrder = ['Views', 'Navigation', 'Actions', 'Help']

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl glass-lg depth-floating border border-white/10 backdrop-blur-xl rounded-lg shadow-2xl"
        style={{
          animation: 'fadeInScale 250ms ease-out',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <style>
          {`
            @keyframes fadeInScale {
              from {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
              }
            }
          `}
        </style>

        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 id="shortcuts-title" className="text-xl font-semibold text-white">
            ⌨️ Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors text-2xl leading-none p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {categoryOrder.map((category) => {
            const items = groupedShortcuts[category]
            if (!items) return null

            return (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/5 transition-colors"
                    >
                      <span className="text-white/80">{shortcut.description}</span>
                      <kbd className="px-3 py-1.5 text-sm font-mono bg-black/30 border border-white/20 rounded shadow-sm text-white/90">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-6 border-t border-white/10 text-sm text-white/50 text-center">
          Press <kbd className="px-2 py-1 text-xs font-mono bg-black/30 border border-white/20 rounded">?</kbd> to toggle this overlay
        </div>
      </div>
    </>
  )
}
