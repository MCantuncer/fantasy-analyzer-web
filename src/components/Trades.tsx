import { useContext, useMemo, useState, type ReactNode } from 'react'
import type { FeedbackSource, TradeIdea } from '../api/client'
import { names, pct, tradeKey } from '../lib/format'
import { HeadStack } from './PlayerHead'
import { ImpactBars } from './ImpactBars'
import { OddsChange } from './OddsChange'
import { InjuryBadges } from './InjuryBadges'
import { BadgeNotes } from './PlayerBadges'
import { premiumValue, useRoundValues, valueSentence } from '../lib/tradeValue'
import { FeedbackContext, TradeFeedback, ratingLabel, useMyFeedback } from './TradeFeedback'
import { RulesBar, useTradeRules } from './TradeRules'
import { applyRules } from '../lib/tradeRules'
import './Trades.css'

export const ACCEPTANCE = {
  likely: { label: 'Likely', tone: 'good' },
  possible: { label: 'Possible', tone: 'warn' },
  long_shot: { label: 'Long shot', tone: 'bad' },
} as const

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="secondary"
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
      {copied ? 'Copied' : 'Copy pitch'}
    </button>
  )
}

/** Small amber mark for a caveat on a deal. Decorative: the text says it. */
function WarningMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.75" r="0.9" fill="currentColor" />
    </svg>
  )
}

interface ItemProps {
  trade: TradeIdea
  id: string
  open: boolean
  onToggle: () => void
  why: string
  /** FAAB dollars sent with the players. */
  faab?: number
  tag?: ReactNode
  extra?: ReactNode
  /** Which list the card is in. With a verified manager's scope, the card gets a Feedback tab. */
  feedbackSource?: FeedbackSource
}

/** One expandable trade row: the summary line, then the pitch, reasons and category bars. */
export function TradeItem({ trade: t, id, open, onToggle, why, faab = 0, tag, extra, feedbackSource }: ItemProps) {
  const rounds = useRoundValues()
  const acc = ACCEPTANCE[t.acceptance_label]
  const scope = useContext(FeedbackContext)
  const tabs = scope !== null && feedbackSource !== undefined
  const [panel, setPanel] = useState<'overview' | 'feedback'>('overview')
  const saved = useMyFeedback(tabs ? feedbackSource : undefined, t)
  const overview = (
    <>
      <div>
        {t.warnings && t.warnings.length > 0 && (
          <ul className="trades-warning">
            {t.warnings.map((w) => (
              <li key={w}>
                <WarningMark />
                <span>{w} Shown because it's one of the best deals of the day.</span>
              </li>
            ))}
          </ul>
        )}
        <div className="detail-label">Your pitch to {t.partner_team_name}</div>
        <p className="pitch">{t.pitch}</p>
        {t.reasons.length > 0 && (
          <>
            <div className="detail-label">{why}</div>
            <ul className="reasons">
              {t.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}
        <ul className="reasons">
          <li>
            {valueSentence(t.value_they_get, t.value_they_give, rounds)}, as owners price players
            {t.owner_premium >= 0.5
              ? `, including a ${premiumValue(t.owner_premium, t.value_they_give, rounds)} owner premium on what they send.`
              : '.'}
          </li>
          <li>
            Categories won per week: you {cats(t.my_cats_gain)}, they {cats(t.their_cats_gain)}.
          </li>
          {t.my_drop && <li>You drop {t.my_drop.name} to make room.</li>}
          {t.my_add && (
            <li>
              You send more than you get back: pick up {t.my_add.name} from free agency for the open spot. The odds
              above include him.
            </li>
          )}
          {t.their_drop && <li>They would likely drop {t.their_drop.name}.</li>}
          {extra}
        </ul>
        <BadgeNotes players={t.get} />
        <div className="row">
          <CopyButton text={t.pitch} />
        </div>
      </div>
      <ImpactBars changes={t.category_changes} label="Your weekly win chance per category" />
    </>
  )
  return (
    <li id={id} className={open ? 'move open' : 'move'}>
      <button type="button" className="move-row" aria-expanded={open} aria-controls={`${id}-detail`} onClick={onToggle}>
        <span>
          <span className="label-sm">Give </span>
          <HeadStack players={t.give} size={28} />
          <strong>
            {names(t.give)}
            {faab > 0 && ` + $${faab} FAAB`}
          </strong>
          <InjuryBadges players={t.give} />
        </span>
        <span>
          <span className="label-sm">Get </span>
          <HeadStack players={t.get} size={28} />
          <strong>{names(t.get)}</strong>
          <InjuryBadges players={t.get} />
          {tag}
        </span>
        <span>
          <span className="label-sm">with </span>
          {t.partner_team_name}
        </span>
        <span className="accept" title="Rough estimate from value balance and how much the deal helps them">
          <span className={`tnum ${acc.tone}`}>
            {pct(t.acceptance)} · {acc.label}
          </span>
          <span className="meter" aria-hidden="true">
            <span className={`fill-${acc.tone}`} style={{ width: pct(t.acceptance) }} />
          </span>
        </span>
        <OddsChange before={t.playoff_pct_before} after={t.playoff_pct_after} />
      </button>
      {open && !tabs && (
        <div className="move-detail" id={`${id}-detail`}>
          {overview}
        </div>
      )}
      {open && tabs && (
        <div id={`${id}-detail`}>
          <div className="move-tabs tabs" role="tablist" aria-label="Trade details">
            <button
              type="button"
              role="tab"
              className="tab"
              id={`${id}-tab-overview`}
              aria-selected={panel === 'overview'}
              aria-controls={`${id}-panel-overview`}
              onClick={() => setPanel('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              id={`${id}-tab-feedback`}
              aria-selected={panel === 'feedback'}
              aria-controls={`${id}-panel-feedback`}
              onClick={() => setPanel('feedback')}
            >
              Feedback
              {saved && <span className={`feedback-pill ${saved.rating}`}>{ratingLabel(saved.rating)}</span>}
            </button>
          </div>
          {panel === 'overview' ? (
            <div
              className="move-detail"
              role="tabpanel"
              id={`${id}-panel-overview`}
              aria-labelledby={`${id}-tab-overview`}
            >
              {overview}
            </div>
          ) : (
            <div
              className="move-detail"
              role="tabpanel"
              id={`${id}-panel-feedback`}
              aria-labelledby={`${id}-tab-feedback`}
            >
              <TradeFeedback trade={t} source={feedbackSource} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}

type Mode = 'fair' | 'edge'

const MODES: Record<Mode, { label: string; hint: string; empty: string; why: string }> = {
  fair: {
    label: 'Fair',
    hint: 'Both teams get better in the categories they play for',
    empty: 'No deal helps both sides at a fair price right now. Check back after a few weeks of games.',
    why: 'Why they might say yes',
  },
  edge: {
    label: 'Edge',
    hint: 'They win on paper, you win on the court',
    empty: 'No deal gives them the paper win while clearly favoring you right now.',
    why: 'Why it favors you',
  },
}

function cats(x: number) {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`
}

interface TradesProps {
  fair: TradeIdea[]
  edge: TradeIdea[]
  categories?: string[]
  teams?: { id: number; name: string }[]
  myTeamId?: number
  keepNames?: string[]
}

export function Trades({
  fair: allFair,
  edge: allEdge,
  categories = [],
  teams = [],
  myTeamId,
  keepNames = [],
}: TradesProps) {
  const { rules } = useTradeRules()
  const fairSplit = useMemo(() => applyRules(rules, allFair), [rules, allFair])
  const edgeSplit = useMemo(() => applyRules(rules, allEdge), [rules, allEdge])
  const fair = fairSplit.kept
  const edge = edgeSplit.kept
  const [mode, setMode] = useState<Mode>('fair')
  const [showSkipped, setShowSkipped] = useState(false)
  const trades = mode === 'fair' ? fair : edge
  const skipped = (mode === 'fair' ? fairSplit : edgeSplit).skipped
  const [open, setOpen] = useState<string | null>(allFair[0] ? tradeKey(allFair[0]) : null)

  const choose = (m: Mode) => {
    setMode(m)
    const list = m === 'fair' ? fair : edge
    setOpen(list[0] ? tradeKey(list[0]) : null)
  }

  return (
    <section className="card flush trades-panel" aria-labelledby="trades-title">
      <div className="card-head">
        <h2 id="trades-title">Trades to offer</h2>
        <div className="segmented" role="group" aria-label="Trade style">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => choose(m)} title={MODES[m].hint}>
              {MODES[m].label} · {(m === 'fair' ? fair : edge).length}
            </button>
          ))}
        </div>
      </div>
      <RulesBar
        skipped={skipped.length}
        showSkipped={showSkipped}
        onShowSkipped={() => setShowSkipped(!showSkipped)}
        categories={categories}
        teams={teams}
        myTeamId={myTeamId}
        keepNames={keepNames}
      />
      <p className="small muted trades-hint">{MODES[mode].hint}. Ranked by your gain and the chance they say yes.</p>
      {trades.length === 0 && !(showSkipped && skipped.length) ? (
        <p className="empty">{MODES[mode].empty}</p>
      ) : (
        <>
          <div className="move-cols" aria-hidden="true">
            <span>You give</span>
            <span>You get</span>
            <span>With</span>
            <span>They accept</span>
            <span className="right">Playoff odds</span>
          </div>
          <ol className="move-list">
            {trades.map((t, i) => {
              const key = tradeKey(t)
              const isOpen = open === key
              return (
                <TradeItem
                  key={key}
                  trade={t}
                  id={`trade-${i}`}
                  open={isOpen}
                  onToggle={() => setOpen(isOpen ? null : key)}
                  why={MODES[mode].why}
                  feedbackSource={mode === 'fair' ? 'trades' : 'edge'}
                />
              )
            })}
            {showSkipped &&
              skipped.map(({ idea: t, rule }, i) => {
                const key = tradeKey(t)
                const isOpen = open === key
                return (
                  <TradeItem
                    key={key}
                    trade={t}
                    id={`trade-skipped-${i}`}
                    open={isOpen}
                    onToggle={() => setOpen(isOpen ? null : key)}
                    why={MODES[mode].why}
                    tag={<span className="skipped-pill">Skipped: {rule.label}</span>}
                    feedbackSource={mode === 'fair' ? 'trades' : 'edge'}
                  />
                )
              })}
          </ol>
        </>
      )}
    </section>
  )
}
