const STORAGE_KEY = 'quiniela-theme'

export type Theme = 'dark' | 'light'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('theme-light', theme === 'light')
}

// se llama una vez, lo antes posible (antes del primer render), para que no
// haya un parpadeo mostrando el tema equivocado un instante
export function initTheme() {
  applyTheme(getStoredTheme())
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}
