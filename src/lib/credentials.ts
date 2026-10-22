// ESPN cookies for private leagues. Kept in sessionStorage (gone when the tab closes)
// unless the user opts in to remembering them on this device.

export interface Credentials {
  espnS2: string
  swid: string
}

const KEY = 'espn-credentials'

function read(storage: Storage): Credentials | null {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.espnS2 === 'string' && typeof parsed?.swid === 'string') return parsed
  } catch {
    // storage blocked or corrupted
  }
  return null
}

export function loadCredentials(): Credentials | null {
  return read(sessionStorage) ?? read(localStorage)
}

export function isRemembered(): boolean {
  return read(localStorage) !== null
}

export function saveCredentials(creds: Credentials, remember: boolean): void {
  const clean = { espnS2: creds.espnS2.trim(), swid: normalizeSwid(creds.swid) }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(clean))
    if (remember) localStorage.setItem(KEY, JSON.stringify(clean))
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: credentials still work for this page view via state
  }
}

export function clearCredentials(): void {
  try {
    sessionStorage.removeItem(KEY)
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** SWID is a GUID in braces; users often paste it without them. */
export function normalizeSwid(swid: string): string {
  const s = swid.trim()
  if (!s) return s
  return s.startsWith('{') ? s : `{${s.replace(/[{}]/g, '')}}`
}
