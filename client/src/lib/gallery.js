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
