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
import { Scores } from './Scores'
import { Season } from './Season'
import { TradeFor } from './TradeFor'
import { TradeOfTheDay } from './TradeOfTheDay'
import { TradePark } from './TradePark'
import { Trades } from './Trades'
import type { Credentials } from '../lib/credentials'

export const TABS = [
  { id: 'moves', label: 'Moves' },
  { id: 'park', label: 'Trade Park' },
  { id: 'trade-for', label: 'Trade for' },
  { id: 'team', label: 'My team' },
  { id: 'league', label: 'League' },
  { id: 'scores', label: 'Scores' },
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
  onTab: (tab: Tab) => void
}

export function Report({
  report,
  tab,
  keep,
  keepChanged,
  onToggleKeep,
  onRerun,
  rerunning,
  creds,
  overview,
  onTab,
}: Props) {
  const [show, setShow] = useState<'trades' | 'pickups'>('trades')
  // Trade Park: players picked, and the set last searched (kept across tab switches).
  const [picks, setPicks] = useState<number[]>([])
  const [searched, setSearched] = useState<number[]>([])

  const shopPlayer = (id: number) => {
    setPicks([id])
    setSearched([id])
    onTab('park')
  }

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
                <Pickups
                  pickups={report.pickups}
                  faab={report.faab_remaining}
                  waiverPriority={report.waiver_priority}
                  teams={report.league.teams.length}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'park' && (
        <TradePark
          report={report}
          keep={keep}
          creds={creds}
          picks={picks}
          onPicks={setPicks}
          searched={searched}
          onSearch={setSearched}
        />
      )}

      {tab === 'trade-for' && <TradeFor report={report} keep={keep} creds={creds} />}

      {tab === 'team' && (
        <div className="split">
          <div className="narrow">
            <CategoryOutlook categories={report.categories} />
          </div>
          <div className="wide">
            <Roster roster={report.roster} keep={keep} onToggleKeep={onToggleKeep} onShop={shopPlayer} />
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

      {tab === 'scores' && (
        <Scores
          leagueId={report.league.id}
          season={report.league.season}
          teamId={report.team_id}
          teams={report.league.teams}
          creds={creds}
        />
      )}

      {tab === 'chat' && <LeagueChat leagueId={report.league.id} season={report.league.season} creds={creds} />}

      {keepChanged && (
        <div className="sticky-action">
          <button onClick={onRerun} disabled={rerunning}>
            {rerunning ? 'Updating…' : 'Update moves with these keepers'}
          </button>
        </div>
      )}

      {tab !== 'chat' && tab !== 'park' && tab !== 'scores' && (
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
