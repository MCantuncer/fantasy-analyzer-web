import { ArrowDown, ArrowsLeftRight, ArrowUp, Scales, ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { OfferCheck, PlayerRef } from '../api/client'
import { injuryShort } from '../lib/injury'
import { ACCEPTANCE_WORD, CALL, PARTNER_CALL, checkSummary, pointChange, reasonTail, surname } from '../lib/tradeCheck'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import './TradeCheckHero.css'

/** Thumbs for yes and no, scales for too close to call. */
const CALL_ICON = { take: ThumbsUp, close: Scales, pass: ThumbsDown } as const

const CATEGORY = /\b(FG%|FT%|3PM|REB|AST|STL|BLK|TO|PTS)(?![A-Za-z0-9])/g

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pct = (x: number) => Math.round(x * 100)
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')

/** The reason with its category codes in bold, so "AST and STL" stand out from the words around them. */
function Reason({ text }: { text: string }) {
  const parts = text.split(CATEGORY)
  return (
    <>
      {parts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  )
}

/** Today → after, the after big, then the signed change. Skeletons until the engine answers. */
function Numbers({ pair, side }: { pair: [number, number] | null; side: 'me' | 'them' }) {
  if (!pair) {
    return (
      <span className="tck-hero-nums" aria-hidden="true">
        <span className="tck-hero-sk big" />
        <span className="tck-hero-sk" />
      </span>
    )
  }
  const [before, after] = pair
  const moved = pointChange(before, after)
  const Arrow = moved > 0 ? ArrowUp : moved < 0 ? ArrowDown : null
  const tone = side === 'them' ? 'them' : moved > 0 ? 'up' : moved < 0 ? 'down' : 'flat'
  return (
    <span className="tck-hero-nums num" aria-hidden="true">
      <span className="tck-hero-before">{pct(before)}</span>
      <span className="tck-hero-to">→</span>
      <span className="tck-hero-after">
        {pct(after)}
        <small>%</small>
      </span>
      <span className={`tck-hero-delta ${tone}`}>
        {Arrow && <Arrow size={12} weight="bold" />}
        {signed(moved)}
      </span>
    </span>
  )
}

function Side({ label, players }: { label: string; players: PlayerRef[] }) {
  return (
    <div className="tck-hero-side">
      <span className="tck-hero-cap">{label}</span>
      <ul className={players.length > 2 ? 'three' : undefined}>
        {players.map((p) => (
          <li key={p.id}>
            <span className="tck-hero-face">
              <PlayerHead player={p} size={44} team={p.pro_team} />
              {p.injury_status !== 'ACTIVE' && (
                <span className={`tck-hero-inj${p.injury_status === 'OUT' ? ' out' : ''}`} aria-hidden="true">
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
  /** Buttons under the card, such as Accept on ESPN. */
  actions?: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

/**
 * The verdict, scoreline style: the engine's call for you and why, then you and them on one grid
 * (today → after, the change), then the deal as two rows of faces. Theirs is never a second verdict:
 * a violet edge, their word and the paper values. A plain summary comes first for screen readers; on
 * phones a slim copy sticks to the top once the card scrolls off.
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
  // Re-checking keeps the last numbers on the board but never shows its call as the answer.
  const settled = check && !loading ? check : null
  const call = settled ? CALL[settled.call] : null
  const CallIcon = settled ? CALL_ICON[settled.call] : null
  const mine: [number, number] | null = idea ? [idea.playoff_pct_before, idea.playoff_pct_after] : null
  const theirs: [number, number] | null =
    idea && idea.partner_playoff_pct_before != null && idea.partner_playoff_pct_after != null
      ? [idea.partner_playoff_pct_before, idea.partner_playoff_pct_after]
      : null
  const tail = settled ? reasonTail(settled.call_reason) : ''
  const noise = check && check.odds_noise > 0 ? Math.round(check.odds_noise * 1000) / 10 : 0
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
      {loading && <span className="tck-hero-line" aria-hidden="true" />}
      <p className="sr-only" role="status">
        {summary}
      </p>

      {settled && call && CallIcon ? (
        <div className="tck-hero-verdict" aria-hidden="true">
          <div>
            <p className="tck-hero-eyebrow">Engine's call for {you ? 'you' : meLabel}</p>
            <h2 className={`tck-hero-call ${call.tone}`}>
              <CallIcon weight="bold" />
              {call.label}
            </h2>
          </div>
          {settled.direction === 'sending' && (
            <p className="tck-hero-yes">
              <small>They say yes</small>
              <b>{capital(ACCEPTANCE_WORD[settled.idea.acceptance_label])}</b>
            </p>
          )}
        </div>
      ) : error && !loading ? (
        <p className="tck-hero-fail">
          {error}{' '}
          {onRetry && (
            <button type="button" className="link" onClick={onRetry}>
              Try Again
            </button>
          )}
        </p>
      ) : (
        <div className="tck-hero-verdict" aria-hidden="true">
          <h2 className="tck-hero-call wait">Checking 12,000 seasons</h2>
        </div>
      )}
      {tail && (
        <p className="tck-hero-reason" aria-hidden="true">
          <Reason text={tail} />
        </p>
      )}

      <div className={`tck-hero-board${loading && check ? ' stale' : ''}`} aria-hidden="true">
        <div className="tck-hero-row me">
          <TeamCrest name={myName} colour="var(--gold)" size={26} />
          <span className="tck-hero-team">{meLabel}</span>
          <Numbers pair={mine} side="me" />
          <span className="tck-hero-sub">Playoff odds{noise > 0 && <> · ±{noise} pt</>}</span>
        </div>
        <div className="tck-hero-row them">
          <TeamCrest name={partnerName} colour={partnerColour} size={26} />
          <span className="tck-hero-team">{partnerName}</span>
          <Numbers pair={check ? theirs : null} side="them" />
          <span className="tck-hero-sub">
            {check ? (
              <>
                <span className="tck-hero-pc">{PARTNER_CALL[check.partner_call]}</span> · $
                {Math.round(check.idea.value_they_get)} for ${Math.round(check.idea.value_they_give)} on paper
              </>
            ) : (
              <span className="tck-hero-sk wide" />
            )}
          </span>
        </div>
      </div>

      <div className="tck-hero-deal">
        <Side label={`${meLabel} ${you ? 'send' : 'sends'}`} players={give} />
        <span className="tck-hero-swap" aria-hidden="true">
          <ArrowsLeftRight size={18} />
        </span>
        <Side label={`${meLabel} ${you ? 'get' : 'gets'}`} players={get} />
      </div>

      {actions && <div className="tck-hero-actions">{actions}</div>}

      {settled && call && CallIcon && mine && (
        <div className={`tck-hero-sticky${offscreen ? ' on' : ''}`} aria-hidden="true">
          <span className={`tck-hero-call small ${call.tone}`}>
            <CallIcon weight="bold" />
            {call.label}
          </span>
          <span className="num">
            <TeamCrest name={myName} colour="var(--gold)" size={16} /> {pct(mine[0])}→{pct(mine[1])}%{' '}
            <b className={pointChange(...mine) >= 0 ? 'up' : 'down'}>{signed(pointChange(...mine))}</b>
          </span>
          {theirs && (
            <span className="num">
              <TeamCrest name={partnerName} colour={partnerColour} size={16} /> {pct(theirs[0])}→{pct(theirs[1])}%{' '}
              <b className="them">{signed(pointChange(...theirs))}</b>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
