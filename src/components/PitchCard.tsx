import { useState, type CSSProperties, type ReactNode } from 'react'
import type { TradeIdea } from '../api/client'
import { ordinal } from '../lib/format'
import { TeamCrest } from './TeamCrest'
import './PitchCard.css'

type Need = NonNullable<TradeIdea['pitch_needs']>[number]

// What the per-game number counts, for the line under it.
const UNIT: Record<string, string> = {
  PTS: 'points a game',
  REB: 'rebounds a game',
  AST: 'assists a game',
  STL: 'steals a game',
  BLK: 'blocks a game',
  '3PM': 'threes a game',
  TO: 'turnovers a game',
}
const LONG: Record<string, string> = {
  'FG%': 'field goal %',
  'FT%': 'free throw %',
  TO: 'turnovers',
  '3PM': 'threes',
}

interface Props {
  partner: string
  /** The partner's league colour: the note's flap and seal. */
  colour?: string
  /** A colour for the flap and edges only, when the crest keeps the league colour (Check a Trade's violet). */
  flap?: string
  /** League size, for "8th/10". */
  teams?: number
  /** The sentence Copy pitch copies. */
  pitch: string
  needs?: Need[] | null
  /** Their side of the deal: the "Why they might say yes" tiles. */
  children: ReactNode
}

/**
 * The pitch as a note sealed in their colour: what the deal gives them, one tile per category, and
 * Copy pitch. A "Their side of the deal" turn then leads into a recessed tray holding the reasons.
 */
export function PitchCard({ partner, colour, flap, teams, pitch, needs, children }: Props) {
  const list = needs ?? []
  const style = { '--pp-team': flap ?? colour ?? 'var(--muted)' } as CSSProperties
  return (
    <div className="pp" style={style}>
      <section className="pp-note" aria-label={`Your pitch to ${partner}`}>
        <span className="pp-flap" aria-hidden="true" />
        <span className="pp-seal">
          <TeamCrest name={partner} colour={colour} size={34} />
        </span>
        <header className="pp-to">
          <span className="pp-to-k">Your pitch to</span> <span className="pp-to-v">{partner}</span>
        </header>
        {list.length > 0 ? (
          <>
            <p className="pp-lede">This trade gives you</p>
            <ul className="pp-gifts">
              {list.map((n) => (
                <Gift key={n.category} need={n} teams={teams} />
              ))}
            </ul>
          </>
        ) : (
          <p className="pp-lede pp-empty">Balances your roster without costing you a category.</p>
        )}
        <footer className="pp-foot">
          {list.length > 0 && (
            <p className="pp-sends">
              <span className="pp-sends-k">Sends as </span>
              <q>{pitch}</q>
            </p>
          )}
          <CopyPitch text={pitch} />
        </footer>
      </section>
      <div className="pp-turn" role="separator" aria-label="Their side of the deal">
        <span className="pp-turn-pill" aria-hidden="true">
          <TeamCrest name={partner} colour={colour} size={18} />
          Their side of the deal
        </span>
      </div>
      <div className="pp-tray">{children}</div>
    </div>
  )
}

function Gift({ need: n, teams }: { need: Need; teams?: number }) {
  const turnover = n.category === 'TO'
  // per_game is the gain, already flipped for TO: shown as fewer turnovers.
  const big = n.per_game == null ? 'Improves' : `${turnover ? '−' : '+'}${n.per_game.toFixed(1)}`
  const sub = n.per_game == null ? (LONG[n.category] ?? n.category) : (UNIT[n.category] ?? 'a game')
  const rank = `${ordinal(n.league_rank)}${teams ? ` of ${teams}` : ''}`
  const sr =
    n.per_game == null
      ? `${LONG[n.category] ?? n.category}: ${rank} in the league now, improves`
      : `${LONG[n.category] ?? n.category}: ${rank} in the league now, ${turnover ? 'down' : 'up'} ${n.per_game.toFixed(1)} a game`
  return (
    <li className="pp-gift">
      <span className="sr-only">{sr}</span>
      <div className="pp-gift-top" aria-hidden="true">
        <span className="pp-cat">{n.category}</span>
        <span className="pp-rank num">
          {ordinal(n.league_rank)}
          {teams ? <span className="pp-of">/{teams}</span> : null}
        </span>
      </div>
      <div className={n.per_game == null ? 'pp-big pp-word' : 'pp-big num'} aria-hidden="true">
        {big}
      </div>
      <div className="pp-sub" aria-hidden="true">
        {sub}
      </div>
    </li>
  )
}

function CopyPitch({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="pp-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          },
          () => undefined,
        )
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="5" width="8.5" height="8.5" rx="2" />
        <path d="M10.5 3.5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6.5a1 1 0 001 1h.5" />
      </svg>
      <span aria-live="polite">{copied ? 'Copied' : 'Copy pitch'}</span>
    </button>
  )
}
