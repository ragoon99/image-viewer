export const THEME_STORAGE_KEY = 'theme'

export const isTheme = (value) => value === 'light' || value === 'dark'

/**
 * Resolve the theme to use on first paint: an explicit stored choice wins,
 * otherwise follow the operating system preference.
 */
export const resolveInitialTheme = ({ storage, prefersDark = false } = {}) => {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY)
    if (isTheme(stored)) return stored
  } catch {
    // Storage may be unavailable; fall through to the system preference.
  }
  return prefersDark ? 'dark' : 'light'
}

/**
 * Read the browser's stored preference safely and combine it with the current
 * system setting. Never throws when storage or matchMedia is unavailable.
 */
export const detectInitialTheme = () => {
  let storage
  let prefersDark = false

  try {
    storage = globalThis.localStorage
  } catch {
    // Storage access can throw in restricted browsing modes.
  }

  try {
    prefersDark = Boolean(globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches)
  } catch {
    // matchMedia is optional outside the browser.
  }

  return resolveInitialTheme({ storage, prefersDark })
}
