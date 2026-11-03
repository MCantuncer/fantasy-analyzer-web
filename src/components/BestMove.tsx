import type { AnalysisReport, PlayerRef } from '../api/client'
import { pct, ptsDiff, signedInt } from '../lib/format'
import { InjuryBadges } from './InjuryBadges'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import './BestMove.css'

export function Side({ label, tone, players, note }: { label: string; tone: 'good' | 'bad'; players: PlayerRef[]; note: string }) {
  return (
    <div className="swap-side">
      <div className={`swap-label ${tone}`}>{label}</div>
      <span className="head-stack">
        {players.slice(0, 3).map((p) => (
          <PlayerLink key={p.id} player={p} decorative>
            <PlayerHead player={p} size={44} />
          </PlayerLink>
        ))}
      </span>
      <div className="swap-name">
        {players.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ' + '}
            <PlayerLink player={p} />
            <InjuryBadges players={[p]} />
          </span>
        ))}
      </div>
      <div className="small muted">{note}</div>
    </div>
  )
}

/** The two biggest gains and costs in weekly win chance, as signed chips (not a sentence). */
function TopChanges({ changes }: { changes: Record<string, number> }) {
  const moved = Object.entries(changes)
    .map(([c, v]) => [c, Math.round(v * 100)] as const)
    .filter(([, v]) => Math.abs(v) >= 2)
  const gains = moved.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2)
  const costs = moved.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2)
  if (!gains.length && !costs.length) return null
  const chip = ([c, v]: readonly [string, number]) => (
    <li key={c} className={v > 0 ? 'bm-chip up' : 'bm-chip down'}>
      {c} <span className="num">{signedInt(v)}</span>
    </li>
  )
  return (
    <ul className="bm-chips" aria-label="Weekly win chance, in points" title="Weekly win chance, in points">
      {gains.map(chip)}
      {gains.length > 0 && costs.length > 0 && <li className="bm-sep" aria-hidden="true" />}
      {costs.map(chip)}
    </ul>
  )
}

export function OddsMeter({ before, after }: { before: number; after: number }) {
  const diff = ptsDiff(before, after)
  const lo = Math.min(before, after)
  return (
    <div className="big-odds">
      <div>
        <div className="kpi-label">Your playoff odds</div>
        <div className="big-odds-figures num">
          <span className="before">{pct(before)}</span>
          <span className="muted" aria-label="to">
            →
          </span>
          <span className="after">{pct(after)}</span>
          <span className={diff >= 0 ? 'delta-pill' : 'delta-pill down'}>{signedInt(diff)} pts</span>
        </div>
      </div>
      <div className="odds-track" aria-hidden="true">
        <div className="odds-bar">
          <span className="base" style={{ width: pct(lo) }} />
          <span className="gain" style={{ left: pct(lo), width: pct(Math.abs(after - before)) }} />
        </div>
        <div className="odds-scale">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
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
            label="+ ADD"
            tone="good"
            players={[pickup.add]}
            note={`${pickup.add.positions.join('/')} · ${pickup.availability === 'WAIVERS' ? 'on waivers' : 'free agent'} · ${Math.round(pickup.add.percent_owned)}% owned`}
          />
          <Side
            label="− DROP"
            tone="bad"
            players={[pickup.drop]}
            note={`${pickup.drop.positions.join('/')} · on your roster`}
          />
        </div>
        <OddsMeter before={pickup.playoff_pct_before} after={pickup.playoff_pct_after} />
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

  return (
    <section className="card best" aria-labelledby="best-title">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <span className="eyebrow" id="best-title">
          Your best move · trade with {trade.partner_team_name}
        </span>
      </div>
      <div className="swap">
        <Side
          label="YOU GIVE"
          tone="bad"
          players={trade.give}
          note={trade.my_drop ? `You also drop ${trade.my_drop.name}` : 'From your roster'}
        />
        <Side
          label="YOU GET"
          tone="good"
          players={trade.get}
          note={
            trade.my_add
              ? `Plus ${trade.my_add.name} from free agency · ${pct(trade.acceptance)} chance they accept`
              : `${pct(trade.acceptance)} chance they accept`
          }
        />
      </div>
      <OddsMeter before={trade.playoff_pct_before} after={trade.playoff_pct_after} />
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
