import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowUpRight,
  CaretRight,
  Handshake,
  Plus,
  Target,
  Trash,
  type Icon,
} from '@phosphor-icons/react'
import type { AnalysisReport, PlayerRef } from '../api/client'
import { pct, ptsDiff } from '../lib/format'
import { teamColours } from '../lib/league'
import { InjuryBadges } from './InjuryBadges'
import { Delta } from './OddsChange'
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

/** The two biggest gains and costs in weekly win chance, as small chips with an outcome edge. */
function TopChanges({ changes }: { changes: Record<string, number> }) {
  const moved = Object.entries(changes)
    .map(([c, v]) => [c, Math.round(v * 100)] as const)
    .filter(([, v]) => Math.abs(v) >= 2)
  const gains = moved.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2)
  const costs = moved.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2)
  if (!gains.length && !costs.length) return null
  const item = ([c, v]: readonly [string, number]) => (
    <li key={c} className={v > 0 ? 'bm-chip good' : 'bm-chip bad'}>
      <span className="bm-chip-cat code">{c}</span>
      <span className="num">
        <Delta value={v} />
      </span>
    </li>
  )
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
export function OddsMeter({ before, after, celebrate }: { before: number; after: number; celebrate?: string }) {
  const diff = ptsDiff(before, after)
  const lo = Math.min(before, after)
  return (
    <div className="big-odds">
      <div className="bm-figures">
        <div className="kpi-label">Your playoff odds</div>
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

export function BestMove({ report }: { report: AnalysisReport }) {
  const trade = report.trades[0]
  // Only a straight add/drop counts here: a pickup that needs a trade first does need someone to agree.
  const pickup = report.pickups.find((p) => !p.open_spot_by_trade)
  const tradeGain = trade ? trade.playoff_pct_after - trade.playoff_pct_before : -1
  const pickupGain = pickup ? pickup.playoff_pct_after - pickup.playoff_pct_before : -1
  const league = report.league
  const colours = teamColours(
    report.season.map((r) => r.team_id),
    report.team_id,
  )

  if (tradeGain <= 0 && pickupGain <= 0) {
    return (
      <section className="card best">
        <header className="bm-head">
          <h2 className="bm-title">
            <Target size={20} weight="duotone" aria-hidden="true" />
            Best move: hold for now
          </h2>
        </header>
        <p className="muted">
          No single trade or pickup clearly raises your playoff odds right now. Check back after the next games.
        </p>
      </section>
    )
  }

  if (pickup && pickupGain >= tradeGain) {
    return (
      <section className="card best" aria-labelledby="best-title">
        <header className="bm-head">
          <h2 className="bm-title" id="best-title">
            <Target size={20} weight="duotone" aria-hidden="true" />
            Best move
          </h2>
          <span className="bm-sub muted">No one has to agree</span>
        </header>
        <div className="bm-lanes">
          <Lane
            label="Add"
            icon={Plus}
            players={[pickup.add]}
            note={`${pickup.availability === 'WAIVERS' ? 'On waivers' : 'Free agent'} · ${Math.round(pickup.add.percent_owned)}% owned`}
          />
          <Lane label="Drop" icon={Trash} players={[pickup.drop]} note="From your roster" />
        </div>
        <OddsMeter
          before={pickup.playoff_pct_before}
          after={pickup.playoff_pct_after}
          celebrate={`pickup-${pickup.add.id}-${pickup.drop.id}`}
        />
        <TopChanges changes={pickup.category_changes} />
        <div className="bm-actions">
          <a
            className="button"
            href={`https://fantasy.espn.com/basketball/players/add?leagueId=${league.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
            Make the claim on ESPN
          </a>
          <a className="button ghost" href="#pickup-0">
            All FA targets
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </a>
        </div>
      </section>
    )
  }

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
          label="You give"
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
          label="You get"
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
    </section>
  )
}
