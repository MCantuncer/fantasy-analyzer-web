// Paddle.js (Paddle Billing v2), loaded only when someone starts a checkout. Paddle's overlay takes
// the card itself; the transaction it opens on was made by our API for the signed-in account.
import type { BillingConfig } from '../api/client'

export interface PaddleEvent {
  name?: string
  data?: { transaction_id?: string } | null
}

interface PaddleJs {
  Environment: { set(env: string): void }
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void
  Checkout: {
    open(options: {
      transactionId: string
      settings?: { displayMode?: 'overlay'; theme?: 'light' | 'dark'; locale?: string; allowLogout?: boolean }
    }): void
    close(): void
  }
}

declare global {
  interface Window {
    Paddle?: PaddleJs
  }
}

export const PADDLE_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js'

const listeners = new Set<(event: PaddleEvent) => void>()
let loading: Promise<PaddleJs> | null = null

/** Paddle.js, set up once with the API's public client token and environment. */
export function loadPaddle(config: BillingConfig): Promise<PaddleJs> {
  if (!config.enabled || !config.client_token) return Promise.reject(new Error('Checkout is not open yet.'))
  const token = config.client_token
  loading ??= new Promise<PaddleJs>((resolve, reject) => {
    const ready = () => {
      const paddle = window.Paddle
      if (!paddle) return reject(new Error('Checkout could not load.'))
      if (config.environment === 'sandbox') paddle.Environment.set('sandbox')
      paddle.Initialize({ token, eventCallback: (event) => listeners.forEach((fn) => fn(event)) })
      resolve(paddle)
    }
    const script = document.createElement('script')
    script.src = PADDLE_SRC
    script.async = true
    script.onload = ready
    script.onerror = () => reject(new Error('Checkout could not load. Check your connection and try again.'))
    document.head.appendChild(script)
  }).catch((err) => {
    loading = null
    throw err
  })
  return loading
}

/** Hears Paddle's checkout events (``checkout.completed``, ``checkout.closed``) until the returned call. */
export function onPaddleEvent(fn: (event: PaddleEvent) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
