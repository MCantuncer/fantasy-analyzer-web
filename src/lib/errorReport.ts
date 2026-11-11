// Crash reports: when a screen fails to draw or an error goes uncaught, the API is told so it shows
// up in the error reports. Nothing personal is sent: no account token, no cookies, no league ids
// (the page is sent as its path and tab only), and the API masks emails and tokens in messages.

export type CrashKind = 'crash' | 'error' | 'rejection'

export interface CrashReport {
  kind: CrashKind
  name: string
  message: string
  stack: string
  page: string
  build: string
}

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const MAX_PER_PAGE_LOAD = 10

// Errors that aren't ours or aren't bugs: browser extensions, a cross-origin script with no detail,
// the browser's own resize-loop warning, and a page load cut off by navigating away.
const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /chrome-extension:|moz-extension:|safari-(web-)?extension:/i,
  /Failed to fetch dynamically imported module|Importing a module script failed/i,
]

const sent = new Set<string>()
let count = 0

/** Only the path and the tab: league ids and every other query value stay out of reports. */
export function pageOf(location: Pick<Location, 'pathname' | 'search'>): string {
  const tab = new URLSearchParams(location.search).get('tab')
  return tab ? `${location.pathname}?tab=${tab}` : location.pathname
}

export function describe(kind: CrashKind, error: unknown, page: string): CrashReport | null {
  let name = 'Error'
  let message = ''
  let stack = ''
  if (error instanceof Error) {
    // A failed API call is reported by the API itself, and a dropped connection is not a bug.
    if (error.name === 'ApiError' || 'status' in error) return null
    name = error.name || 'Error'
    message = error.message
    stack = error.stack ?? ''
  } else if (typeof error === 'string') {
    message = error
  } else {
    try {
      message = JSON.stringify(error) ?? String(error)
    } catch {
      message = String(error)
    }
  }
  if (NOISE.some((re) => re.test(message) || re.test(stack))) return null
  return {
    kind,
    name: name.slice(0, 120),
    message: message.slice(0, 2000),
    stack: stack.slice(0, 16000),
    page: page.slice(0, 300),
    build: __BUILD__,
  }
}

/** Sends a report, at most once per problem and ten per page load. Never throws. */
export function reportError(kind: CrashKind, error: unknown, extraStack = ''): void {
  try {
    const report = describe(kind, error, pageOf(window.location))
    if (!report) return
    if (extraStack) report.stack = `${report.stack}\n${extraStack}`.slice(0, 16000)
    const key = `${report.kind}|${report.name}|${report.message}`
    if (sent.has(key) || count >= MAX_PER_PAGE_LOAD) return
    sent.add(key)
    count += 1
    void fetch(`${BASE}/api/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // reporting must never become the next crash
  }
}

/** Listens for uncaught errors and unhandled promise rejections anywhere on the page. */
export function watchErrors(target: Window = window): void {
  target.addEventListener('error', (e) => {
    // A failed <img> or <script> load also fires 'error' (with no error object); not a crash.
    if (!(e instanceof ErrorEvent)) return
    reportError('error', e.error ?? e.message)
  })
  target.addEventListener('unhandledrejection', (e) => reportError('rejection', e.reason))
}

/** For tests: forget what was sent. */
export function resetReports(): void {
  sent.clear()
  count = 0
}
