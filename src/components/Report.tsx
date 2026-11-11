import { useMemo, useState } from 'react'
import type { AnalysisReport, LeagueOverview as Overview } from '../api/client'
import { BestMove } from './BestMove'
import { Builds } from './Builds'
import { CategoryOutlook } from './CategoryOutlook'
import { CategoryTiles } from './CategoryTiles'
import { MyPlayers } from './MyPlayers'
import { LeagueChat } from './LeagueChat'
import { LeagueOverview } from './LeagueOverview'
import { News } from './News'
import { Outlook } from './Outlook'
import { Pickups } from './Pickups'
import { Roster } from './Roster'
import { Scores } from './Scores'
import { tradeKey } from '../lib/format'
import { tonightMatchup } from '../lib/league'
import { Season } from './Season'
import { TradeFor } from './TradeFor'
import { TradeOfTheDay } from './TradeOfTheDay'
import { FeedbackContext } from './TradeFeedback'
import { TradePark } from './TradePark'
import { TradeCheck } from './TradeCheck'
import { CHECK_PARAM } from '../lib/tradeCheck'
import { Trades } from './Trades'
import { Spinner } from './Spinner'
import { BestMovePending, TradesPending, type TradesStatus } from './TradesPending'
import { NewsSince, type NewsSinceProps } from './NewsSince'
import type { NewsRowKind } from '../lib/newsSince'
import type { Credentials } from '../lib/credentials'

export const TABS = [
  { id: 'moves', label: 'Moves' },
  { id: 'park', label: 'Trade Park' },
  { id: 'trade-for', label: 'Trade For' },
  { id: 'team', label: 'My Team' },
  { id: 'league', label: 'League' },
  { id: 'scores', label: 'Scores' },
  { id: 'news', label: 'NBA News' },
  { id: 'chat', label: 'League Chat' },
] as const

export type Tab = (typeof TABS)[number]['id']

/** The heading each news card row takes you to. */
const NEWS_TARGETS: Record<NewsRowKind, string> = {
  best: 'moves-best',
  trades: 'trades-title',
  fa: 'pickups-title',
  odds: 'outlook-title',
}

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
  film?: number | null
  onFilm?: (period: number | null | undefined) => void
  /** Where the run is, for a preview whose trades are still being screened. */
  tradesStatus?: TradesStatus
  /** What moved since this report was built, while (and after) it is updated. */
  news?: Omit<NewsSinceProps, 'onDismiss' | 'onGo'>
  onDismissNews?: () => void
  /** Set while the team is picked but not verified: opens the ESPN check. Chat, feedback and rules wait for it. */
  onVerify?: () => void
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
  film,
  onFilm,
  tradesStatus = { progress: 0, running: true },
  news,
  onDismissNews = () => {},
  onVerify,
}: Props) {
  // A preview: free agents are in, trades are still being screened.
  const tradesPending = (report.pending ?? []).includes('trades')
  // On phones one list shows at a time: open on the one that's ready.
  const [show, setShow] = useState<'trades' | 'pickups'>(tradesPending ? 'pickups' : 'trades')
  // Trade Park: players picked, and the set last searched (kept across tab switches).
  const [picks, setPicks] = useState<number[]>([])
  const [searched, setSearched] = useState<number[]>([])
  // Trade Park finds deals or checks one you bring; a shared check link opens on the check.
  const [parkMode, setParkMode] = useState<'find' | 'check'>(() =>
    new URLSearchParams(window.location.search).has(CHECK_PARAM) ? 'check' : 'find',
  )

  // Trade feedback and saved rules belong to the verified manager: a team picked before the ESPN
  // check gets the same moves without them.
  const leagueId = report.league.id
  const season = report.league.season
  const teamId = report.team_id
  const verified = !onVerify
  const feedbackScope = useMemo(
    () => (verified ? { leagueId, season, teamId, creds } : null),
    [verified, leagueId, season, teamId, creds],
  )

  // From the news card to the part of Moves it names: phones show one list at a time, so open it first.
  const goTo = (kind: NewsRowKind) => {
    if (kind === 'trades') setShow('trades')
    if (kind === 'fa') setShow('pickups')
    requestAnimationFrame(() => {
      const heading = document.getElementById(NEWS_TARGETS[kind])
      const target = heading?.closest('section, #moves-best') ?? heading
      if (!target) return
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target.classList.add('ns-flash')
      target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
      window.setTimeout(() => target.classList.remove('ns-flash'), 1200)
    })
  }

  const shopPlayer = (id: number) => {
    setPicks([id])
    setSearched([id])
    onTab('park')
  }

  return (
    <FeedbackContext.Provider value={feedbackScope}>
      <div className="stack" style={{ gap: 24 }} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'moves' && (
          <>
            {news && news.changes.length > 0 && <NewsSince {...news} onDismiss={onDismissNews} onGo={goTo} />}
            <TradeOfTheDay
              leagueId={report.league.id}
              season={report.league.season}
              leagueName={report.league.name}
              myTeamId={report.team_id}
              teamIds={report.season.map((r) => r.team_id)}
              creds={creds}
            />
            <div className="split">
              <div className="wide" id="moves-best">
                {tradesPending ? (
                  <BestMovePending status={tradesStatus} onRetry={onRerun} />
                ) : (
                  <BestMove report={report} />
                )}
              </div>
              <div className="narrow">
                <Outlook report={report} />
              </div>
            </div>
            <CategoryTiles categories={report.categories} />
            <div className="moves stack" data-show={show}>
              <div className="moves-switch segmented" role="group" aria-label="Show">
                <button type="button" aria-pressed={show === 'trades'} onClick={() => setShow('trades')}>
                  Trades ·{' '}
                  {!tradesPending ? (
                    new Set([...report.trades, ...report.edge_trades].map(tradeKey)).size
                  ) : tradesStatus.running ? (
                    <>
                      <Spinner size={13} className="tp-count-spin" />
                      <span className="sr-only">still screening</span>
                    </>
                  ) : (
                    '–'
                  )}
                </button>
                <button type="button" aria-pressed={show === 'pickups'} onClick={() => setShow('pickups')}>
                  FA Targets · {report.pickups.length}
                </button>
              </div>
              <div className="split">
                <div className="wide">
                  {tradesPending ? (
                    <TradesPending status={tradesStatus} onRetry={onRerun} />
                  ) : (
                    <Trades
                      fair={report.trades}
                      edge={report.edge_trades}
                      categories={report.league.categories}
                      teams={report.league.teams}
                      myTeamId={report.team_id}
                      keepNames={report.roster.filter((p) => keep.includes(p.id)).map((p) => p.name)}
                    />
                  )}
                </div>
                <div className="narrow">
                  <Pickups
                    pickups={report.pickups}
                    faab={report.faab_remaining}
                    waiverPriority={report.waiver_priority}
                    teams={report.league.teams.length}
                    week={report.week}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'park' && (
          <>
            <div className="segmented tck-park-modes" role="group" aria-label="Trade Park">
              <button type="button" aria-pressed={parkMode === 'find'} onClick={() => setParkMode('find')}>
                Find Deals
              </button>
              <button type="button" aria-pressed={parkMode === 'check'} onClick={() => setParkMode('check')}>
                Check a Trade
              </button>
            </div>
            {parkMode === 'find' ? (
              <TradePark
                report={report}
                keep={keep}
                creds={creds}
                picks={picks}
                onPicks={setPicks}
                searched={searched}
                onSearch={setSearched}
              />
            ) : (
              <TradeCheck report={report} keep={keep} creds={creds} />
            )}
          </>
        )}

        {tab === 'trade-for' && <TradeFor report={report} keep={keep} creds={creds} />}

        {tab === 'team' && (
          <>
            <MyPlayers
              leagueId={report.league.id}
              season={report.league.season}
              teamId={report.team_id}
              creds={creds}
            />
            <div className="split">
              <div className="narrow">
                <CategoryOutlook categories={report.categories} />
              </div>
              <div className="wide">
                <Roster roster={report.roster} keep={keep} onToggleKeep={onToggleKeep} onShop={shopPlayer} />
              </div>
            </div>
          </>
        )}

        {tab === 'league' && (
          <>
            {overview ? (
              <LeagueOverview
                overview={overview}
                onVerify={() => undefined}
                projected={report.season}
                leagueRef={{ leagueId: overview.league_id, season: overview.season }}
                creds={creds}
                film={film}
                onFilm={onFilm}
              />
            ) : (
              <Season rows={report.season} myTeamId={report.team_id} playoffTeams={report.league.playoff_teams} />
            )}
            {film === undefined && (
              <Builds builds={report.builds} categories={report.league.categories} myTeamId={report.team_id} />
            )}
          </>
        )}

        {tab === 'scores' && (
          <Scores
            leagueId={report.league.id}
            season={report.league.season}
            teamId={report.team_id}
            teams={report.league.teams}
            creds={creds}
            matchup={overview ? tonightMatchup(overview, report.team_id) : null}
          />
        )}

        {tab === 'news' && (
          <News
            leagueId={report.league.id}
            season={report.league.season}
            myTeamId={report.team_id}
            teams={report.league.teams}
            creds={creds}
          />
        )}

        {tab === 'chat' && (
          <LeagueChat
            leagueId={report.league.id}
            season={report.league.season}
            creds={creds}
            onVerify={onVerify}
            onOpenFilm={(p) => {
              onFilm?.(p)
              onTab('league')
            }}
          />
        )}

        {keepChanged && (
          <div className="sticky-action">
            <button onClick={onRerun} disabled={rerunning}>
              {rerunning ? 'Updating…' : 'Update moves with these keepers'}
            </button>
          </div>
        )}

        {tab !== 'chat' && tab !== 'park' && tab !== 'scores' && tab !== 'news' && (
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
    </FeedbackContext.Provider>
  )
}
