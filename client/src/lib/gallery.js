export const DEFAULT_COLUMNS = 6
export const MIN_COLUMNS = 4
export const MAX_COLUMNS = 10

export const isValidColumnCount = (value) =>
  Number.isInteger(value) && value >= MIN_COLUMNS && value <= MAX_COLUMNS

/**
 * Read the recent directories list without ever throwing on corrupted or
 * unavailable localStorage data.
 */
export const readStoredRecentDirs = (storage) => {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage
    const parsed = JSON.parse(store?.getItem('recentDirs') || '[]')
    return Array.isArray(parsed)
      ? parsed.filter(dir => typeof dir === 'string' && dir.trim() !== '')
      : []
  } catch {
    return []
  }
}

/**
 * Parse a persisted grid-density value, falling back to the default when it
 * is missing, malformed, or out of the supported range.
 */
export const parseColumnCount = (raw) => {
  const parsed = typeof raw === 'number' ? raw : parseInt(raw, 10)
  return isValidColumnCount(parsed) ? parsed : DEFAULT_COLUMNS
}

/**
 * Append a page of images while guaranteeing each path appears only once.
 */
export const mergeUniqueImages = (existing, incoming) => {
  const seen = new Set()
  return [...existing, ...incoming].filter(img => {
    if (!img || seen.has(img.path)) return false
    seen.add(img.path)
    return true
  })
}

export const getParentFolder = (filePath) => {
  const parts = String(filePath || '').split('/')
  return parts.slice(0, -1).join('/') || '/'
}

export const matchesSearch = (img, filter) => {
  const needle = String(filter || '').toLowerCase()
  if (!needle) return true
  return (img?.path || '').toLowerCase().includes(needle) ||
         (img?.name || '').toLowerCase().includes(needle)
}

/**
 * Decide whether the infinite-scroll sentinel should request another page.
 * A failed request must not auto-retry: retrying in a tight loop makes the
 * Sync and sentinel loaders flicker until the network request settles again.
 */
export const shouldLoadMore = ({ error, inView, hasMore, loading, imageCount }) =>
  !error && inView && hasMore && !loading && imageCount > 0

/**
 * Bucket a similarity percentage (0-100) into tiers for badge styling.
 */
export const similarityTier = (similarity) => {
  const value = Number(similarity)
  if (!Number.isFinite(value)) return 'low'
  if (value >= 95) return 'exact'
  if (value >= 75) return 'high'
  return 'low'
}
