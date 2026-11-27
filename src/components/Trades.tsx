import { useContext, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownLeft, ArrowUpRight, CaretDown, Handshake, LockSimple, LockSimpleOpen } from '@phosphor-icons/react'
import { teamColours } from '../lib/league'
import { TeamCrest } from './TeamCrest'
import { PitchCard } from './PitchCard'
import type { FeedbackSource, PlayerRef, TradeIdea } from '../api/client'
import { pct, ptsDiff, signedInt, tradeKey } from '../lib/format'
import { PlayerHead } from './PlayerHead'
import { ImpactBars } from './ImpactBars'
import { InjuryBadges } from './InjuryBadges'
import { BadgeNotes } from './PlayerBadges'
import { premiumValue, useRoundValues } from '../lib/tradeValue'
import { FeedbackContext, TradeFeedback, ratingLabel, useMyFeedback } from './TradeFeedback'
import { RulesBar, useTradeRules } from './TradeRules'
import { applyRules } from '../lib/tradeRules'
import { useKeepRowInView } from '../lib/useKeepRowInView'
import './Trades.css'
import { PlayerLink } from './PlayerCard'
import { KeptPlayers, PlayerInline } from './PlayerInline'
import { ReasonTiles } from './ReasonTiles'
import { expectedGain, expectedGainSpoken, expectedGainText } from '../lib/expectedGain'
import { keptNames } from '../lib/untouchable'

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

interface Keeper {
  keep: number[]
  onToggleKeep: (id: number) => void
}

/** "▲ +2 pts": the sign and a small arrow, never colour alone. */
function Delta({ before, after, unit = true }: { before: number; after: number; unit?: boolean }) {
  const d = ptsDiff(before, after)
  return (
    <span className={`mvt-d num ${d > 0 ? 'good' : d < 0 ? 'bad' : ''}`}>
      {d !== 0 && (
        <span className="mvt-ar" aria-hidden="true">
          {d > 0 ? '▲' : '▼'}
        </span>
      )}
      {signedInt(d)}
      {unit && ' pts'}
    </span>
  )
}

/**
 * One end of a trade row: "You give" or "You get", then each player with a small team-lit face,
 * the name (it opens the card; it sits above the row's tap layer) and "MIL · PF". On the side you
 * give, once the row is open, a "Keep" column of 44px locks.
 */
function RowLane({
  end,
  players,
  extra,
  keeper = null,
}: {
  end: 'give' | 'get'
  players: TradeIdea['give']
  extra?: string
  /** Set on the side you give once the trade is open: a Keep lock beside each player. */
  keeper?: Keeper | null
}) {
  const Icon = end === 'give' ? ArrowUpRight : ArrowDownLeft
  return (
    <div className={`mvt-lane mvt-${end}`}>
      <span className="mvt-lane-k">
        <span className="mvt-lane-l">
          <Icon size={14} aria-hidden="true" />
          {end === 'give' ? 'You give' : 'You get'}
        </span>
        {keeper && (
          <span className="mvt-keep-k" aria-hidden="true">
            Keep
          </span>
        )}
      </span>
      {players.map((p) => (
        <span key={p.id} className="mvt-player">
          <span className="mvt-face">
            <PlayerLink player={p} decorative>
              <PlayerHead player={p} size={40} team={p.pro_team} />
            </PlayerLink>
          </span>
          <span className="mvt-who">
            <span className="mvt-name">
              <PlayerLink player={p} after={<InjuryBadges players={[p]} />} />
            </span>
            <span className="mvt-meta">{[p.pro_team, p.positions.join('/')].filter(Boolean).join(' · ')}</span>
          </span>
          {keeper && (
            <KeepSwitch name={p.name} kept={keeper.keep.includes(p.id)} onToggle={() => keeper.onToggleKeep(p.id)} />
          )}
        </span>
      ))}
      {extra && <span className="mvt-extra num">{extra}</span>}
    </div>
  )
}

/** The same switch as Keep in My Team: a 44px lock under the "Keep" column label. */
function KeepSwitch({ name, kept, onToggle }: { name: string; kept: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="mvt-keep"
      aria-pressed={kept}
      aria-label={kept ? `${name} is kept out of trades` : `Keep ${name} out of trades`}
      title={kept ? 'Kept' : 'Keep him'}
      onClick={onToggle}
    >
      {kept ? <LockSimple size={18} weight="fill" aria-hidden="true" /> : <LockSimpleOpen size={18} aria-hidden="true" />}
    </button>
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
  /** The Keep list and its switch: offers "Keep him" beside the players you give once the row is open. */
  keeper?: Keeper | null
  /** How the partner plays, as one quiet line under their name. */
  styleLine?: string
  /** The row's place in the list (1 is the best expected gain). */
  rank?: number
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
  keeper = null,
  styleLine,
  rank,
}: ItemProps) {
  const rounds = useRoundValues()
  const acc = ACCEPTANCE[t.acceptance_label]
  // Moves never offer a kept player, so a listed trade that gives one was kept a moment ago: the
  // offer is on its way out and dims until moves are updated.
  const keptOut = keeper ? t.give.filter((p) => keeper.keep.includes(p.id)) : []
  const expected = expectedGain(t.acceptance, t.playoff_pct_before, t.playoff_pct_after)
  const them =
    t.partner_playoff_pct_before != null && t.partner_playoff_pct_after != null
      ? { before: t.partner_playoff_pct_before, after: t.partner_playoff_pct_after }
      : null
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
                <span>{w}</span>
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
          {t.my_drop && (
            <li>
              You drop <PlayerInline player={t.my_drop} /> to make room.
            </li>
          )}
          {t.my_add && (
            <li>
              You send more than you get back: pick up <PlayerInline player={t.my_add} /> from free agency for the open
              spot. The odds above include him.
            </li>
          )}
          {t.their_drop && (
            <li>
              They would likely drop <PlayerInline player={t.their_drop} tail="." />
            </li>
          )}
          {extra}
        </ul>
        <BadgeNotes players={t.get} />
      </div>
      <ImpactBars changes={t.category_changes} label="Your weekly win chance per category" />
    </>
  )
  return (
    <li id={id} className={['mvt-item', open && 'open', keptOut.length > 0 && 'mvt-kept'].filter(Boolean).join(' ')}>
      {/* The row is a box, not a button, so the names inside can open player cards. The Details button
          stretches over the whole row (Trades.css), so a tap anywhere else still opens or closes it. */}
      <div className="mvt-row">
        {rank != null && (
          <span className="mvt-rank num" aria-hidden="true">
            {rank}
          </span>
        )}
        <div className="mvt-head">
          <TeamCrest name={t.partner_team_name} colour={colour} size={32} />
          <span className="mvt-team">
            <span className="mvt-team-line">
              <span className="mvt-partner">
                <span className="sr-only">Trade with </span>
                {t.partner_team_name}
              </span>
              {tag}
              {keptOut.length > 0 && (
                <span className="mvt-kept-tag">
                  <LockSimple size={12} weight="fill" aria-hidden="true" />
                  {open ? <KeptPlayers players={keptOut} face={false} /> : keptNames(keptOut.map((p) => p.name))}{' '}
                  {keptOut.length > 1 ? 'are' : 'is'} kept
                </span>
              )}
            </span>
            {styleLine && <span className="mvt-style">{styleLine}</span>}
          </span>
          <span className="mvt-accept" title="How offers like this one went in real leagues">
            <Handshake size={18} aria-hidden="true" />
            <span className={`mvt-accept-w ${acc.tone}`}>
              <span className="sr-only">chance they accept, </span>
              {acc.label}
            </span>
          </span>
        </div>
        <div className="mvt-deal">
          <RowLane end="give" players={t.give} extra={faab > 0 ? `+ $${faab} FAAB` : undefined} keeper={open ? keeper : null} />
          <div className="mvt-odds">
            <span className="mvt-odds-k">Your odds</span>
            <span className="mvt-odds-big num">{pct(t.playoff_pct_after)}</span>
            <span className="mvt-odds-from num">
              from {pct(t.playoff_pct_before)} <Delta before={t.playoff_pct_before} after={t.playoff_pct_after} />
            </span>
            {them && (
              <span className="mvt-odds-them num">
                Them {pct(them.before)} → {pct(them.after)} <Delta before={them.before} after={them.after} unit={false} />
              </span>
            )}
          </div>
          <RowLane end="get" players={t.get} />
        </div>
        <div className="mvt-foot">
          <button
            type="button"
            className="mvt-more"
            aria-expanded={open}
            aria-controls={`${id}-detail`}
            onClick={onToggle}
          >
            {open ? 'Hide details' : 'Show details'}{' '}
            <span className="sr-only">
              of the trade with {t.partner_team_name}: you give {t.give.map((p) => p.name).join(', ')}, you get{' '}
              {t.get.map((p) => p.name).join(', ')}
            </span>
            <CaretDown size={14} weight="bold" aria-hidden="true" />
          </button>
          <span className="mvt-exp">
            <span className="mvt-exp-l">Expected gain</span>
            <span className="mvt-exp-n num" aria-hidden="true">
              {expectedGainText(expected)}
            </span>
            <span className="sr-only">, {expectedGainSpoken(expected)}</span>
          </span>
        </div>
      </div>
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
    empty: "No trade raises both teams' playoff odds right now.",
    why: 'Why they might say yes',
  },
  edge: {
    label: 'Bold',
    hint: 'They win on paper, you win on the court, and their odds dip 3 points at most',
    empty: 'No deal gives them the paper win while raising your playoff odds right now.',
    why: 'Why it favors you',
  },
}

// With no Fair deal there is nothing to switch between, so the panel folds to one list or one line.
const BOLD_ONLY = "No deal lifts both teams' playoff odds today."
const NOTHING = 'No trade worth offering right now. Nothing raises your playoff odds that another team would take.'

interface TradesProps {
  fair: TradeIdea[]
  edge: TradeIdea[]
  categories?: string[]
  teams?: { id: number; name: string }[]
  myTeamId?: number
  /** Players these moves already leave out. */
  kept?: PlayerRef[]
  /** The answered untouchable question: one line with its Change, at the top of the list. */
  untouchable?: ReactNode
  /** The Keep list and its switch, for "Keep him" in an open trade. */
  keep?: number[]
  onToggleKeep?: (id: number) => void
  /** A quiet line on how each partner plays, by team id ("Door closed · declined 2, never traded"). */
  partnerStyles?: Map<number, string>
}

export function Trades({
  fair: allFair,
  edge: allEdge,
  categories = [],
  teams = [],
  myTeamId,
  kept = [],
  untouchable,
  keep,
  onToggleKeep,
  partnerStyles,
}: TradesProps) {
  const { rules } = useTradeRules()
  const fairSplit = useMemo(() => applyRules(rules, allFair), [rules, allFair])
  const edgeSplit = useMemo(() => applyRules(rules, allEdge), [rules, allEdge])
  const fair = fairSplit.kept
  const edge = edgeSplit.kept
  // Open on Fair when there's a deal that helps both teams, else on the Bold deals.
  const [mode, setMode] = useState<Mode>(allFair.length || !allEdge.length ? 'fair' : 'edge')
  const [showSkipped, setShowSkipped] = useState(false)
  const trades = mode === 'fair' ? fair : edge
  const skipped = (mode === 'fair' ? fairSplit : edgeSplit).skipped
  // Every row starts closed: the best move is already the lead; the user opens what they want.
  const [open, setOpen] = useState<string | null>(null)
  const keepRow = useKeepRowInView(open)
  const noFair = allFair.length === 0
  const keeper = useMemo(() => (keep && onToggleKeep ? { keep, onToggleKeep } : null), [keep, onToggleKeep])
  const nothing = noFair && allEdge.length === 0
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
    setOpen(null)
  }

  return (
    <section className="mvt-sec trades-panel" aria-labelledby="trades-title">
      <div className="mvt-h">
        <h2 id="trades-title" className="mvt-title">
          <Handshake size={20} aria-hidden="true" />
          Trades to offer
        </h2>
        {!noFair && (
          <div className="mvt-seg" role="group" aria-label="Trade style">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => choose(m)} title={MODES[m].hint}>
                {MODES[m].label} <span className="mvt-seg-n num">{(m === 'fair' ? fair : edge).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mvt-controls">
        {untouchable}
        {!nothing && (
          <>
            <RulesBar
              skipped={skipped.length}
              showSkipped={showSkipped}
              onShowSkipped={() => setShowSkipped(!showSkipped)}
              categories={categories}
              teams={teams}
              myTeamId={myTeamId}
              kept={kept}
            />
            {noFair && <p className="mvt-note">{BOLD_ONLY}</p>}
          </>
        )}
      </div>
      {trades.length === 0 && !(showSkipped && skipped.length) ? (
        <p className="mvt-note">{nothing ? NOTHING : MODES[mode].empty}</p>
      ) : (
        <>
          <ol className="mvt-list" onClickCapture={keepRow}>
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
                  keeper={keeper}
                  feedbackSource={mode === 'fair' ? 'trades' : 'edge'}
                  colour={colours.get(t.partner_team_id)}
                  teamCount={teams.length || undefined}
                  styleLine={partnerStyles?.get(t.partner_team_id)}
                  rank={i + 1}
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
                    keeper={keeper}
                    tag={<span className="skipped-pill">Skipped: {rule.label}</span>}
                    feedbackSource={mode === 'fair' ? 'trades' : 'edge'}
                    colour={colours.get(t.partner_team_id)}
                    teamCount={teams.length || undefined}
                    styleLine={partnerStyles?.get(t.partner_team_id)}
                  />
                )
              })}
          </ol>
        </>
      )}
    </section>
  )
}
