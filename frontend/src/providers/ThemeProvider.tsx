import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getStoredPreferences,
  updateStoredPreferences,
} from '@/lib/preferencesStorage'
import type { ThemePreference } from '@/types/preferences'

type ThemeContextValue = {
  theme: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setThemePreference: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

const getInitialTheme = (): ThemePreference => {
  return getStoredPreferences().theme
}

const applyTheme = (theme: ThemePreference) => {
  if (typeof document === 'undefined') return
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.dataset.theme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(() => getInitialTheme())
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? getSystemTheme() : theme
  )

  useEffect(() => {
    applyTheme(theme)
    setResolvedTheme(theme === 'system' ? getSystemTheme() : theme)
    updateStoredPreferences({ theme })
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') {
      return
    }
    const matcher = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyTheme('system')
      setResolvedTheme(getSystemTheme())
    }
    matcher.addEventListener('change', handler)
    return () => matcher.removeEventListener('change', handler)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setThemePreference: setTheme,
    }),
    [theme, resolvedTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemePreference() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemePreference must be used within ThemeProvider')
  }
  return context
}
