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
