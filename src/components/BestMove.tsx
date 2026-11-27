import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownLeft,
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
import { pct, possessive, ptsDiff, signedInt } from '../lib/format'
import { teamColours } from '../lib/league'
import { ifMade, keptDays, lastName, longDay, shortDay, spotGames, waitLabel } from '../lib/moveTiming'
import { InjuryBadges } from './InjuryBadges'
import { SpotDays } from './MoveTiming'
import { PickupClimb } from './PickupClimb'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { PlayerInline } from './PlayerInline'
import { TeamCrest } from './TeamCrest'
import { ACCEPTANCE } from './Trades'
import './BestMove.css'

/** "MIL · PF": the NBA team code and positions, with an optional note after them. */
function meta(player: PlayerRef, note?: string) {
  return [player.pro_team, player.positions.join('/'), note].filter(Boolean).join(' · ')
}

/**
 * One side of the move, in the lead's two weights. "big": the player who comes in (a 72px team-lit
 * face, the name at 28px). "small": the one who goes (a 44px face, the name at 15px in the second ink).
 */
export function Lane({
  label,
  icon: LaneIcon,
  players,
  weight,
  note,
  info,
}: {
  label: string
  icon: Icon
  players: PlayerRef[]
  weight: 'big' | 'small'
  /** A line under the lane: "and drop X", "Plays Sat for you first". */
  note?: ReactNode
  /** Words after team and positions on the first player ("On waivers · 39% owned"). */
  info?: string
}) {
  const many = players.length > 1
  return (
    <div className={`mvl-lane mvl-${weight}${many ? ' mvl-many' : ''}`}>
      <ul className="mvl-players">
        {players.map((p, i) => (
          <li key={p.id} className="mvl-player">
            <span className="mvl-face">
              <PlayerLink player={p} decorative>
                <PlayerHead player={p} size={weight === 'big' ? (many ? 56 : 72) : 44} team={p.pro_team} />
              </PlayerLink>
            </span>
            <span className="mvl-who">
              {i === 0 && (
                <span className="bm-lane-label">
                  <LaneIcon size={14} weight="bold" aria-hidden="true" />
                  {label}
                </span>
              )}
              <span className="mvl-name-row">
                <span className="mvl-name">
                  <PlayerLink player={p} after={<InjuryBadges players={[p]} />} />
                </span>
                <span className="mvl-meta">{meta(p, i === 0 ? info : undefined)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
      {note && <div className="bm-note">{note}</div>}
    </div>
  )
}

const CATEGORY_WORDS: Record<string, string> = {
  'FG%': 'field goal %',
  'FT%': 'free throw %',
  '3PM': 'threes',
  REB: 'rebounds',
  AST: 'assists',
  STL: 'steals',
  BLK: 'blocks',
  TO: 'turnovers',
  PTS: 'points',
}

/**
 * The two biggest gains and costs in weekly win chance, as bare signed numbers after their code
 * ("STL +7 · REB −2 pts"). With ``against``, the changes are this week's matchup against that team,
 * and a category still close this week (one the move can steal) carries a small target.
 */
function WeekLine({
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
  const shown = [...gains, ...costs]
  if (!shown.length) return null
  const said = shown.map(([c, v]) => `${CATEGORY_WORDS[c] ?? c} ${v > 0 ? 'up' : 'down'} ${Math.abs(v)}`).join(', ')
  const label = against ? `This week against ${against.name}: ${said} points` : `Weekly win chance: ${said} points`
  return (
    <p className="mvl-week" aria-label={label}>
      {against ? (
        <span className="mvl-week-k mvl-vs">
          This week vs <TeamCrest name={against.name} colour={against.colour} size={16} />
          <b>{against.name}</b>
        </span>
      ) : (
        <span className="mvl-week-k">Weekly win chance</span>
      )}
      {shown.map(([c, v]) => {
        const steal = v > 0 && close.includes(c)
        return (
          <span key={c} className="mvl-wk" title={steal ? `${c} is close: a category you can steal` : undefined}>
            <span className="mvl-wk-c">
              {steal && <Target size={12} weight="bold" className="mvl-steal" aria-hidden="true" />}
              {c}
            </span>
            <span className={`mvl-wk-v num ${v > 0 ? 'good' : 'bad'}`}>{signedInt(v)}</span>
          </span>
        )
      })}
      <span className="mvl-week-k">pts</span>
    </p>
  )
}

// Bits of confetti around the new odds: [left %, top px, turn deg].
const BITS: [number, number, number][] = [
  [52, 8, 20],
  [58, 0, -30],
  [66, 14, 45],
  [73, 4, 10],
  [78, 26, -15],
  [49, 58, 60],
  [81, 52, 30],
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
        <i key={k} style={{ left: `${x}%`, top: y, rotate: `${r}deg`, animationDelay: `${k * 40}ms` }} />
      ))}
    </span>
  )
}

/** The lead's head: the target icon, "Best move", and what sits beside it. */
function Head({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mvl-h">
      <h2 className="mvl-title" id="best-title">
        <Target size={20} aria-hidden="true" />
        Best move
      </h2>
      {children}
      {right}
    </header>
  )
}

/**
 * The lead: the only lifted surface on the first screen. The move on the left, the calm odds chart
 * on the right, and the season as its foot band (``foot``). Below 900px it is one column with the
 * chart between the move's players and its week line.
 */
function Lead({
  className = '',
  children,
  chart,
  foot,
  describedBy,
}: {
  className?: string
  children: ReactNode
  chart?: ReactNode
  foot?: ReactNode
  describedBy?: string
}) {
  return (
    <section
      className={`card best mvl ${className}`.trim()}
      aria-labelledby="best-title"
      aria-describedby={describedBy}
    >
      <div className="mvl-grid">
        <div className="mvl-move">{children}</div>
        {chart && <div className="mvl-chart">{chart}</div>}
        {foot}
      </div>
    </section>
  )
}

export function BestMove({
  report,
  scout,
  actions,
  foot,
}: {
  report: AnalysisReport
  /** The team being scouted in the sample league: its name replaces "you" and "your" everywhere. */
  scout?: string
  /** Buttons in place of the ESPN ones (the sample's door to your own league). */
  actions?: ReactNode
  /** The lead's foot band: the season outlook. */
  foot?: ReactNode
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
    const me = report.season.find((r) => r.team_id === report.team_id)
    return (
      <Lead className="mvl-hold" foot={foot}>
        <Head>
          <span className="mvl-sub">Hold for now</span>
        </Head>
        <div className="mvl-flat">
          <span className="mvl-flat-line" aria-hidden="true" />
          <p className="mvl-flat-say">
            {me && (
              <>
                <b className="num">{pct(me.playoff_pct)}</b> today ·{' '}
              </>
            )}
            No move raises {whose} odds today
          </p>
        </div>
        <p className="mvl-hold-say muted">{scout ? 'Scout another team below.' : 'Check back after the next games.'}</p>
      </Lead>
    )
  }

  if (best.kind === 'pickup') {
    return (
      <BestPickup report={report} pickup={best.pickup} colours={colours} scout={scout} actions={actions} foot={foot} />
    )
  }
  const trade = best.trade

  const theirs = colours.get(trade.partner_team_id)
  const acc = ACCEPTANCE[trade.acceptance_label]
  const theyBefore = trade.partner_playoff_pct_before
  const theyAfter = trade.partner_playoff_pct_after
  const before = trade.playoff_pct_before
  const after = trade.playoff_pct_after
  const theyDiff = theyBefore != null && theyAfter != null ? ptsDiff(theyBefore, theyAfter) : null
  return (
    <Lead
      className="mvl-trade"
      foot={foot}
      chart={
        <>
          {/* The same calm chart as a pickup: one line, no strands, the player you get at its end. */}
          <PickupClimb
            add={trade.get[0]}
            drop={trade.give[0]}
            before={before}
            after={after}
            others={[]}
            label={`${owner} playoff odds`}
            owner={owner}
            lanes={false}
          />
          {ptsDiff(before, after) > 0 && (
            <Confetti
              id={`trade-${trade.partner_team_id}-${[...trade.give, ...trade.get].map((p) => p.id).join('-')}`}
            />
          )}
          {theyBefore != null && theyAfter != null && theyDiff != null && (
            <p className="mvl-them">
              <TeamCrest name={trade.partner_team_name} colour={theirs} size={16} />
              <span>{trade.partner_team_name}</span>
              <span className="num">
                {pct(theyBefore)} → <b>{pct(theyAfter)}</b>
              </span>
              <span className={`num mvl-them-d ${theyDiff >= 0 ? 'good' : 'bad'}`}>
                {theyDiff !== 0 && (
                  <span className="mvl-ar" aria-hidden="true">
                    {theyDiff > 0 ? '▲' : '▼'}
                  </span>
                )}
                {signedInt(theyDiff)}
              </span>
              {theyAfter > theyBefore && <span className="muted">· they win too</span>}
            </p>
          )}
        </>
      }
    >
      <Head
        right={
          <span className="mvl-accept" title="How offers like this one went in real leagues">
            <Handshake size={18} aria-hidden="true" />
            <span className={`mvl-accept-w ${acc.tone}`}>
              <span className="sr-only">chance they accept, </span>
              {acc.label}
            </span>
          </span>
        }
      >
        <span className="mvl-sub mvl-partner">
          <TeamCrest name={trade.partner_team_name} colour={theirs} size={16} />
          Trade with {trade.partner_team_name}
        </span>
      </Head>
      <Lane
        label={scout ? 'Get' : 'You get'}
        icon={ArrowDownLeft}
        players={trade.get}
        weight="big"
        note={
          trade.my_add && (
            <>
              <Plus size={13} aria-hidden="true" />
              <span>
                and add <PlayerInline player={trade.my_add} /> from free agency
              </span>
            </>
          )
        }
      />
      <Lane
        label={scout ? 'Give' : 'You give'}
        icon={ArrowUpRight}
        players={trade.give}
        weight="small"
        note={
          trade.my_drop && (
            <>
              <Trash size={13} aria-hidden="true" />
              <span>
                and drop <PlayerInline player={trade.my_drop} />
              </span>
            </>
          )
        }
      />
      <WeekLine changes={trade.category_changes} />
      {actions ?? (
        <div className="bm-actions mvl-act">
          <a
            className="button"
            href={`https://fantasy.espn.com/basketball/team?leagueId=${league.id}&teamId=${trade.partner_team_id}&seasonId=${league.season}`}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
            Open their team
          </a>
          <a className="button ghost mvl-bare" href="#trade-0">
            See the pitch
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </a>
        </div>
      )}
    </Lead>
  )
}

/** Best move as a free-agent pickup: when to make it, who it replaces, and the odds. */
function BestPickup({
  report,
  pickup,
  colours,
  scout,
  actions,
  foot,
}: {
  report: AnalysisReport
  pickup: PickupIdea
  colours: Map<number, string>
  scout?: string
  actions?: ReactNode
  foot?: ReactNode
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
  const addsLeft = adds != null && (
    <span className="bm-adds">
      <b className="num">{adds}</b> of {week?.adds_allowed} adds left
    </span>
  )
  return (
    <Lead
      className="mvl-pickup"
      foot={foot}
      describedBy={wait ? 'best-when' : undefined}
      chart={
        <>
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
            lanes={false}
          />
          {wait && <SpotDays timing={wait} add={pickup.add} drop={pickup.drop} />}
        </>
      }
    >
      <Head>
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
          <span className="mvl-sub">No one has to agree</span>
        )}
      </Head>
      <Lane
        label="Add"
        icon={Plus}
        players={[pickup.add]}
        weight="big"
        info={`${pickup.availability === 'WAIVERS' ? 'On waivers' : 'Free agent'} · ${Math.round(pickup.add.percent_owned)}% owned${pickup.stream ? ' · For this week' : ''}`}
      />
      <Lane
        label="Drop"
        icon={Trash}
        players={[pickup.drop]}
        weight="small"
        note={
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
      {thisWeek ? (
        <WeekLine changes={t.week_changes} against={opponent} close={week?.close_categories} />
      ) : (
        <WeekLine changes={pickup.category_changes} />
      )}
      {actions ?? (
        <div className="bm-actions mvl-act">
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
          <a className="button ghost mvl-bare" href="#pickup-0">
            All FA targets
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </a>
          {addsLeft}
        </div>
      )}
      {(wait || joins) && (
        <p className="bm-foot">
          {wait ? (
            <span>
              <UserPlus size={14} aria-hidden="true" />
              Someone could add him first
            </span>
          ) : (
            <span>
              <Clock size={14} aria-hidden="true" />
              Processes {shortDay(joins!)}
            </span>
          )}
        </p>
      )}
    </Lead>
  )
}
