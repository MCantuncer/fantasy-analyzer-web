import { useEffect, useRef, useState } from 'react'
import { Check, X } from '@phosphor-icons/react'
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

// What Pro adds, in the order a fan meets it: the player card first, the full page last.
const ADDS = [
  { name: 'Next-game line', line: 'Every player’s line for tonight, on player cards and FA swaps' },
  { name: 'Our call', line: 'Our final score and total for every game, locked at tip-off' },
  { name: 'Our Estimates', line: 'Tonight’s picks with how sure we are, Kupons, and every result kept' },
  { name: 'Sportsbook vs', line: 'iddaa’s lines beside ours, and our record against them' },
  { name: 'Pre-game box and Scouting Report', line: 'Each player’s line before tip, and how both teams come in' },
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
          <ul className="pro-adds">
            {ADDS.map(({ name, line }) => (
              <li key={name}>
                <span className="pro-add-tick" aria-hidden="true">
                  <Check size={12} weight="bold" />
                </span>
                <span>
                  <b>{name}</b>
                  <span>{line}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pro-sheet-foot">
          <div className="pro-plans" role="radiogroup" aria-label="Billing">
            {(['year', 'month'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={interval === key}
                aria-label={key === 'year' ? `Yearly, ${PRICES.year.amount} ${PRICES.year.per}, save 35%` : `Monthly, ${PRICES.month.amount} ${PRICES.month.per}`}
                className="pro-plan-opt"
                onClick={() => setInterval(key)}
              >
                <span className="pro-radio" aria-hidden="true" />
                <span className="pro-opt-t">
                  <b>
                    {PRICES[key].name}
                    {key === 'year' && <span className="pro-save">Save 35%</span>}
                  </b>
                  <span>{PRICES[key].alt}</span>
                </span>
                <span className="pro-opt-p">
                  <b className="num">{PRICES[key].amount}</b>
                  <span>{key === 'year' ? '/ year' : '/ month'}</span>
                </span>
              </button>
            ))}
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
