import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'ffs-squad-monitor-theme'

function getSystemPreference() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // localStorage unavailable
  }
  return 'dark'
}

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.add('light')
    root.classList.remove('dark')
  }
  
  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.content = theme === 'dark' ? '#050810' : '#fafbfc'
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme)
  const userExplicitlySet = useRef(false)

  useEffect(() => {
    // Enable transitions after initial load
    setTimeout(() => {
      document.documentElement.classList.remove('no-transitions')
    }, 100)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (userExplicitlySet.current) {
      try {
        localStorage.setItem(STORAGE_KEY, theme)
      } catch {
        // localStorage unavailable
      }
    }
  }, [theme])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        setThemeState(e.matches ? 'dark' : 'light')
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    userExplicitlySet.current = true
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      userExplicitlySet.current = true
      setThemeState(newTheme)
    }
  }, [])

  return { theme, toggleTheme, setTheme }
}
