// The account's session token. It proves who is signed in to our server only; it says
// nothing about ESPN, and no ESPN password or cookie is involved.

const KEY = 'session-token'
let memory: string | null = null

export function loadToken(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory
  } catch {
    return memory
  }
}

export function saveToken(token: string): void {
  memory = token
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // storage blocked: the session lasts for this page view
  }
}

export function clearToken(): void {
  memory = null
  try {
    localStorage.removeItem(KEY)
    // Links from before accounts existed no longer mean anything.
    for (const k of Object.keys(localStorage)) if (k.startsWith('team-link:')) localStorage.removeItem(k)
  } catch {
    // ignore
  }
}
