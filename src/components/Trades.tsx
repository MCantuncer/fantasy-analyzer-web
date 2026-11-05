import { useContext, useMemo, useState, type ReactNode } from 'react'
import { CaretDown, Handshake } from '@phosphor-icons/react'
import { teamColours } from '../lib/league'
import { TeamCrest } from './TeamCrest'
import { PitchCard } from './PitchCard'
import type { FeedbackSource, TradeIdea } from '../api/client'
import { pct, tradeKey } from '../lib/format'
import { PlayerHead } from './PlayerHead'
import { ImpactBars } from './ImpactBars'
import { OddsChange } from './OddsChange'
import { InjuryBadges } from './InjuryBadges'
import { BadgeNotes } from './PlayerBadges'
import { premiumValue, useRoundValues } from '../lib/tradeValue'
import { FeedbackContext, TradeFeedback, ratingLabel, useMyFeedback } from './TradeFeedback'
import { RulesBar, useTradeRules } from './TradeRules'
import { applyRules } from '../lib/tradeRules'
import { useKeepRowInView } from '../lib/useKeepRowInView'
import './Trades.css'
import { DealChips } from './PlayerCard'
import { ReasonTiles } from './ReasonTiles'
import { shortListNote } from '../lib/tradeList'

export const ACCEPTANCE = {
  likely: { label: 'Likely', tone: 'good' },
  possible: { label: 'Possible', tone: 'warn' },
  long_shot: { label: 'Long shot', tone: 'bad' },
} as const

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

/** One side of a trade row: a label, then a small team-lit face, name, injury pill and "MIL · PF" per player.
 *  Plain text only, since the whole row is the button that opens the details. */
function RowLane({ label, players, extra }: { label: string; players: TradeIdea['give']; extra?: string }) {
  return (
    <span className="tr-lane">
      <span className="tr-lane-label">{label}</span>
      {players.map((p) => (
        <span key={p.id} className="tr-player">
          <PlayerHead player={p} size={32} team={p.pro_team} />
          <span className="tr-player-text">
            <span className="tr-name">
              {p.name}
              <InjuryBadges players={[p]} />
            </span>
            <span className="tr-meta">{[p.pro_team, p.positions.join('/')].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
      ))}
      {extra && <span className="tr-extra num">{extra}</span>}
    </span>
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
  /** The partner's league colour, for the crest beside their name. */
  colour?: string
  /** League size, for the pitch's "8th/10". */
  teamCount?: number
}

/** One expandable trade row: the summary line, then the pitch, reasons and category bars. */
export function TradeItem({
  trade: t,
  id,
  open,
  onToggle,
  why,
  faab = 0,
  tag,
  extra,
  feedbackSource,
  colour,
  teamCount,
}: ItemProps) {
  const rounds = useRoundValues()
  const acc = ACCEPTANCE[t.acceptance_label]
  const scope = useContext(FeedbackContext)
  const tabs = scope !== null && feedbackSource !== undefined
  const [panel, setPanel] = useState<'overview' | 'feedback'>('overview')
  const saved = useMyFeedback(tabs ? feedbackSource : undefined, t)
  const overview = (
    <>
      <div>
        <DealChips deal={t} />
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
        <PitchCard partner={t.partner_team_name} colour={colour} teams={teamCount} pitch={t.pitch} needs={t.pitch_needs}>
          <ReasonTiles
            facts={t.facts}
            reasons={t.reasons}
            title={why}
            valueGet={t.value_they_get}
            valueGive={t.value_they_give}
            myCats={t.my_cats_gain}
            theirCats={t.their_cats_gain}
            rounds={rounds}
          />
        </PitchCard>
        {t.owner_premium >= 0.5 && (
          <p className="small muted">
            Their side includes a {premiumValue(t.owner_premium, t.value_they_give, rounds)} owner premium on what
            they send.
          </p>
        )}
        <ul className="reasons">
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
      </div>
      <ImpactBars changes={t.category_changes} label="Your weekly win chance per category" />
    </>
  )
  return (
    <li id={id} className={open ? 'move open' : 'move'}>
      <button type="button" className="tr-row" aria-expanded={open} aria-controls={`${id}-detail`} onClick={onToggle}>
        <span className="tr-top">
          <span className="tr-with">
            <span className="sr-only">Trade with </span>
            <TeamCrest name={t.partner_team_name} colour={colour} size={20} />
            <span className="tr-partner">{t.partner_team_name}</span>
            {tag}
          </span>
          <span className="tr-accept" title="Rough estimate from value balance and how much the deal helps them">
            <Handshake size={16} aria-hidden="true" />
            <span className="tr-accept-n num">{pct(t.acceptance)}</span>
            <span className={`tr-accept-w ${acc.tone}`}>
              <span className="sr-only">chance they accept, </span>
              {acc.label}
            </span>
          </span>
        </span>
        <span className="tr-deal">
          <RowLane label="You give" players={t.give} extra={faab > 0 ? `+ $${faab} FAAB` : undefined} />
          <RowLane label="You get" players={t.get} />
          <span className="tr-odds">
            <span className="tr-ol">
              <span className="tr-who">You</span>
              <OddsChange before={t.playoff_pct_before} after={t.playoff_pct_after} />
            </span>
            {t.partner_playoff_pct_before != null && t.partner_playoff_pct_after != null && (
              <span className="tr-ol">
                <span className="tr-who">Them</span>
                <OddsChange before={t.partner_playoff_pct_before} after={t.partner_playoff_pct_after} />
              </span>
            )}
          </span>
        </span>
        <span className="tr-more" aria-hidden="true">
          {open ? 'Hide details' : 'Details'}
          <CaretDown size={14} weight="bold" />
        </span>
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
    hint: "Both teams' playoff odds go up at least a point",
    empty:
      "No trade raises both teams' playoff odds right now. Early in the season, a deal that helps you usually costs the other team, since you become a tougher rival for the same playoff spots. Check back after a few weeks of games.",
    why: 'Why they might say yes',
  },
  edge: {
    label: 'Edge',
    hint: 'They win on paper, you win on the court',
    empty: "No deal gives them the paper win while raising both teams' playoff odds right now.",
    why: 'Why it favors you',
  },
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
  const found = (mode === 'fair' ? allFair : allEdge).length
  const [open, setOpen] = useState<string | null>(allFair[0] ? tradeKey(allFair[0]) : null)
  const keepRow = useKeepRowInView(open)
  const colours = useMemo(
    () =>
      teamColours(
        teams.map((x) => x.id),
        myTeamId,
      ),
    [teams, myTeamId],
  )

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
      <p className="small muted trades-hint">
        {MODES[mode].hint}.{shortListNote(found) && ` ${shortListNote(found)}`} Ranked by your gain and the chance they
        say yes.
      </p>
      {trades.length === 0 && !(showSkipped && skipped.length) ? (
        <p className="empty">{MODES[mode].empty}</p>
      ) : (
        <>
          <ol className="move-list" onClickCapture={keepRow}>
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
                  colour={colours.get(t.partner_team_id)}
                  teamCount={teams.length || undefined}
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
                    colour={colours.get(t.partner_team_id)}
                    teamCount={teams.length || undefined}
                  />
                )
              })}
          </ol>
        </>
      )}
    </section>
  )
}
