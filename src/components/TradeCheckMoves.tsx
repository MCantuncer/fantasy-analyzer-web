import { Lock, UsersThree, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { OfferCheck, PlayerRef } from '../api/client'
import { pointChange, surname } from '../lib/tradeCheck'
import { PlayerHead } from './PlayerHead'
import './TradeCheckMoves.css'

const names = (ps: PlayerRef[]) => ps.map((p) => p.name).join(' and ')
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')
const REST_SHOWN = 4

function Face({ p, ghost = false }: { p: PlayerRef; ghost?: boolean }) {
  return (
    <span className={`tck-mv-face${ghost ? ' ghost' : ''}`}>
      <PlayerHead player={p} size={28} team={p.pro_team} />
    </span>
  )
}

/**
 * Who you'd cut instead: the engine's cheapest cuts with your playoff odds after each, then the rest of
 * your bench. Keepers are locked. Escape, the X or the scrim close it with nothing changed.
 */
function CutSheet({
  check,
  roster,
  keep,
  current,
  onPick,
  onClose,
}: {
  check: OfferCheck
  roster: PlayerRef[]
  keep: number[]
  current: number
  onPick: (id: number) => void
  onClose: () => void
}) {
  const [choice, setChoice] = useState(current)
  const [more, setMore] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const before = check.idea.playoff_pct_before
  const options = check.my_drop_options ?? []
  const best = options.filter((o) => o.playoff_pct_after != null)
  const rest = options.filter((o) => o.playoff_pct_after == null)
  const kept = roster.filter((p) => keep.includes(p.id) && !check.idea.give.some((g) => g.id === p.id))
  const engine = options.find((o) => o.playoff_pct_after != null)?.player.id
  const picked = options.find((o) => o.player.id === choice)?.player

  useEffect(() => {
    const el = box.current
    el?.querySelector<HTMLElement>('input:checked, input:not(:disabled)')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const row = (p: PlayerRef, odds: number | null | undefined) => (
    <li key={p.id}>
      <label className={`tck-mv-opt${choice === p.id ? ' on' : ''}`}>
        <input type="radio" name="tck-cut" checked={choice === p.id} onChange={() => setChoice(p.id)} />
        <PlayerHead player={p} size={32} team={p.pro_team} />
        <span className="tck-mv-who">
          <span className="tck-mv-name">
            {p.name}
            {p.id === engine && <span className="tck-mv-pick">Engine's pick</span>}
          </span>
          <span className="tck-mv-meta">
            {p.positions.join('/')} · {p.pro_team || 'FA'}
          </span>
        </span>
        {odds != null && (
          <span className="tck-mv-odds num">
            {Math.round(odds * 100)}%{' '}
            <small className={pointChange(before, odds) >= 0 ? 'up' : 'down'}>
              {signed(pointChange(before, odds))}
            </small>
          </span>
        )}
      </label>
    </li>
  )

  return (
    <div className="tck-mv-scrim" onClick={onClose}>
      <div
        ref={box}
        className="tck-mv-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tck-mv-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tck-mv-sheet-head">
          <h3 id="tck-mv-title">Who you'd cut</h3>
          <button type="button" className="icon" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="tck-mv-sub">
          You get more players than you send, so one of yours leaves. The odds are yours after the trade with that cut,
          from {Math.round(before * 100)}% today.
        </p>
        <fieldset className="tck-mv-list">
          <legend>Best cuts for this deal</legend>
          <ul>{best.map((o) => row(o.player, o.playoff_pct_after))}</ul>
        </fieldset>
        {(rest.length > 0 || kept.length > 0) && (
          <fieldset className="tck-mv-list">
            <legend>Rest of your bench</legend>
            <p className="tck-mv-sub">Odds show once you pick, in about a second.</p>
            <ul>
              {(more ? rest : rest.slice(0, REST_SHOWN)).map((o) => row(o.player, null))}
              {more &&
                kept.map((p) => (
                  <li key={p.id}>
                    <label className="tck-mv-opt locked">
                      <input type="radio" name="tck-cut" disabled />
                      <PlayerHead player={p} size={32} team={p.pro_team} />
                      <span className="tck-mv-who">
                        <span className="tck-mv-name">{p.name}</span>
                        <span className="tck-mv-meta">
                          <Lock size={12} weight="fill" aria-hidden="true" /> Keep, locked
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
            {!more && rest.length + kept.length > REST_SHOWN && (
              <button type="button" className="secondary tck-mv-more" onClick={() => setMore(true)}>
                Show {rest.length + kept.length - REST_SHOWN} More
              </button>
            )}
          </fieldset>
        )}
        <div className="tck-mv-go">
          <button type="button" disabled={!picked || choice === current} onClick={() => onPick(choice)}>
            {picked ? `Cut ${surname(picked.name)} and Re-check` : 'Pick who to cut'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  check: OfferCheck
  give: number
  get: number
  roster: PlayerRef[]
  keep: number[]
  onCut: (id: number) => void
}

/** Who else moves to make the deal fit: your cut (with Change), your pickup, their cut and their pickup. */
export function TradeCheckMoves({ check, give, get, roster, keep, onCut }: Props) {
  const [open, setOpen] = useState(false)
  const change = useRef<HTMLButtonElement>(null)
  const cut = check.my_drops.length === 1 ? check.my_drops[0] : null
  const canChange = cut != null && (check.my_drop_options ?? []).length > 1
  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => change.current?.focus())
  }
  const quiet = !check.my_drops.length && !check.my_adds.length && !check.their_drops.length && !check.their_adds.length

  if (quiet)
    return (
      <p className="tck-mv-line">
        <UsersThree size={18} aria-hidden="true" />
        <span>
          <b>Nobody cut</b> · {give} for {get}
        </span>
      </p>
    )

  return (
    <ul className="tck-mv">
      {check.my_drops.length > 0 && (
        <li>
          {check.my_drops.map((p) => (
            <Face key={p.id} p={p} />
          ))}
          <span>
            You'd cut <b>{names(check.my_drops)}</b>
          </span>
          {canChange && (
            <button ref={change} type="button" className="secondary tck-mv-change" onClick={() => setOpen(true)}>
              Change
            </button>
          )}
        </li>
      )}
      {check.my_adds.length > 0 && (
        <li>
          {check.my_adds.map((p) => (
            <Face key={p.id} p={p} />
          ))}
          <span>
            You'd add <b>{names(check.my_adds)}</b> from free agents
          </span>
        </li>
      )}
      {check.their_drops.length > 0 && (
        <li className="them">
          {check.their_drops.map((p) => (
            <Face key={p.id} p={p} ghost />
          ))}
          <span>
            They'd likely cut <b>{names(check.their_drops)}</b>
          </span>
        </li>
      )}
      {check.their_adds.length > 0 && (
        <li className="them">
          {check.their_adds.map((p) => (
            <Face key={p.id} p={p} />
          ))}
          <span>
            They'd add <b>{names(check.their_adds)}</b>
          </span>
        </li>
      )}
      {open && cut && (
        <CutSheet
          check={check}
          roster={roster}
          keep={keep}
          current={cut.id}
          onClose={close}
          onPick={(id) => {
            setOpen(false)
            onCut(id)
          }}
        />
      )}
    </ul>
  )
}
