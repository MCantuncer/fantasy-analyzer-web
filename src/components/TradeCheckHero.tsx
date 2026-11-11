import { ArrowDown, ArrowsLeftRight, ArrowUp, Check, Scales, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { OfferCheck, PlayerRef } from '../api/client'
import { injuryShort } from '../lib/injury'
import { ACCEPTANCE_WORD, CALL, PARTNER_CALL, checkSummary, pointChange, reasonTail, surname } from '../lib/tradeCheck'
import { ChangeDot } from './ChangeDot'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import './TradeCheckHero.css'

const MINE_ICON = (
  <svg className="tck-hero-mine" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
  </svg>
)

const CALL_ICON = { good: Check, close: Scales, bad: X } as const

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pct = (x: number) => Math.round(x * 100)
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')

function Pocket({ label, players, leaving }: { label: string; players: PlayerRef[]; leaving: boolean }) {
  return (
    <div className={`tck-hero-pocket ${leaving ? 'out' : 'in'}`}>
      <span className="tck-hero-cap">{label}</span>
      <ul>
        {players.map((p) => (
          <li key={p.id}>
            <span className="tck-hero-face">
              <PlayerHead player={p} size={44} team={p.pro_team} />
              {p.injury_status !== 'ACTIVE' && (
                <span className="tck-hero-inj" aria-hidden="true">
                  {injuryShort(p.injury_status)}
                </span>
              )}
            </span>
            <span className="tck-hero-name">{surname(p.name)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One team's playoff odds: today, after, the signed change and its dumbbell. */
function Odds({ before, after, side }: { before: number; after: number; side: 'me' | 'them' }) {
  const moved = pointChange(before, after)
  const Arrow = moved > 0 ? ArrowUp : moved < 0 ? ArrowDown : null
  const tone = side === 'them' ? 'them' : moved > 0 ? 'up' : moved < 0 ? 'down' : 'flat'
  return (
    <div className={`tck-hero-odds ${side}`}>
      <div className="tck-hero-pair num">
        <span className="tck-hero-before">{pct(before)}%</span>
        <span className="tck-hero-to">→</span>
        <span className="tck-hero-after">
          {pct(after)}
          <small>%</small>
        </span>
      </div>
      <span className={`tck-hero-delta num ${tone}${Math.abs(moved) >= 5 ? ' big' : ''}`}>
        {Arrow && <Arrow size={13} weight="bold" aria-hidden="true" />} {signed(moved)} pts
      </span>
      <ChangeDot before={before} after={after} side={side} />
    </div>
  )
}

export interface TradeCheckHeroProps {
  /** The engine's answer; leave out while it runs. */
  check?: OfferCheck | null
  give: PlayerRef[]
  get: PlayerRef[]
  myName: string
  partnerName: string
  partnerColour?: string
  /** Who "you" is: "You" on your own check, a team name when showing someone else's. */
  meLabel?: string
  /** Buttons under the reason line, such as Accept on ESPN. */
  actions?: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

/**
 * The Two-Way verdict: the deal as a die-cut slip across the centre seam, your solid tag and their
 * violet outlined tag, then both teams' playoff odds mirrored about the seam. A plain summary comes
 * first for screen readers; a slim copy of the verdict sticks to the top on phones once this scrolls off.
 */
export function TradeCheckHero({
  check,
  give,
  get,
  myName,
  partnerName,
  partnerColour,
  meLabel = 'You',
  actions,
  loading = false,
  error = null,
  onRetry,
}: TradeCheckHeroProps) {
  const ref = useRef<HTMLElement>(null)
  const [offscreen, setOffscreen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const you = meLabel === 'You'
  const idea = check?.idea
  const call = check ? CALL[check.call] : null
  const CallIcon = call ? CALL_ICON[call.tone] : null
  const theirs =
    idea && idea.partner_playoff_pct_before != null && idea.partner_playoff_pct_after != null
      ? { before: idea.partner_playoff_pct_before, after: idea.partner_playoff_pct_after }
      : null
  const tail = check ? reasonTail(check.call_reason) : ''
  const crest = <TeamCrest name={partnerName} colour={partnerColour} size={22} />
  const summary = check
    ? you
      ? checkSummary({ ...check, partner_team_name: partnerName })
      : checkSummary({ ...check, partner_team_name: partnerName }).replace(
          'Your playoff odds',
          `${meLabel} playoff odds`,
        )
    : loading
      ? 'Checking 12,000 seasons.'
      : (error ?? '')

  return (
    <section ref={ref} className={`card tck-hero${loading ? ' loading' : ''}`} aria-busy={loading}>
      <p className="sr-only" role="status">
        {summary}
      </p>
      <div className="tck-hero-heads">
        <span className="tck-hero-team me">
          {you && MINE_ICON}
          <TeamCrest name={myName} colour="var(--gold)" size={24} />
          <span>{meLabel}</span>
        </span>
        <span className="tck-hero-team them">
          <span>{partnerName}</span>
          <TeamCrest name={partnerName} colour={partnerColour} size={24} />
        </span>
      </div>

      <div className="tck-hero-slip">
        <Pocket label={`${meLabel} ${you ? 'send' : 'sends'}`} players={give} leaving />
        <span className="tck-hero-swap" aria-hidden="true">
          <ArrowsLeftRight size={16} />
        </span>
        <Pocket label={`${meLabel} ${you ? 'get' : 'gets'}`} players={get} leaving={false} />
        {loading && <span className="tck-hero-line" aria-hidden="true" />}
      </div>

      {check && call && CallIcon ? (
        <div className="tck-hero-tags" aria-hidden="true">
          <span className={`tck-hero-tag ${call.tone}`}>
            <CallIcon size={16} weight="bold" /> {call.label}
          </span>
          <span className="tck-hero-theirs">
            <span className="tck-hero-tag them">
              {crest} {PARTNER_CALL[check.partner_call]}
            </span>
            <span className="tck-hero-paper num">
              {check.paper_win ? 'Wins' : 'Loses'} on paper · ${Math.round(check.idea.value_they_get)} for $
              {Math.round(check.idea.value_they_give)}
            </span>
          </span>
        </div>
      ) : error ? (
        <p className="tck-hero-fail">
          {error}{' '}
          {onRetry && (
            <button type="button" className="link" onClick={onRetry}>
              Try Again
            </button>
          )}
        </p>
      ) : (
        <p className="tck-hero-wait" aria-hidden="true">
          Checking 12,000 seasons…
        </p>
      )}

      {check?.direction === 'sending' && (
        <p className="tck-hero-yes" aria-hidden="true">
          Chance they say yes · <b>{capital(ACCEPTANCE_WORD[check.idea.acceptance_label])}</b>
        </p>
      )}

      {idea && (
        <div className="tck-hero-board" aria-hidden="true">
          <p className="tck-hero-oddsline">
            <b>Playoff odds</b>
            {check.odds_noise > 0 && <> · give or take {Math.round(check.odds_noise * 1000) / 10} pt</>}
          </p>
          <div className="tck-hero-oddsrow">
            <Odds before={idea.playoff_pct_before} after={idea.playoff_pct_after} side="me" />
            {theirs && <Odds before={theirs.before} after={theirs.after} side="them" />}
          </div>
        </div>
      )}
      {tail && <p className="tck-hero-reason">{tail}</p>}
      {actions && <div className="tck-hero-actions">{actions}</div>}

      {check && call && CallIcon && (
        <div className={`tck-hero-sticky${offscreen ? ' on' : ''}`} aria-hidden="true">
          <span className={`tck-hero-tag ${call.tone}`}>
            <CallIcon size={13} weight="bold" /> {call.label}
          </span>
          <span className="num">
            <TeamCrest name={myName} colour="var(--gold)" size={16} /> {pct(idea!.playoff_pct_before)}→
            {pct(idea!.playoff_pct_after)}%{' '}
            <b className={pointChange(idea!.playoff_pct_before, idea!.playoff_pct_after) >= 0 ? 'up' : 'down'}>
              {signed(pointChange(idea!.playoff_pct_before, idea!.playoff_pct_after))}
            </b>
          </span>
          {theirs && (
            <span className="num">
              <TeamCrest name={partnerName} colour={partnerColour} size={16} /> {pct(theirs.before)}→{pct(theirs.after)}
              % <b className="them">{signed(pointChange(theirs.before, theirs.after))}</b>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
