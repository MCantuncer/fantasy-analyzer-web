import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { useEscapeLayer } from '../lib/escapeStack'
import { nbaAbbrev } from '../lib/filmRoom'
import { usePlayerCard } from '../lib/playerCard'
import { LEG_STAT, LEG_WORD, ledgerPlayers, unitsText } from '../lib/rungRecord'
import type { LedgerLadder, LedgerNight, LedgerPlayer } from '../lib/rungRecord'
import { useSwipeToClose } from '../lib/swipeToClose'
import { useMediaQuery } from '../lib/useMediaQuery'
import { PlayerHead } from './PlayerHead'
import './LedgerReveal.css'

/** Waterline (Can 2026-11-28, "which are the landed bets?"). Each night draws its picks as a skyline:
 *  one column per ladder, rungs from the bottom up, landed solid green and missed a hollow ring. Hover,
 *  focus or a click opens the night's players beside the ledger (in the By odds band column); on
 *  phones a tap opens them in a bottom sheet. Spec: /mnt/project-files/ledger-landed/final/. */

const LEDGER_ROWS = 6
/** Two columns (ledger | bands) from here, as in RungRecord.css. */
const WIDE = '(min-width: 981px)'
const SHEET = '(max-width: 980px)'
const OPEN_MS = 180
const CLOSE_MS = 200
/** How far the panel reaches above and below the open row, and the bridge's fillet. */
const R = 12
const EDGE = 16

const tone = (v: number) => (v > 0 ? 'good' : v < 0 ? 'bad' : '')
const keyOf = (n: LedgerNight) => `${n.day ?? n.label}`

export function Ledger({ ledger, day }: { ledger: LedgerNight[]; day: number | null }) {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const wide = useMediaQuery(WIDE)
  const rows = [...ledger].reverse()
  const shown = all ? rows : rows.slice(0, LEDGER_ROWS)
  const night = open == null ? null : (rows.find((n) => keyOf(n) === open) ?? null)

  const card = useRef<HTMLDivElement>(null)
  const rowEls = useRef(new Map<string, HTMLButtonElement>())
  const openT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const closeT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const focusIn = useRef(false)

  const clear = () => {
    clearTimeout(openT.current)
    clearTimeout(closeT.current)
  }
  const close = useCallback((back = false) => {
    clearTimeout(openT.current)
    clearTimeout(closeT.current)
    setOpen((was) => {
      if (back && was) rowEls.current.get(was)?.focus({ preventScroll: true })
      return null
    })
    setPinned(false)
  }, [])
  const show = (k: string, pin = false) => {
    clear()
    setOpen(k)
    setPinned(pin)
  }
  const later = () => {
    clearTimeout(closeT.current)
    if (!pinned) closeT.current = setTimeout(() => close(), CLOSE_MS)
  }
  useEffect(() => clear, [])
  // A switch between the dock and the sheet closes whatever is open.
  useEffect(() => close(), [wide, close])
  useEscapeLayer(open != null, () => close(true))

  const enter = (k: string) => (e: ReactPointerEvent) => {
    if (!wide || e.pointerType !== 'mouse') return
    clearTimeout(closeT.current)
    if (pinned) return
    if (open != null) show(k)
    else {
      clearTimeout(openT.current)
      openT.current = setTimeout(() => show(k), OPEN_MS)
    }
  }
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(openT.current)
    if (open != null) later()
  }
  const click = (k: string) => (e: ReactMouseEvent) => {
    if (!wide) return show(k, true)
    if (pinned && open === k) return close()
    focusIn.current = e.detail === 0 // Enter or Space: take focus into the panel
    show(k, true)
  }
  const focus = (k: string) => (e: React.FocusEvent<HTMLButtonElement>) => {
    if (wide && !pinned && e.currentTarget.matches(':focus-visible')) show(k)
  }

  return (
    <div className="vr-rec-card vr-led" ref={card}>
      <h3>
        Ledger<small>newest first</small>
      </h3>
      <div className="vr-led-cols" aria-hidden="true">
        <span>Night</span>
        <span>Picks</span>
        <span className="n">Net · Balance</span>
      </div>
      <ol className="vr-led-rows" aria-label="Night by night: value picks, how many landed, the night's net and the balance">
        {shown.map((n) => {
          const k = keyOf(n)
          const here = n.day != null && n.day === day
          const picked = n.kind === 'night' && n.legs.length > 0
          const body = <RowBody n={n} here={here} />
          return (
            <li key={k}>
              {picked ? (
                <button
                  type="button"
                  ref={(el) => {
                    if (el) rowEls.current.set(k, el)
                    else rowEls.current.delete(k)
                  }}
                  className={`vr-led-row${here ? ' this' : ''}`}
                  aria-expanded={open === k}
                  aria-haspopup="dialog"
                  aria-label={`${n.label}: ${n.hits} of ${n.picks} landed, net ${unitsText(n.net)}, balance ${unitsText(n.balance)}`}
                  onPointerEnter={enter(k)}
                  onPointerLeave={leave}
                  onFocus={focus(k)}
                  onClick={click(k)}
                >
                  {body}
                </button>
              ) : (
                <div className={`vr-led-row ${n.kind === 'night' ? 'flat' : 'quiet'}${here ? ' this' : ''}`}>{body}</div>
              )}
            </li>
          )
        })}
      </ol>
      {rows.length > LEDGER_ROWS && (
        <button
          type="button"
          className="vr-rec-more"
          aria-expanded={all}
          onClick={() => {
            close()
            setAll(!all)
          }}
        >
          {all ? 'Show fewer' : `Show all ${rows.length} nights`}
        </button>
      )}
      {night && wide && (
        <Dock
          night={night}
          pinned={pinned}
          card={card}
          row={rowEls.current.get(open!) ?? null}
          focusIn={focusIn}
          onEnter={() => clearTimeout(closeT.current)}
          onLeave={later}
          onClose={close}
        />
      )}
      {night && !wide && <Sheet night={night} onClose={close} />}
    </div>
  )
}

/** The row's insides: the night and its count, the skyline, the net over the balance. */
function RowBody({ n, here }: { n: LedgerNight; here: boolean }) {
  const quiet = n.kind !== 'night'
  return (
    <>
      <span className="vr-led-night">
        <b>{n.label}</b>
        {!quiet && (
          <small>
            <b className="num">{n.hits}</b> of <span className="num">{n.picks}</span> landed
          </small>
        )}
        {here && <small className="vr-led-here">the night above</small>}
      </span>
      {quiet ? (
        <span className="vr-led-sky vr-led-note">{n.kind === 'none' ? "Ladders didn't load" : 'No picks'}</span>
      ) : (
        <Skyline players={ledgerPlayers(n.legs)} />
      )}
      <span className={`vr-led-net num ${quiet ? '' : tone(n.net)}`}>
        {n.kind === 'none' ? '–' : n.picks ? unitsText(n.net) : '0'}
      </span>
      <span className="vr-led-bal num">{unitsText(n.balance)}</span>
    </>
  )
}

/** One column per ladder, rungs bottom-up: landed a solid block, missed a hollow ring. Players a
 *  step apart, best night first, the same order as the panel. */
function Skyline({ players }: { players: LedgerPlayer[] }) {
  return (
    <span className="vr-led-sky" aria-hidden="true">
      {players.map((p) => (
        <span className="p" key={p.key}>
          {p.ladders.map((l) => (
            <span className="l" key={l.stat}>
              {l.rungs.map((r) => (
                <i key={r.n} className={r.hit ? 'y' : undefined} />
              ))}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

/** The night's players: face, name (opens the player card), team, his net; under it his ladders. */
function Reveal({ night, head, id }: { night: LedgerNight; head: ReactNode; id: string }) {
  const players = ledgerPlayers(night.legs)
  return (
    <>
      <header className="vr-led-ph">
        <span className="t">
          <h4 id={id}>{night.label}</h4>
          <span className="ct">
            <b className="num">{night.hits}</b> of <span className="num">{night.picks}</span> landed
          </span>
        </span>
        {head}
      </header>
      <ol className="vr-led-players" aria-label="Players">
        {players.map((p) => (
          <li className="vr-led-pl" key={p.key}>
            <PlayerHead player={{ id: p.id ?? 0, name: p.name }} team={p.team != null ? nbaAbbrev(p.team) : null} size={32} />
            <span className="vr-led-who">
              <PlayerName id={p.id} name={p.name} />
              {p.team != null && <span className="vr-led-team">{nbaAbbrev(p.team)}</span>}
            </span>
            <span className={`vr-led-pn num ${tone(p.net)}`}>{unitsText(p.net)}</span>
            <span className="vr-led-lads">
              {p.ladders.map((l) => (
                <Ladder key={l.stat} l={l} />
              ))}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

/** A ladder low to high, with what he got standing where landed turns into missed. */
function Ladder({ l }: { l: LedgerLadder }) {
  const word = LEG_WORD[l.stat] ?? l.stat
  const chip = (r: LedgerLadder['rungs'][number]) => (
    <span
      key={r.n}
      className={`vr-led-c${r.hit ? ' y' : ''}`}
      role="img"
      aria-label={`${word} ${r.n}+ at ${r.odd.toFixed(2)}, ${r.hit ? 'landed' : 'missed'}`}
    >
      <b aria-hidden="true">{r.n}+</b>
      <small aria-hidden="true">{r.odd.toFixed(2)}</small>
    </span>
  )
  return (
    <span className="vr-led-lad">
      <span className="st" aria-hidden="true">
        {LEG_STAT[l.stat] ?? l.stat}
      </span>
      {l.rungs.slice(0, l.reached).map(chip)}
      {l.got != null && (
        <span className="vr-led-w" role="img" aria-label={`he got ${l.got}`}>
          <b aria-hidden="true" className="num">
            {l.got}
          </b>
        </span>
      )}
      {l.rungs.slice(l.reached).map(chip)}
    </span>
  )
}

function PlayerName({ id, name }: { id: number | null; name: string }) {
  const card = usePlayerCard()
  if (!card || id == null || id <= 0) return <span className="vr-led-name plain">{name}</span>
  const who = { id, name }
  return (
    <button
      type="button"
      className="vr-led-name"
      aria-haspopup="dialog"
      onPointerEnter={(e) => e.pointerType === 'mouse' && card.prefetch(who)}
      onPointerDown={() => card.prefetch(who)}
      onClick={() => card.open(who)}
    >
      {name}
    </button>
  )
}

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="vr-led-x" aria-label="Close" onClick={onClick}>
    <X size={18} weight="bold" aria-hidden="true" />
  </button>
)

/** Desktop: the panel docked in the By odds band column, level with the row and joined to it by a
 *  bridge in the panel's colour, which is also the mouse's path into it. */
function Dock({
  night,
  pinned,
  card,
  row,
  focusIn,
  onEnter,
  onLeave,
  onClose,
}: {
  night: LedgerNight
  pinned: boolean
  card: React.RefObject<HTMLDivElement | null>
  row: HTMLButtonElement | null
  focusIn: React.RefObject<boolean>
  onEnter: () => void
  onLeave: () => void
  onClose: (back?: boolean) => void
}) {
  const dock = useRef<HTMLDivElement>(null)
  const bridge = useRef<SVGSVGElement>(null)

  const place = useCallback(() => {
    const el = dock.current
    const br = bridge.current
    const host = card.current
    if (!el || !br || !host || !row) return
    const grid = host.parentElement
    const c = host.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    const bands = host.nextElementSibling?.getBoundingClientRect()
    const left = bands ? bands.left - c.left : c.width + 40
    const width = bands ? bands.width : c.width
    el.style.left = `${left}px`
    el.style.width = `${width}px`
    // The page's sticky bar is the ceiling.
    const ceil = Math.max(0, document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0) + EDGE
    el.style.maxHeight = `${window.innerHeight - ceil - EDGE}px`
    const h = el.offsetHeight
    // Level with the row; up when it would run off the bottom; always overlapping the row.
    let top = Math.min(r.top - R, window.innerHeight - EDGE - h)
    top = Math.max(top, ceil)
    top = Math.min(top, r.top - R)
    if (top + h < r.bottom + R) top = r.bottom + R - h
    el.style.top = `${top - c.top}px`
    const w = Math.max(0, left - (r.right - c.left) + 2)
    const bh = r.height + 2 * R
    br.setAttribute('width', `${w}`)
    br.setAttribute('height', `${bh}`)
    br.setAttribute('viewBox', `0 0 ${w} ${bh}`)
    Object.assign(br.style, { left: `${r.right - c.left - 1}px`, top: `${r.top - c.top - R}px` })
    br.firstElementChild?.setAttribute('d', `M0 ${R}H${w - R}A${R} ${R} 0 0 0 ${w} 0V${bh}A${R} ${R} 0 0 0 ${w - R} ${bh - R}H0Z`)
    // What the panel covers steps back: the bands fade, the card under them dims where it meets it.
    const under = grid?.children[2] as HTMLElement | undefined
    under?.classList.toggle('vr-led-under', !!under && top + h > under.getBoundingClientRect().top)
  }, [card, row])

  useLayoutEffect(() => {
    place()
    const grid = card.current?.parentElement
    grid?.classList.add('vr-led-docked')
    return () => {
      grid?.classList.remove('vr-led-docked')
      grid?.querySelector('.vr-led-under')?.classList.remove('vr-led-under')
    }
  }, [place, card, night])

  useEffect(() => {
    const on = () => requestAnimationFrame(place)
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [place])

  useEffect(() => {
    if (pinned && focusIn.current) {
      focusIn.current = false
      dock.current?.querySelector<HTMLElement>('.vr-led-name, .vr-led-x')?.focus()
    }
  }, [pinned, focusIn, night])

  // Pinned: a press anywhere outside the panel, its bridge and the rows closes it.
  useEffect(() => {
    if (!pinned) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (dock.current?.contains(t) || bridge.current?.contains(t)) return
      if (t instanceof Element && t.closest('.vr-led-row')) return
      onClose()
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [pinned, onClose])

  const hover = {
    onPointerEnter: onEnter,
    onPointerLeave: (e: ReactPointerEvent) => e.pointerType === 'mouse' && onLeave(),
  }
  return (
    <>
      <svg ref={bridge} className="vr-led-bridge" aria-hidden="true" {...hover}>
        <path />
      </svg>
      <div
        ref={dock}
        className={`vr-led-dock${pinned ? ' pinned' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="vr-led-dock-h"
        {...hover}
        onBlur={(e) => {
          const to = e.relatedTarget as Element | null
          if (!pinned && !dock.current?.contains(to) && !to?.closest?.('.vr-led-row')) onClose()
        }}
      >
        <Reveal night={night} id="vr-led-dock-h" head={pinned ? <CloseButton onClick={() => onClose(true)} /> : null} />
      </div>
    </>
  )
}

/** Phones and narrow screens: the same players in a bottom sheet over the page. */
function Sheet({ night, onClose }: { night: LedgerNight; onClose: (back?: boolean) => void }) {
  const sheet = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  useSwipeToClose(sheet, () => onClose(true), { media: SHEET, backdrop: scrim })
  useEffect(() => {
    const was = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheet.current?.querySelector<HTMLElement>('.vr-led-x')?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = was
    }
  }, [])
  return createPortal(
    <>
      <div ref={scrim} className="vr-led-scrim" onClick={() => onClose(true)} />
      <div ref={sheet} className="vr-led-sheet" role="dialog" aria-modal="true" aria-labelledby="vr-led-sheet-h">
        <div className="vr-led-grab" aria-hidden="true">
          <i />
        </div>
        <Reveal
          night={night}
          id="vr-led-sheet-h"
          head={
            <>
              <span className={`sn num ${tone(night.net)}`}>{unitsText(night.net)}</span>
              <CloseButton onClick={() => onClose(true)} />
            </>
          }
        />
      </div>
    </>,
    document.body,
  )
}
