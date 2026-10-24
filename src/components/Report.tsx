import { useState } from 'react'
import type { AnalysisReport, LeagueOverview as Overview } from '../api/client'
import { BestMove } from './BestMove'
import { Builds } from './Builds'
import { CategoryOutlook } from './CategoryOutlook'
import { CategoryTiles } from './CategoryTiles'
import { LeagueChat } from './LeagueChat'
import { LeagueOverview } from './LeagueOverview'
import { Outlook } from './Outlook'
import { Pickups } from './Pickups'
import { Roster } from './Roster'
import { Season } from './Season'
import { TradeFor } from './TradeFor'
import { TradeOfTheDay } from './TradeOfTheDay'
import { Trades } from './Trades'
import type { Credentials } from '../lib/credentials'

export const TABS = [
  { id: 'moves', label: 'Moves' },
  { id: 'trade-for', label: 'Trade for' },
  { id: 'team', label: 'My team' },
  { id: 'league', label: 'League' },
  { id: 'chat', label: 'League chat' },
] as const

export type Tab = (typeof TABS)[number]['id']

interface Props {
  report: AnalysisReport
  tab: Tab
  keep: number[]
  keepChanged: boolean
  onToggleKeep: (id: number) => void
  onRerun: () => void
  rerunning: boolean
  creds: Credentials | null
  overview: Overview | null
}

export function Report({ report, tab, keep, keepChanged, onToggleKeep, onRerun, rerunning, creds, overview }: Props) {
  const [show, setShow] = useState<'trades' | 'pickups'>('trades')

  return (
    <div className="stack" style={{ gap: 24 }} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'moves' && (
        <>
          <TradeOfTheDay
            leagueId={report.league.id}
            season={report.league.season}
            leagueName={report.league.name}
            myTeamId={report.team_id}
            creds={creds}
          />
          <div className="split">
            <div className="wide">
              <BestMove report={report} />
            </div>
            <div className="narrow">
              <Outlook report={report} />
            </div>
          </div>
          <CategoryTiles categories={report.categories} />
          <div className="moves stack" data-show={show}>
            <div className="moves-switch segmented" role="group" aria-label="Show">
              <button type="button" aria-pressed={show === 'trades'} onClick={() => setShow('trades')}>
                Trades · {report.trades.length}
              </button>
              <button type="button" aria-pressed={show === 'pickups'} onClick={() => setShow('pickups')}>
                Pickups · {report.pickups.length}
              </button>
            </div>
            <div className="split">
              <div className="wide">
                <Trades fair={report.trades} edge={report.edge_trades} />
              </div>
              <div className="narrow">
                <Pickups pickups={report.pickups} faab={report.faab_remaining} />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'trade-for' && <TradeFor report={report} keep={keep} creds={creds} />}

      {tab === 'team' && (
        <div className="split">
          <div className="narrow">
            <CategoryOutlook categories={report.categories} />
          </div>
          <div className="wide">
            <Roster roster={report.roster} keep={keep} onToggleKeep={onToggleKeep} />
          </div>
        </div>
      )}

      {tab === 'league' && (
        <>
          {overview && <LeagueOverview overview={overview} onVerify={() => undefined} />}
          <Season rows={report.season} myTeamId={report.team_id} playoffTeams={report.league.playoff_teams} />
          <Builds builds={report.builds} categories={report.league.categories} myTeamId={report.team_id} />
        </>
      )}

      {tab === 'chat' && <LeagueChat leagueId={report.league.id} season={report.league.season} creds={creds} />}

      {keepChanged && (
        <div className="sticky-action">
          <button onClick={onRerun} disabled={rerunning}>
            {rerunning ? 'Updating…' : 'Update moves with these keepers'}
          </button>
        </div>
      )}

      {tab !== 'chat' && (
        <details className="footnote">
          <summary>How this works</summary>
          <ul>
            {report.assumptions.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>
              {report.assumptions.simulations.toLocaleString()} season simulations, run in{' '}
              {(report.elapsed_ms / 1000).toFixed(1)}s.
            </li>
          </ul>
        </details>
      )}
    </div>
  )
}
