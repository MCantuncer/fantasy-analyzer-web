const PREFIX = '#reset='

/**
 * The token from an emailed reset link (`https://courtfantasy.app/#reset=<token>`), or null.
 * It rides after '#' so it never reaches a server log or a Referer, and it is taken out of the
 * address bar at once, so it isn't left in the tab's history or copied along with the URL.
 */
export function readResetToken(): string | null {
  const { hash, pathname, search } = window.location
  if (!hash.startsWith(PREFIX)) return null
  window.history.replaceState(null, '', pathname + search)
  const token = hash.slice(PREFIX.length)
  return /^[\w-]{20,200}$/.test(token) ? token : null
}
