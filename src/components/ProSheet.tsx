import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Binoculars, Scales, Table, Target, Ticket, UserFocus, X } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  fetchBillingConfig,
  fetchMe,
  startCheckout,
  syncBilling,
  type BillingInterval,
  type Me,
} from '../api/client'
import { useEscapeLayer } from '../lib/escapeStack'
import { loadPaddle, onPaddleEvent } from '../lib/paddle'
import { PRICES } from '../lib/plans'
import type { Theme } from '../lib/theme'
import { ProMark } from './Pro'
import './ProSheet.css'

// Small drawings of the real spots, in the tile's text colour.
const DRAW: Record<string, ReactNode> = {
  next: (
    <svg viewBox="0 0 72 30" fill="currentColor">
      {[0, 10, 20, 30, 40, 50, 60].map((x) => (
        <g key={x}>
          <rect x={x} y="3" width="6" height="2" rx="1" opacity=".5" />
          <rect x={x} y="11" width="6" height="12" rx="2.5" />
        </g>
      ))}
    </svg>
  ),
  call: (
    <svg viewBox="0 0 72 30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="5" cy="8" r="4" />
      <circle cx="5" cy="22" r="4" />
      <path d="M13 8h20M13 22h14" />
      <rect x="42" y="2" width="29" height="26" rx="6" />
      <path d="M48 9h12M48 21h12" />
      <path d="M66 18.5l-3.5 2.5 3.5 2.5" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 72 30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="1" y="1" width="70" height="28" rx="5" />
      <path d="M1 10h70M1 19.5h70M24 1v28M40 1v28M56 1v28" />
    </svg>
  ),
  estimates: (
    <svg
      viewBox="0 0 72 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 2h62a3 3 0 0 1 3 3v5a5 5 0 0 0 0 10v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-5a5 5 0 0 0 0-10V5a3 3 0 0 1 3-3z" />
      <path d="M14 10l2.5 2.5L21 8M14 20l2.5 2.5L21 18" />
      <path d="M27 11h30M27 21h22" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 72 30" fill="currentColor">
      <rect x="0" y="3" width="26" height="5" rx="2.5" opacity=".4" />
      <rect x="6" y="12.5" width="20" height="5" rx="2.5" opacity=".4" />
      <rect x="2" y="22" width="24" height="5" rx="2.5" opacity=".4" />
      <rect x="34.2" y="0" width="1.6" height="30" rx=".8" />
      <rect x="44" y="3" width="28" height="5" rx="2.5" />
      <rect x="44" y="12.5" width="22" height="5" rx="2.5" />
      <rect x="44" y="22" width="26" height="5" rx="2.5" />
    </svg>
  ),
  scout: (
    <svg
      viewBox="0 0 72 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="9" r="5" />
      <path d="M1 28c1-6 5-9 9-9s8 3 9 9" />
      <path d="M26 18V6M21.5 10.5 26 6l4.5 4.5" />
      <circle cx="46" cy="9" r="5" />
      <path d="M37 28c1-6 5-9 9-9s8 3 9 9" />
      <path d="M62 6v12M57.5 13.5 62 18l4.5-4.5" />
    </svg>
  ),
}

const TILES = [
  { draw: 'next', Icon: UserFocus, name: 'Next game', line: 'His line for tonight, on cards, swaps and My Players' },
  { draw: 'call', Icon: Target, name: 'Our call', line: 'Final score and total, locked at tip-off' },
  { draw: 'box', Icon: Table, name: 'Pre-game box', line: "Each player's line, before tip" },
  { draw: 'estimates', Icon: Ticket, name: 'Our Estimates', line: 'Picks, Kupons, Why not, Over the Price' },
  { draw: 'book', Icon: Scales, name: 'Sportsbook vs', line: "iddaa's lines beside ours, with our record" },
  { draw: 'scout', Icon: Binoculars, name: 'Scouting Report', line: 'How both teams come in, on match cards' },
] as const

const SYNC_TRIES = [1500, 3000, 5000, 8000]

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * The upgrade sheet: what Pro adds, Monthly | Yearly, and the trial button that opens Paddle's
 * checkout over the page. Right after payment the API reads it from Paddle (``syncBilling``), so Pro
 * opens before Paddle's webhook lands; ``onPro`` closes the sheet and says welcome.
 */
export function ProSheet({ theme, onClose, onPro }: { theme: Theme; onClose: () => void; onPro: (me: Me) => void }) {
  const qc = useQueryClient()
  const [interval, setInterval] = useState<BillingInterval>('year')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const config = useQuery({ queryKey: ['billing-config'], queryFn: fetchBillingConfig, staleTime: 10 * 60_000 })
  const price = PRICES[interval]
  const closed = config.data && !config.data.enabled
  const done = useRef({ onPro, onClose })
  useEffect(() => {
    done.current = { onPro, onClose }
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    sheet.current?.querySelector<HTMLElement>('.pro-sheet-x')?.focus()
    document.body.classList.add('pro-open')
    return () => {
      document.body.classList.remove('pro-open')
      opener?.focus?.()
    }
  }, [])
  useEscapeLayer(true, onClose)

  // Paddle tells us the payment went through; the API reads it, then Pro opens.
  useEffect(
    () =>
      onPaddleEvent(async (event) => {
        if (event.name !== 'checkout.completed') return
        const txn = event.data?.transaction_id
        setBusy(true)
        try {
          let me = txn ? await syncBilling(txn) : await fetchMe()
          for (const wait of SYNC_TRIES) {
            if (me.plan === 'pro') break
            await sleep(wait)
            me = await fetchMe()
          }
          qc.setQueryData(['me'], me)
          window.Paddle?.Checkout.close()
          if (me.plan === 'pro') done.current.onPro(me)
          else setError("Payment received. Pro can take a minute to open; it will show here once it does.")
        } catch {
          setError("Payment received, but we couldn't check it yet. Reload in a minute and Pro will be on.")
        } finally {
          setBusy(false)
        }
      }),
    [qc],
  )

  async function start() {
    if (!config.data) return
    setBusy(true)
    setError(null)
    try {
      const paddle = await loadPaddle(config.data)
      const { transaction_id } = await startCheckout(interval)
      paddle.Checkout.open({
        transactionId: transaction_id,
        settings: { displayMode: 'overlay', theme, locale: 'en', allowLogout: false },
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'already_pro') {
        const me = await fetchMe().catch(() => null)
        if (me) qc.setQueryData(['me'], me)
        return done.current.onClose()
      }
      setError(err instanceof Error && err.message ? err.message : 'Checkout could not open. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pro-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pro-sheet" role="dialog" aria-modal="true" aria-labelledby="pro-sheet-t" ref={sheet}>
        <div className="pro-sheet-handle" aria-hidden="true" />
        <div className="pro-sheet-body">
          <div className="pro-sheet-head">
            <span className="pro-lockup" role="img" aria-label="COURT Pro">
              <span className="pro-wm" aria-hidden="true">
                COURT
              </span>
              <ProMark size="lg" label={false} />
            </span>
            <button type="button" className="icon pro-sheet-x" aria-label="Close" onClick={onClose}>
              <X size={20} weight="bold" aria-hidden="true" />
            </button>
          </div>
          <h2 className="pro-sheet-t" id="pro-sheet-t">
            Free runs your league. Pro adds the games.
          </h2>
          <p className="pro-sheet-sub">One plan for your account, in every league you add.</p>
          <ul className="pro-tiles">
            {TILES.map(({ draw, Icon, name, line }) => (
              <li key={name} className="pro-tile">
                <span className="pro-tile-draw" aria-hidden="true">
                  {DRAW[draw]}
                </span>
                <b className="pro-tile-nm">
                  <Icon size={17} aria-hidden="true" />
                  {name}
                </b>
                <span className="pro-tile-line">{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pro-sheet-foot">
          <div>
            <div className="pro-seg" role="radiogroup" aria-label="Billing">
              {(['month', 'year'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={interval === key}
                  onClick={() => setInterval(key)}
                >
                  {PRICES[key].name}
                  {key === 'year' && <span className="pro-seg-off">35% off</span>}
                </button>
              ))}
            </div>
            <p className="pro-price">
              <b className="num">{price.amount}</b>
              <span className="pro-price-per">{price.per}</span>
              <span className="pro-price-alt">{price.alt}</span>
            </p>
          </div>
          <div>
            <button type="button" className="pro-start" disabled={busy || !config.data || closed} onClick={start}>
              {busy ? 'Opening checkout…' : 'Start 7-day free trial'}
            </button>
            {error ? (
              <p className="pro-fine pro-error" role="alert">
                {error}
              </p>
            ) : closed ? (
              <p className="pro-fine" role="status">
                Checkout isn't open yet. Every spot stays open until it is.
              </p>
            ) : (
              <>
                <p className="pro-fine">
                  Then {price.amount} {price.per}. Cancel any time.
                </p>
                <p className="pro-fine pro-fine-s">Checkout by Paddle opens over this page.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
