import { useState, type ReactNode } from 'react'
import { Gift, Warning } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { fetchBillingConfig, openBillingPortal, type Me } from '../api/client'
import { daysLeft, planState, PRICES, shortDate } from '../lib/plans'
import { usePro } from '../lib/pro'
import { ProMark } from './Pro'
import './ProPlan.css'

function priceOf(me: Me) {
  return me.interval ? PRICES[me.interval] : null
}

/**
 * The plan block at the top of the account menu: Free with "Go Pro", or the Pro state in plain
 * sentences. Every billing action opens Paddle's customer portal, where cancelling happens too.
 * Shown once checkout is open (or for an account that already has Pro), so nobody meets a dead button.
 */
export function ProPlan({ onPick }: { onPick: () => void }) {
  const { me } = usePro()
  return me ? <PlanBlock me={me} onPick={onPick} /> : null
}

function PlanBlock({ me, onPick }: { me: Me; onPick: () => void }) {
  const { open, previewFree, setPreviewFree } = usePro()
  const config = useQuery({ queryKey: ['billing-config'], queryFn: fetchBillingConfig, staleTime: 10 * 60_000 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const state = planState(me)
  if (state.kind === 'free' && !config.data?.enabled) return null
  const price = priceOf(me)

  const portal = async () => {
    setBusy(true)
    setError(null)
    try {
      const { url } = await openBillingPortal()
      window.location.assign(url)
    } catch {
      setError("Billing couldn't open. Try again in a minute.")
      setBusy(false)
    }
  }
  const goPro = () => {
    onPick()
    open()
  }
  const billing = (label: string, primary = false) => (
    <button type="button" className={primary ? undefined : 'secondary'} disabled={busy} onClick={portal}>
      {label}
    </button>
  )

  let head: ReactNode
  let body: ReactNode
  let acts: ReactNode
  let note: ReactNode = null
  switch (state.kind) {
    case 'free':
      head = (
        <>
          <b>Free plan</b>
        </>
      )
      body = 'Every league tool is yours. Pro adds next-game lines, our call on every game and Our Estimates.'
      acts = (
        <button type="button" className="pro-go" aria-haspopup="dialog" onClick={goPro}>
          Try Pro free for 7 days
        </button>
      )
      note = `Then ${PRICES.year.amount} ${PRICES.year.per}. Cancel any time.`
      break
    case 'admin':
      head = (
        <>
          <ProMark /> <b>Admin</b>
          <span className="pro-plan-meta">Sees everything</span>
        </>
      )
      body = previewFree ? 'Locks show as a Free account sees them.' : 'You see every Pro spot, always.'
      acts = (
        <span className="pro-plan-switch">
          <span className="pro-plan-switch-t">
            <b id="pro-preview-l">Free preview</b>
            <span>See the site as a Free account sees it</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={previewFree}
            aria-labelledby="pro-preview-l"
            className="pro-switch"
            onClick={() => setPreviewFree(!previewFree)}
          />
        </span>
      )
      break
    case 'trial':
      head = (
        <>
          <ProMark /> <b>Trial</b>
          {price && <span className="pro-plan-meta">{price.name}</span>}
        </>
      )
      body = `Trial ends in ${daysLeft(state.ends)} ${daysLeft(state.ends) === 1 ? 'day' : 'days'}, on ${shortDate(
        state.ends,
      )}.${price ? ` Then ${price.amount} ${price.per}.` : ''}`
      acts = (
        <>
          {billing('Manage billing')}
          {billing('Cancel trial')}
        </>
      )
      break
    case 'pro':
      head = (
        <>
          <ProMark /> <b>{price?.name ?? 'Pro'}</b>
          {price && (
            <span className="pro-plan-meta">
              {price.amount} {price.per}
            </span>
          )}
        </>
      )
      body = state.renews ? `Renews on ${shortDate(state.renews)}.` : 'Pro is on.'
      acts = (
        <>
          {billing('Manage billing')}
          {billing('Cancel')}
        </>
      )
      note = state.renews
        ? `Cancel opens Paddle, who handle our billing. Pro stays on to ${shortDate(
            state.renews,
          )}, and every league tool stays free after.`
        : 'Cancel opens Paddle, who handle our billing.'
      break
    case 'due':
      head = (
        <>
          <ProMark /> <b>{price?.name ?? 'Pro'}</b>
          <span className="pro-plan-meta pro-plan-due">
            <Warning size={16} aria-hidden="true" />
            Payment due
          </span>
        </>
      )
      body = 'Card declined. Pro stays on for a few days while you update it.'
      acts = billing('Update card', true)
      break
    case 'leaving':
      head = (
        <>
          <ProMark /> <b>Pro until {shortDate(state.ends)}</b>
          <span className="pro-plan-meta">Cancelled</span>
        </>
      )
      body = `You cancelled; nothing more is charged. After ${shortDate(
        state.ends,
      )} you're on Free and your leagues stay as they are.`
      acts = (
        <>
          {billing('Keep Pro', true)}
          {billing('Manage billing')}
        </>
      )
      break
    case 'gift':
      head = (
        <>
          <ProMark /> <b>A gift</b>
          <span className="pro-plan-meta">
            <Gift size={16} aria-hidden="true" />
            from COURT
          </span>
        </>
      )
      body = state.ends
        ? `Pro until ${shortDate(state.ends)}, a gift. Nothing to pay. No card on file.`
        : 'Pro, a gift. Nothing to pay. No card on file.'
      acts =
        state.ends && config.data?.enabled ? (
          <button type="button" className="secondary" aria-haspopup="dialog" onClick={goPro}>
            Keep Pro after {shortDate(state.ends)}
          </button>
        ) : null
      break
  }

  return (
    <section className="pro-plan" aria-label="Your plan">
      <div className="pro-plan-h">{head}</div>
      <p className="pro-plan-p">{body}</p>
      {acts && <div className="pro-plan-acts">{acts}</div>}
      {error ? (
        <p className="pro-plan-how pro-error" role="alert">
          {error}
        </p>
      ) : (
        note && <p className="pro-plan-how">{note}</p>
      )}
    </section>
  )
}
