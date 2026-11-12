import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowUpRight,
  CalendarBlank,
  CaretRight,
  Clock,
  Handshake,
  Plus,
  Target,
  Trash,
  UserPlus,
  type Icon,
} from '@phosphor-icons/react'
import type { AnalysisReport, PickupIdea, PlayerRef } from '../api/client'
import { bestMoveOf, pickupKey } from '../lib/bestMove'
import { pct, possessive, ptsDiff } from '../lib/format'
import { teamColours } from '../lib/league'
import { ifMade, keptDays, lastName, longDay, shortDay, spotGames, waitLabel } from '../lib/moveTiming'
import { InjuryBadges } from './InjuryBadges'
import { SpotDays } from './MoveTiming'
import { Delta } from './OddsChange'
import { PickupClimb } from './PickupClimb'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { TeamCrest } from './TeamCrest'
import { ACCEPTANCE } from './Trades'
import './BestMove.css'

/** "MIL · PF": the NBA team code and positions, in the code face. */
function PlayerMeta({ player }: { player: PlayerRef }) {
  return (
    <span className="bm-meta code">
      {[player.pro_team, player.positions.join('/')].filter(Boolean).join(' · ')}
    </span>
  )
}

/**
 * One lane of the move: its label on its own line with a small direction icon ("You give ↗"),
 * then one row per player (team-lit face, name, injury, team and positions), then a note.
 */
export function Lane({
  label,
  icon: LaneIcon,
  players,
  note,
}: {
  label: string
  icon: Icon
  players: PlayerRef[]
  note?: ReactNode
}) {
  return (
    <div className="bm-lane">
      <div className="bm-lane-label">
        <LaneIcon size={14} weight="bold" aria-hidden="true" />
        {label}
      </div>
      <ul className="bm-players">
        {players.map((p) => (
          <li key={p.id} className="bm-player">
            <PlayerLink player={p} decorative>
              <PlayerHead player={p} size={44} team={p.pro_team} />
            </PlayerLink>
            <span className="bm-player-text">
              <span className="bm-name">
                <PlayerLink player={p} after={<InjuryBadges players={[p]} />} />
              </span>
              <PlayerMeta player={p} />
            </span>
          </li>
        ))}
      </ul>
      {note && <div className="bm-note small muted">{note}</div>}
    </div>
  )
}

/**
 * The two biggest gains and costs in weekly win chance, as small chips with an outcome edge.
 * With ``against``, the changes are this week's matchup against that team, and a category
 * still close this week (one the move can steal) carries a small target.
 */
function TopChanges({
  changes,
  against,
  close = [],
}: {
  changes: Record<string, number>
  against?: { name: string; colour?: string }
  close?: string[]
}) {
  const moved = Object.entries(changes)
    .map(([c, v]) => [c, Math.round(v * 100)] as const)
    .filter(([, v]) => Math.abs(v) >= 2)
  const gains = moved.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2)
  const costs = moved.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2)
  if (!gains.length && !costs.length) return null
  const item = ([c, v]: readonly [string, number]) => {
    const steal = v > 0 && close.includes(c)
    return (
      <li
        key={c}
        className={v > 0 ? 'bm-chip good' : 'bm-chip bad'}
        title={steal ? `${c} is close: a category you can steal` : undefined}
      >
        <span className="bm-chip-cat code">
          {steal && <Target size={12} weight="bold" className="bm-steal" aria-hidden="true" />}
          {c}
        </span>
        <span className="num">
          <Delta value={v} />
        </span>
        {steal && <span className="sr-only">, close, a category you can steal</span>}
      </li>
    )
  }
  if (against) {
    return (
      <div className="bm-changes-wrap">
        <div className="kpi-label bm-vs">
          This week vs <TeamCrest name={against.name} colour={against.colour} size={16} />
          <b>{against.name}</b>
        </div>
        <ul className="bm-changes" aria-label={`This week against ${against.name}, change in win chance, in points`}>
          {gains.map(item)}
          {costs.map(item)}
          <li className="bm-unit" aria-hidden="true">
            win chance, pts
          </li>
        </ul>
      </div>
    )
  }
  return (
    <div className="bm-changes-wrap">
      <div className="kpi-label">Weekly win chance, pts</div>
      <ul className="bm-changes" aria-label="Weekly win chance, in points">
        {gains.map(item)}
        {costs.map(item)}
      </ul>
    </div>
  )
}

// Bits of confetti around the new odds: [left px, top px, turn deg].
const BITS: [number, number, number][] = [
  [150, 8, 20],
  [176, 0, -30],
  [205, 14, 45],
  [232, 4, 10],
  [250, 26, -15],
  [140, 58, 60],
  [262, 52, 30],
]
const played = new Set<string>()

/** A short burst when a move raises your odds: plays once per move per visit, for 0.9s, then is removed. */
function Confetti({ id }: { id: string }) {
  const [on, setOn] = useState(() => !played.has(id))
  useEffect(() => {
    if (!on) return
    played.add(id)
    const t = setTimeout(() => setOn(false), 1000)
    return () => clearTimeout(t)
  }, [id, on])
  if (!on) return null
  return (
    <span className="bm-confetti" aria-hidden="true">
      {BITS.map(([x, y, r], k) => (
        <i key={k} style={{ left: x, top: y, rotate: `${r}deg`, animationDelay: `${k * 40}ms` }} />
      ))}
    </span>
  )
}

/** Odds before and after, then a meter: grey is now, green the gain (red a loss), the notch is the playoff line. */
export function OddsMeter({
  before,
  after,
  celebrate,
  label = 'Your playoff odds',
}: {
  before: number
  after: number
  celebrate?: string
  label?: string
}) {
  const diff = ptsDiff(before, after)
  const lo = Math.min(before, after)
  return (
    <div className="big-odds">
      <div className="bm-figures">
        <div className="kpi-label">{label}</div>
        <div className="big-odds-figures num">
          <span className="before">{pct(before)}</span>
          <span className="muted" aria-label="to">
            →
          </span>
          <span className="after">{pct(after)}</span>
          <span className={diff >= 0 ? 'bm-delta good' : 'bm-delta bad'}>
            <Delta value={diff} unit="pts" />
          </span>
        </div>
        {celebrate && diff > 0 && <Confetti id={celebrate} />}
      </div>
      <div className="bm-meter-wrap" aria-hidden="true">
        <div className="bm-meter">
          <span className="bm-base" style={{ width: pct(lo) }} />
          <span
            className={after >= before ? 'bm-gain' : 'bm-gain bm-loss'}
            style={{ left: pct(lo), width: pct(Math.abs(after - before)) }}
          />
          <span className="bm-notch" />
        </div>
        <div className="bm-scale num">
          <span>0</span>
          <span className="bm-mid">50 · line</span>
          <span>100</span>
        </div>
      </div>
    </div>
  )
}

export function BestMove({
  report,
  scout,
  actions,
}: {
  report: AnalysisReport
  /** The team being scouted in the sample league: its name replaces "you" and "your" everywhere. */
  scout?: string
  /** Buttons in place of the ESPN ones (the sample's door to your own league). */
  actions?: ReactNode
}) {
  const best = bestMoveOf(report)
  const owner = scout ? possessive(scout) : 'Your'
  const whose = scout ? possessive(scout) : 'your'
  const league = report.league
  const colours = teamColours(
    report.season.map((r) => r.team_id),
    report.team_id,
  )

  if (best.kind === 'hold') {
    return (
      <section className="card best">
        <header className="bm-head">
          <h2 className="bm-title">
            <Target size={20} weight="duotone" aria-hidden="true" />
            Best move: hold for now
          </h2>
        </header>
        <p className="muted">
          No single trade or pickup clearly raises {whose} playoff odds right now. Check back after the next games.
        </p>
      </section>
    )
  }

  if (best.kind === 'pickup') {
    return <BestPickup report={report} pickup={best.pickup} colours={colours} scout={scout} actions={actions} />
  }
  const trade = best.trade

  const theirs = colours.get(trade.partner_team_id)
  const acc = ACCEPTANCE[trade.acceptance_label]
  const theyBefore = trade.partner_playoff_pct_before
  const theyAfter = trade.partner_playoff_pct_after
  return (
    <section className="card best" aria-labelledby="best-title">
      <header className="bm-head">
        <h2 className="bm-title" id="best-title">
          <Target size={20} weight="duotone" aria-hidden="true" />
          Best move
        </h2>
        <span className="bm-accept" title={`${pct(trade.acceptance)} chance they accept`}>
          <Handshake size={20} aria-hidden="true" />
          <span className="bm-accept-n num">{pct(trade.acceptance)}</span>
          <span className={`bm-accept-word ${acc.tone}`}>{acc.label}</span>
        </span>
        <span className="bm-partner">
          <TeamCrest name={trade.partner_team_name} colour={theirs} size={20} />
          Trade with {trade.partner_team_name}
        </span>
      </header>
      <div className="bm-lanes">
        <Lane
          label={scout ? 'Give' : 'You give'}
          icon={ArrowUpRight}
          players={trade.give}
          note={
            trade.my_drop && (
              <>
                <Trash size={13} aria-hidden="true" /> and drop {trade.my_drop.name}
              </>
            )
          }
        />
        <Lane
          label={scout ? 'Get' : 'You get'}
          icon={ArrowDownLeft}
          players={trade.get}
          note={
            trade.my_add && (
              <>
                <Plus size={13} aria-hidden="true" /> and add {trade.my_add.name} from free agency
              </>
            )
          }
        />
      </div>
      <OddsMeter
        before={trade.playoff_pct_before}
        after={trade.playoff_pct_after}
        label={`${owner} playoff odds`}
        celebrate={`trade-${trade.partner_team_id}-${[...trade.give, ...trade.get].map((p) => p.id).join('-')}`}
      />
      {theyBefore != null && theyAfter != null && (
        <p className="bm-them small">
          <TeamCrest name={trade.partner_team_name} colour={theirs} size={16} />
          <span>{trade.partner_team_name}</span>
          <span className="num">{pct(theyBefore)}</span>
          <ArrowRight size={11} weight="bold" aria-hidden="true" className="muted" />
          <b className="num">{pct(theyAfter)}</b>
          <span className={theyAfter >= theyBefore ? 'num good' : 'num bad'}>
            <Delta value={ptsDiff(theyBefore, theyAfter)} />
          </span>
          {theyAfter > theyBefore && <span className="muted">· they win too</span>}
        </p>
      )}
      <TopChanges changes={trade.category_changes} />
      {actions ?? (
        <div className="bm-actions">
          <a
            className="button"
            href={`https://fantasy.espn.com/basketball/team?leagueId=${league.id}&teamId=${trade.partner_team_id}&seasonId=${league.season}`}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
            Open their team
          </a>
          <a className="button ghost" href="#trade-0">
            See the pitch
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  )
}

/** Best move as a free-agent pickup: when to make it, who it replaces, and the odds. */
function BestPickup({
  report,
  pickup,
  colours,
  scout,
  actions,
}: {
  report: AnalysisReport
  pickup: PickupIdea
  colours: Map<number, string>
  scout?: string
  actions?: ReactNode
}) {
  const owner = scout ? possessive(scout) : 'Your'
  const t = pickup.timing
  const wait = t?.wait ? t : null
  const week = report.week
  const kept = wait ? keptDays(wait) : []
  const games = wait ? spotGames(wait) : null
  const lost = wait ? wait.drop_games_kept : 0
  // A waiver claim that goes through tomorrow or later: when the player joins.
  const joins = t && !wait && t.days[0] && t.earliest_on > t.days[0].date ? t.earliest_on : null
  const adds = week?.adds_allowed != null ? Math.max(week.adds_allowed - week.adds_used, 0) : null
  const opponent = week ? { name: week.opponent_name, colour: colours.get(week.opponent_team_id) } : undefined
  const thisWeek = t && opponent && Object.keys(t.week_changes).length > 0
  const espn = `https://fantasy.espn.com/basketball/players/add?leagueId=${report.league.id}`
  return (
    <section className="card best" aria-labelledby="best-title" aria-describedby={wait ? 'best-when' : undefined}>
      <header className="bm-head">
        <h2 className="bm-title" id="best-title">
          <Target size={20} weight="duotone" aria-hidden="true" />
          Best move
        </h2>
        {wait ? (
          <p className="bm-when" id="best-when">
            <span className="bm-when-main">
              <CalendarBlank size={15} aria-hidden="true" />
              {waitLabel(wait)}
            </span>
            <span>· No one has to agree</span>
            {games && (
              <span className="sr-only">
                . Waiting lets {pickup.drop.name} play {kept.map((d) => longDay(d.date)).join(' and ')} first:{' '}
                {games.best} games in the roster spot instead of {games.now}.
              </span>
            )}
          </p>
        ) : (
          <span className="bm-sub muted">No one has to agree</span>
        )}
      </header>
      <PickupClimb
        add={pickup.add}
        drop={pickup.drop}
        before={pickup.playoff_pct_before}
        after={pickup.playoff_pct_after}
        others={report.pickups
          .filter((p) => !p.open_spot_by_trade && pickupKey(p) !== pickupKey(pickup))
          .map((p) => p.playoff_pct_after)}
        label={wait ? `${owner} playoff odds ${ifMade(wait)}` : `${owner} playoff odds`}
        owner={owner}
        addNote={`${pickup.availability === 'WAIVERS' ? 'On waivers' : 'Free agent'} · ${Math.round(pickup.add.percent_owned)}% owned${pickup.stream ? ' · For this week' : ''}`}
        dropNote={
          kept.length > 0 ? (
            <span>
              Plays{' '}
              {kept.map((d, k) => (
                <span key={d.date}>
                  {k > 0 && (k === kept.length - 1 ? ' and ' : ', ')}
                  <b>{shortDay(d.date)}</b>
                </span>
              ))}{' '}
              for {scout ?? 'you'} first
            </span>
          ) : undefined
        }
      />
      {wait && <SpotDays timing={wait} add={pickup.add} drop={pickup.drop} />}
      {thisWeek ? (
        <TopChanges changes={t.week_changes} against={opponent} close={week?.close_categories} />
      ) : (
        <TopChanges changes={pickup.category_changes} />
      )}
      {actions ?? (
        <div className="bm-actions">
          {wait ? (
            <a
              className="button bm-quiet"
              href={espn}
              target="_blank"
              rel="noreferrer"
              aria-label={`Claim ${pickup.add.name} now anyway on ESPN. Loses ${lost} ${lastName(pickup.drop.name)} ${lost === 1 ? 'game' : 'games'}. Opens ESPN.`}
            >
              <span className="bm-quiet-main">
                Claim now anyway
                <ArrowSquareOut size={14} weight="bold" aria-hidden="true" />
              </span>
              <span className="bm-quiet-sub">
                Loses <span className="num">{lost}</span> {lastName(pickup.drop.name)} {lost === 1 ? 'game' : 'games'}
              </span>
            </a>
          ) : (
            <a className="button" href={espn} target="_blank" rel="noreferrer">
              <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
              Make the claim on ESPN
            </a>
          )}
          <a className="button ghost" href="#pickup-0">
            All FA targets
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </a>
        </div>
      )}
      {(wait || joins || adds != null) && (
        <p className="bm-foot">
          {wait ? (
            <span>
              <UserPlus size={14} aria-hidden="true" />
              Someone could add him first
            </span>
          ) : joins ? (
            <span>
              <Clock size={14} aria-hidden="true" />
              Processes {shortDay(joins)}
            </span>
          ) : (
            <span />
          )}
          {adds != null && (
            <span className="bm-adds">
              <span className="num">{adds}</span> of {week?.adds_allowed} adds left
            </span>
          )}
        </p>
      )}
    </section>
  )
}
