import { useState } from 'react'
import type { AnalysisReport } from '../api/client'
import { BestMove } from './BestMove'
import { Builds } from './Builds'
import { CategoryOutlook } from './CategoryOutlook'
import { CategoryTiles } from './CategoryTiles'
import { Outlook } from './Outlook'
import { Pickups } from './Pickups'
import { Roster } from './Roster'
import { Season } from './Season'
import { Trades } from './Trades'

export const TABS = [
  { id: 'moves', label: 'Moves' },
  { id: 'team', label: 'My team' },
  { id: 'league', label: 'League' },
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
}

export function Report({ report, tab, keep, keepChanged, onToggleKeep, onRerun, rerunning }: Props) {
  const [show, setShow] = useState<'trades' | 'pickups'>('trades')

  return (
    <div className="stack" style={{ gap: 24 }} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'moves' && (
        <>
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
          <Season rows={report.season} myTeamId={report.team_id} playoffTeams={report.league.playoff_teams} />
          <Builds builds={report.builds} categories={report.league.categories} myTeamId={report.team_id} />
        </>
      )}

      {keepChanged && (
        <div className="sticky-action">
          <button onClick={onRerun} disabled={rerunning}>
            {rerunning ? 'Updating…' : 'Update moves with these keepers'}
          </button>
        </div>
      )}

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
    </div>
  )
}
