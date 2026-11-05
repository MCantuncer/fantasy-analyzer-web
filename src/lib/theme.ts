export type Theme = 'dark' | 'light'

const KEY = 'theme'

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// The phone browser's own bar takes this color, so it matches the top bar in each theme.
const BAR_COLOR: Record<Theme, string> = { dark: '#141210', light: '#f4f1ea' }

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme])
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // storage unavailable; the choice lasts for this page view only
  }
}
