// Google Identity Services, loaded only when the server has Google sign-in turned on.

interface GoogleId {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void }): void
  renderButton(el: HTMLElement, options: Record<string, string | number>): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SRC = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleId> | null = null

export function loadGoogle(): Promise<GoogleId> {
  if (window.google) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('no google')))
    script.onerror = () => {
      loading = null
      reject(new Error('Google sign-in could not load.'))
    }
    document.head.appendChild(script)
  })
  return loading
}
