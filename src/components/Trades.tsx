import { useContext, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CaretDown,
  Coins,
  Handshake,
  Info,
  LockSimple,
  LockSimpleOpen,
  UserMinus,
  UserPlus,
  Warning,
} from '@phosphor-icons/react'
import { teamColours } from '../lib/league'
import { TeamCrest } from './TeamCrest'
import type { FeedbackSource, PickupIdea, PlayerRef, TradeIdea } from '../api/client'
import { ordinal, pct, ptsDiff, signed, signedInt, tradeKey } from '../lib/format'
import { PlayerHead } from './PlayerHead'
import { InjuryBadges } from './InjuryBadges'
import { BadgeNotes } from './PlayerBadges'
import { premiumValue, shortValue, useRoundValues, type RoundValues } from '../lib/tradeValue'
import type { CheckDeal } from '../lib/tradeCheck'
import { CatStrip } from './CatStrip'
import { MaybeHandshake } from './MaybeHandshake'
import { TheirSide } from './TradeTable'
import { FeedbackContext, TradeFeedback, ratingLabel, useMyFeedback } from './TradeFeedback'
import { RulesBar, useTradeRules } from './TradeRules'
import { applyRules } from '../lib/tradeRules'
import { useKeepRowInView } from '../lib/useKeepRowInView'
import './Trades.css'
import { PlayerLink } from './PlayerCard'
import { KeptPlayers, PlayerInline } from './PlayerInline'
import { expectedGain, expectedGainSpoken, expectedGainText } from '../lib/expectedGain'
import { keptNames } from '../lib/untouchable'
import { AcceptChance } from './AcceptChance'

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
  /** FAAB dollars sent with the players. */
  faab?: number
  tag?: ReactNode
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
  /** The league's categories, for the weekly win chance strip. */
  categories?: string[]
  /** The free agent moves, to name who a trade is measured against. */
  pickups?: Pick<PickupIdea, 'add' | 'drop'>[]
  /** Opens Check a Trade with this deal, as one you send. */
  onCheck?: (deal: CheckDeal) => void
}

type Fact = NonNullable<TradeIdea['facts']>[number]

/** The player a fact is about, as a card link. */
const named = (f: Fact): PlayerRef | null =>
  f.player_name && f.player_id ? ({ id: f.player_id, name: f.player_name } as PlayerRef) : null

// Facts with a number go in "Their side of the deal"; the paper win is already its "On paper" row.
const FACT_ROWS = new Set<Fact['kind']>([
  'sell_high',
  'buy_low',
  'players_out',
  'roster_squeeze',
  'chasing',
  'punt_cost',
  'keystone_lost',
  'punt_theirs',
])
const FACT_HIDDEN = new Set<Fact['kind']>(['paper_win', 'consolidate'])

/** One fact as a row of Their side of the deal: what it is on the left, its number on the right. */
function FactRow({ fact: f, rounds }: { fact: Fact; rounds: RoundValues }) {
  const p = named(f)
  const cats = (f.categories ?? []).join(' · ')
  const value = (x: number, given?: string | null) => (rounds ? shortValue(x, rounds) : given || shortValue(x, rounds))
  let label: ReactNode
  let figure: ReactNode
  switch (f.kind) {
    case 'sell_high':
    case 'buy_low':
      label = (
        <>
          {f.kind === 'sell_high' ? 'Sell high on' : 'Buy low on'} {p ? <PlayerInline player={p} /> : 'him'}
        </>
      )
      figure = (
        <>
          {value(f.owners_value ?? 0, f.owners_label)} <small>paid</small> · {value(f.our_value ?? 0, f.our_label)}{' '}
          <small>worth</small>
        </>
      )
      break
    case 'players_out':
      label = 'Short-handed'
      figure = (
        <>
          {f.count ?? 0} <small>{f.count === 1 ? 'player out' : 'players out'}</small>
        </>
      )
      break
    case 'roster_squeeze':
      label = 'Roster squeeze'
      figure = (
        <>
          {f.count ?? 1} <small>{(f.count ?? 1) === 1 ? 'player they cut' : 'players they cut'}</small>
        </>
      )
      break
    case 'chasing':
      label = 'Chasing a playoff spot'
      figure =
        f.rank && f.teams ? (
          <>
            {ordinal(f.rank)}{' '}
            <small>
              of {f.teams}
              {f.playoff_spots ? ` · top ${f.playoff_spots} make it` : ''}
            </small>
          </>
        ) : (
          <small>outside the spots</small>
        )
      break
    case 'punt_cost':
      label = 'Costs them only punts'
      figure = cats
      break
    case 'keystone_lost':
      label = 'Takes their keystone'
      figure = cats
      break
    default:
      label = p ? (
        <>
          <PlayerInline player={p} /> is wasted on them
        </>
      ) : (
        'Wasted on them'
      )
      figure = (
        <>
          <small>they punt</small> {cats}
        </>
      )
  }
  return (
    <div>
      <dt>{label}</dt>
      <dd className="num">{figure}</dd>
    </div>
  )
}

interface Note {
  key: string
  icon: ReactNode
  body: ReactNode
  warn?: boolean
}

const ICON = { size: 18, 'aria-hidden': true } as const

/** The deal's notes, each a line with its mark: caveats, the roster moves, then what the odds are measured against. */
function dealNotes(t: TradeIdea, rounds: RoundValues, pickups: Pick<PickupIdea, 'add' | 'drop'>[]): Note[] {
  const notes: Note[] = []
  for (const w of t.warnings ?? []) notes.push({ key: `w-${w}`, icon: <Warning {...ICON} />, body: w, warn: true })
  if (t.my_drop)
    notes.push({
      key: 'my-drop',
      icon: <UserMinus {...ICON} />,
      body: (
        <>
          You drop <PlayerInline player={t.my_drop} /> to make room.
        </>
      ),
    })
  if (t.my_add)
    notes.push({
      key: 'my-add',
      icon: <UserPlus {...ICON} />,
      body: (
        <>
          Pick up <PlayerInline player={t.my_add} /> for the open spot. The odds include him.
        </>
      ),
    })
  const facts = (t.facts ?? []).filter((f) => !FACT_HIDDEN.has(f.kind) && !FACT_ROWS.has(f.kind))
  for (const f of facts) {
    const p = named(f)
    if (f.kind === 'vs_pickup' && p) {
      const drop = pickups.find((x) => x.add.id === p.id)?.drop
      notes.push({
        key: `f-${f.kind}`,
        icon: <Info {...ICON} />,
        body: (
          <>
            Odds vs. just adding <PlayerInline player={p} />
            {drop && (
              <>
                {' '}
                for <PlayerInline player={drop} />
              </>
            )}
          </>
        ),
      })
    } else if (f.kind === 'punt_mine' && p) {
      notes.push({
        key: `f-${f.kind}-${p.id}`,
        icon: <Info {...ICON} />,
        body: (
          <>
            <PlayerInline player={p} tail="'s" /> value is mostly {(f.categories ?? []).join(', ')}, which you punt.
          </>
        ),
      })
    } else {
      notes.push({ key: `f-${f.kind}-${f.text}`, icon: f.kind === 'faab' ? <Coins {...ICON} /> : <Info {...ICON} />, body: f.text })
    }
  }
  if (t.their_drop)
    notes.push({
      key: 'their-drop',
      icon: <UserMinus {...ICON} />,
      body: (
        <>
          They would likely drop <PlayerInline player={t.their_drop} tail="." />
        </>
      ),
    })
  if (t.facts?.some((f) => f.kind === 'roster_squeeze'))
    notes.push({
      key: 'squeeze',
      icon: <Handshake {...ICON} />,
      body: 'A roster squeeze deal is accepted about half as often as a 1-for-1.',
    })
  if (t.owner_premium >= 0.5)
    notes.push({
      key: 'premium',
      icon: <Info {...ICON} />,
      body: `Their side includes a ${premiumValue(t.owner_premium, t.value_they_give, rounds)} owner premium on what they send.`,
    })
  // Ideas saved before facts existed carry their points only as sentences.
  if (!t.facts) for (const r of t.reasons) notes.push({ key: `r-${r}`, icon: <Info {...ICON} />, body: r })
  return notes
}

/** One expandable trade row: the summary line, then the pitch, their side, the category strip and notes. */
export function TradeItem({
  trade: t,
  id,
  open,
  onToggle,
  faab = 0,
  tag,
  feedbackSource,
  colour,
  teamCount,
  keeper = null,
  styleLine,
  rank,
  categories = [],
  pickups = [],
  onCheck,
}: ItemProps) {
  const rounds = useRoundValues()
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
  const myCats = t.my_cats_gain
  const notes = dealNotes(t, rounds, pickups)
  const overview = (
    <>
      <TheirSide
        partner={t.partner_team_name}
        pitch={t.pitch}
        needs={t.pitch_needs}
        teams={teamCount}
        valueGet={t.value_they_get}
        valueGive={t.value_they_give}
        theirCats={t.their_cats_gain}
        rounds={rounds}
        facts={(t.facts ?? [])
          .filter((f) => FACT_ROWS.has(f.kind))
          .map((f) => (
            <FactRow key={`${f.kind}-${f.player_id ?? ''}-${f.text}`} fact={f} rounds={rounds} />
          ))}
        actions={
          onCheck && (
            <button
              type="button"
              className="tt-btn"
              onClick={() =>
                onCheck({
                  partner: t.partner_team_id,
                  give: t.give.map((p) => p.id),
                  get: t.get.map((p) => p.id),
                  mode: 'sending',
                  cut: t.my_drop?.id ?? null,
                })
              }
            >
              <MaybeHandshake size={18} />
              Check This Trade
            </button>
          )
        }
      />
      <div className="mvt-aside">
        <CatStrip
          changes={t.category_changes}
          categories={categories.length ? categories : undefined}
          title="Your weekly win chance"
          summary={
            <>
              <span className={`num mvt-cats ${myCats > 0 ? 'good' : myCats < 0 ? 'bad' : ''}`}>{signed(myCats)}</span>{' '}
              categories won a week
            </>
          }
        />
        {notes.length > 0 && (
          <ul className="mvt-notes">
            {notes.map((n) => (
              <li key={n.key} className={n.warn ? 'mvt-notes-warn' : undefined}>
                {n.icon}
                <span>{n.body}</span>
              </li>
            ))}
          </ul>
        )}
        <BadgeNotes players={t.get} />
      </div>
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
          <AcceptChance p={t.acceptance} className="mvt-accept" />
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
      {open && (
        <div className="mvt-detail" id={`${id}-detail`}>
          {tabs && (
            <div className="mvt-tabs" role="tablist" aria-label="Trade details">
              <button
                type="button"
                role="tab"
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
                id={`${id}-tab-feedback`}
                aria-selected={panel === 'feedback'}
                aria-controls={`${id}-panel-feedback`}
                onClick={() => setPanel('feedback')}
              >
                Feedback
                {saved && <span className={`feedback-pill ${saved.rating}`}>{ratingLabel(saved.rating)}</span>}
              </button>
            </div>
          )}
          {!tabs || panel === 'overview' ? (
            <div
              className="mvt-body"
              role={tabs ? 'tabpanel' : undefined}
              id={tabs ? `${id}-panel-overview` : undefined}
              aria-labelledby={tabs ? `${id}-tab-overview` : undefined}
            >
              {overview}
            </div>
          ) : (
            <div
              className="mvt-fb"
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

const MODES: Record<Mode, { label: string; hint: string; empty: string }> = {
  fair: {
    label: 'Fair',
    hint: "They win on paper and their odds dip a point at most, or both teams' odds rise",
    empty: 'No fair trade raises your playoff odds right now.',
  },
  edge: {
    label: 'Bold',
    hint: 'They win on paper, you win on what you know. Their odds dip 3 points at most, 5 on a sell-high or buy-low',
    empty: 'No deal gives them the paper win while raising your playoff odds right now.',
  },
}

// With no Fair deal there is nothing to switch between, so the panel folds to one list or one line.
const BOLD_ONLY = 'No fair trade raises your playoff odds today.'
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
  /** The free agent moves, to name who a trade is measured against. */
  pickups?: Pick<PickupIdea, 'add' | 'drop'>[]
  /** Opens Check a Trade with a deal from the list. */
  onCheck?: (deal: CheckDeal) => void
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
  pickups,
  onCheck,
}: TradesProps) {
  const { rules } = useTradeRules()
  const fairSplit = useMemo(() => applyRules(rules, allFair), [rules, allFair])
  const edgeSplit = useMemo(() => applyRules(rules, allEdge), [rules, allEdge])
  const fair = fairSplit.kept
  const edge = edgeSplit.kept
  // Open on Fair when there's a fair deal, else on the Bold deals.
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
                  keeper={keeper}
                  feedbackSource={mode === 'fair' ? 'trades' : 'edge'}
                  colour={colours.get(t.partner_team_id)}
                  teamCount={teams.length || undefined}
                  styleLine={partnerStyles?.get(t.partner_team_id)}
                  rank={i + 1}
                  categories={categories}
                  pickups={pickups}
                  onCheck={onCheck}
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
                      keeper={keeper}
                    tag={<span className="skipped-pill">Skipped: {rule.label}</span>}
                    feedbackSource={mode === 'fair' ? 'trades' : 'edge'}
                    colour={colours.get(t.partner_team_id)}
                    teamCount={teams.length || undefined}
                    styleLine={partnerStyles?.get(t.partner_team_id)}
                    categories={categories}
                    pickups={pickups}
                    onCheck={onCheck}
                  />
                )
              })}
          </ol>
        </>
      )}
    </section>
  )
}
