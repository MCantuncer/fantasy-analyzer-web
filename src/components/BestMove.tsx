import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AnalysisReport, PlayerRef } from '../api/client'
import { pct, ptsDiff } from '../lib/format'
import { teamColours } from '../lib/league'
import { InjuryBadges } from './InjuryBadges'
import { Delta } from './OddsChange'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { TeamCrest } from './TeamCrest'
import './BestMove.css'

/** One side of the move, on its team's colour: a soft tint with a 6px edge, and the team crest in the corner. */
export function Side({
  label,
  players,
  note,
  colour,
  crest,
}: {
  label: string
  players: PlayerRef[]
  note: ReactNode
  colour?: string
  /** Team name for the corner crest; left out for free agents. */
  crest?: string
}) {
  return (
    <div className="swap-side" style={{ '--team': colour ?? 'var(--faint)' } as CSSProperties}>
      {crest && (
        <span className="bm-crest">
          <TeamCrest name={crest} colour={colour} size={26} tilt />
        </span>
      )}
      <span className="head-stack">
        {players.slice(0, 3).map((p) => (
          <PlayerLink key={p.id} player={p} decorative>
            <PlayerHead player={p} size={44} team={p.pro_team} />
          </PlayerLink>
        ))}
      </span>
      <div className="bm-side-text">
        <div className="swap-label">{label}</div>
        <div className="swap-name">
          {players.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ' + '}
              <PlayerLink player={p} after={<InjuryBadges players={[p]} />} />
            </span>
          ))}
        </div>
        <div className="small muted">{note}</div>
      </div>
    </div>
  )
}

/** The round disc between the two sides. Decorative: the labels already say give and get. */
function SwapDisc({ kind }: { kind: 'arrow' | 'swap' }) {
  return (
    <span className={`bm-swap bm-swap-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'arrow' ? <path d="M5 12h14M13 6l6 6-6 6" /> : <path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5" />}
      </svg>
    </span>
  )
}

/** The two biggest gains and costs in weekly win chance, as "3PM ▲28" (not a sentence). */
function TopChanges({ changes }: { changes: Record<string, number> }) {
  const moved = Object.entries(changes)
    .map(([c, v]) => [c, Math.round(v * 100)] as const)
    .filter(([, v]) => Math.abs(v) >= 2)
  const gains = moved.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2)
  const costs = moved.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2)
  if (!gains.length && !costs.length) return null
  const item = ([c, v]: readonly [string, number]) => (
    <li key={c}>
      {c}{' '}
      <span className={v > 0 ? 'num good' : 'num bad'}>
        <Delta value={v} />
      </span>
    </li>
  )
  return (
    <ul className="bm-changes" aria-label="Weekly win chance, in points" title="Weekly win chance, in points">
      {gains.map(item)}
      {costs.map(item)}
    </ul>
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
  const mine = colours.get(report.team_id)

  if (tradeGain <= 0 && pickupGain <= 0) {
    return (
      <section className="card best">
        <span className="eyebrow">Your best move</span>
        <h2>Hold for now</h2>
        <p className="muted">
          No single trade or pickup clearly raises your playoff odds right now. Check back after the next games.
        </p>
      </section>
    )
  }

  if (pickup && pickupGain >= tradeGain) {
    return (
      <section className="card best" aria-labelledby="best-title">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="eyebrow" id="best-title">
            Your best move · no one has to agree
          </span>
        </div>
        <div className="swap">
          <Side
            label="Add"
            players={[pickup.add]}
            note={`${pickup.add.positions.join('/')} · ${pickup.availability === 'WAIVERS' ? 'on waivers' : 'free agent'} · ${Math.round(pickup.add.percent_owned)}% owned`}
          />
          <SwapDisc kind="swap" />
          <Side
            label="Drop"
            players={[pickup.drop]}
            colour={mine}
            crest={report.team_name}
            note={`${pickup.drop.positions.join('/')} · on your roster`}
          />
        </div>
        <OddsMeter
          before={pickup.playoff_pct_before}
          after={pickup.playoff_pct_after}
          celebrate={`pickup-${pickup.add.id}-${pickup.drop.id}`}
        />
        <div className="row">
          <a
            className="button"
            href={`https://fantasy.espn.com/basketball/players/add?leagueId=${league.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Make the claim on ESPN
          </a>
          <a className="button ghost" href="#pickup-0">
            All FA targets
          </a>
          <TopChanges changes={pickup.category_changes} />
        </div>
      </section>
    )
  }

  const theirs = colours.get(trade.partner_team_id)
  return (
    <section className="card best" aria-labelledby="best-title">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <span className="eyebrow bm-eyebrow" id="best-title">
          Your best move · trade with{' '}
          <span className="bm-partner">
            <TeamCrest name={trade.partner_team_name} colour={theirs} size={20} />
            {trade.partner_team_name}
          </span>
        </span>
      </div>
      <div className="swap">
        <Side
          label="You give"
          players={trade.give}
          colour={mine}
          crest={report.team_name}
          note={trade.my_drop ? `You also drop ${trade.my_drop.name}` : 'From your roster'}
        />
        <SwapDisc kind="arrow" />
        <Side
          label="You get"
          players={trade.get}
          colour={theirs}
          crest={trade.partner_team_name}
          note={
            trade.my_add
              ? `Plus ${trade.my_add.name} from free agency · ${pct(trade.acceptance)} chance they accept`
              : `${pct(trade.acceptance)} chance they accept`
          }
        />
      </div>
      <OddsMeter
        before={trade.playoff_pct_before}
        after={trade.playoff_pct_after}
        celebrate={`trade-${trade.partner_team_id}-${[...trade.give, ...trade.get].map((p) => p.id).join('-')}`}
      />
      <div className="row">
        <a
          className="button"
          href={`https://fantasy.espn.com/basketball/team?leagueId=${league.id}&teamId=${trade.partner_team_id}&seasonId=${league.season}`}
          target="_blank"
          rel="noreferrer"
        >
          Open their team on ESPN
        </a>
        <a className="button ghost" href="#trade-0">
          See the pitch
        </a>
        <TopChanges changes={trade.category_changes} />
      </div>
    </section>
  )
}
