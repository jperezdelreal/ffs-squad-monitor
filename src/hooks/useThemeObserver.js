import { useEffect, useState } from 'react'

export function useThemeObserver() {
  const [theme, setTheme] = useState(
    document.documentElement.classList.contains('light') ? 'light' : 'dark'
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.classList.contains('light') ? 'light' : 'dark'
      setTheme(newTheme)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return theme
}
