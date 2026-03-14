import React, { useState, useRef, useEffect } from 'react'

export function ExportButton({ endpoint, label = 'Export' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function download(format) {
    const sep = endpoint.includes('?') ? '&' : '?'
    window.open(`${endpoint}${sep}format=${format}`, '_blank')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-2 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium border border-white/10 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title={label}
        aria-label={`${label} - Open export menu`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {label}
      </button>
      {open && (
        <div 
          className="absolute right-0 mt-1 w-40 rounded-lg bg-gray-800 border border-white/10 shadow-xl z-50 overflow-hidden"
          role="menu"
          aria-label="Export format options"
        >
          <button
            onClick={() => download('csv')}
            className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
            role="menuitem"
          >
            Export as CSV
          </button>
          <button
            onClick={() => download('json')}
            className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
            role="menuitem"
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  )
}
