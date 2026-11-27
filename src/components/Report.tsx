import { useEffect, useMemo, useState } from 'react'
import type { AnalysisReport, LeagueOverview as Overview } from '../api/client'
import { BestMove } from './BestMove'
import { Builds } from './Builds'
import { CategoryOutlook } from './CategoryOutlook'
import { CategoryTiles } from './CategoryTiles'
import { WinPath } from './WinPath'
import { MyPlayers } from './MyPlayers'
import { LeagueChat } from './LeagueChat'
import { LeagueOverview } from './LeagueOverview'
import { News } from './News'
import { SeasonBand } from './Outlook'
import { Pickups } from './Pickups'
import { Roster } from './Roster'
import { Scores } from './Scores'
import { tonightMatchup } from '../lib/league'
import { Season } from './Season'
import { TradeFor } from './TradeFor'
import { TradeOfTheDay } from './TradeOfTheDay'
import { FeedbackContext } from './TradeFeedback'
import { TradePark } from './TradePark'
import { TradeCheck } from './TradeCheck'
import { CHECK_PARAM, EMPTY_DEAL, encodeDeal, type CheckDeal } from '../lib/tradeCheck'
import { TradeModes, type TradeMode } from './TradeModes'
import { Trades } from './Trades'
import { BestMovePending, TradesPending, type TradesStatus } from './TradesPending'
import { NewsSince, type NewsSinceProps } from './NewsSince'
import type { NewsRowKind } from '../lib/newsSince'
import type { Credentials } from '../lib/credentials'
import { Untouchable, UntouchableLine, UntouchableWorking } from './Untouchable'
import { HowItWorks, type HowPart } from './HowItWorks'
import { useUntouchableAsked } from '../lib/untouchable'
import { tradeKey } from '../lib/format'
import { useManagerStyles } from '../lib/useManagerStyles'
import { partnerLine } from '../lib/managerStyles'
import '../styles/moves.css'
import '../styles/team-sheet.css'

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

/** How this works: the run on every tab; on Moves also what ranks the trades and the two lists. */
function howParts(report: AnalysisReport, moves: boolean): HowPart[] {
  const run: HowPart = {
    title: 'The model',
    body: (
      <>
        <b className="hiw-big num">{report.assumptions.simulations.toLocaleString()}</b>
        season simulations, run in <span className="num">{(report.elapsed_ms / 1000).toFixed(1)}</span>s.
      </>
    ),
  }
  if (!moves) return [run]
  return [
    run,
    {
      title: 'Expected gain',
      body: 'Your odds gain times the chance they say yes. Trades are ranked by it.',
    },
    { title: 'Chance they say yes', body: 'How offers like this one went in real leagues: Likely, Possible or Long shot.' },
    {
      title: 'Fair and Bold',
      body: "Fair: both teams' odds rise at least a point. Bold: they win on paper, you win on the court.",
    },
  ]
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
  // Trade Park: the players picked to shop (kept across tab switches). Picking runs the search.
  const [picks, setPicks] = useState<number[]>([])
  // Trade Park finds deals or checks one you bring; a shared check link opens on the check.
  const [parkMode, setParkMode] = useState<'find' | 'check'>(() =>
    new URLSearchParams(window.location.search).has(CHECK_PARAM) ? 'check' : 'find',
  )
  // Bumped by openCheck, so a check that is already open starts again on the new deal.
  const [checkOpened, setCheckOpened] = useState(0)

  // Trade feedback and saved rules belong to the verified manager: a team picked before the ESPN
  // check gets the same moves without them.
  const leagueId = report.league.id
  const season = report.league.season
  const teamId = report.team_id
  const verified = !onVerify
  const styles = useManagerStyles({ leagueId, season }, creds, verified)
  const partnerStyles = useMemo(
    () => (styles.data?.weeks ? new Map(styles.data.teams.map((t) => [t.team_id, partnerLine(t)])) : undefined),
    [styles.data],
  )
  const feedbackScope = useMemo(
    () => (verified ? { leagueId, season, teamId, creds } : null),
    [verified, leagueId, season, teamId, creds],
  )

  // "Anyone untouchable?" is asked once, while nobody is kept. A manager whose moves already leave
  // keepers out has answered; so has one who asks for an update with new keepers.
  const [asked, markAsked] = useUntouchableAsked(leagueId, season, teamId)
  const keptNow = report.roster.filter((p) => keep.includes(p.id))
  const reworking = rerunning && keepChanged && keep.length > 0
  const asking = !asked && !tradesPending && !reworking && (keep.length === 0 || keepChanged)
  // The trades the answer changes: the unique ones across Fair and Bold.
  const waiting = new Set([...report.trades, ...report.edge_trades].map(tradeKey)).size
  useEffect(() => {
    if (!asked && keep.length > 0 && !keepChanged) markAsked()
  }, [asked, keep.length, keepChanged, markAsked])
  const rerun = () => {
    if (keepChanged) markAsked()
    onRerun()
  }

  // From the news card to the part of Moves it names: both lists are always on the page, so just scroll.
  const goTo = (kind: NewsRowKind) => {
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

  // Opens Check a Trade filled in with a deal (a team, players each way, sending or received),
  // the same way a shared check link does.
  const openCheck = (deal: CheckDeal) => {
    const q = new URLSearchParams(window.location.search)
    const value = encodeDeal(deal)
    if (value) q.set(CHECK_PARAM, value)
    else q.delete(CHECK_PARAM)
    window.history.replaceState(null, '', `?${q.toString()}`)
    setCheckOpened((n) => n + 1)
    setParkMode('check')
    onTab('park')
    window.scrollTo({ top: 0 })
  }

  // The trade tools' segment: Trade Park (finding deals), Trade For, or Check a Trade.
  const tradeMode: TradeMode = tab === 'trade-for' ? 'trade-for' : parkMode === 'check' ? 'check' : 'park'
  const onTradeMode = (mode: TradeMode) => {
    if (mode === 'trade-for') {
      onTab('trade-for')
      return
    }
    setParkMode(mode === 'check' ? 'check' : 'find')
    onTab('park')
  }

  const shopPlayer = (id: number) => {
    setPicks([id])
    onTab('park')
  }

  return (
    <FeedbackContext.Provider value={feedbackScope}>
      <div className="stack" style={{ gap: 24 }} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'moves' && (
          <div className="mv-page">
            {reworking && <UntouchableWorking players={keptNow} />}
            {asking && (
              <Untouchable
                roster={report.roster}
                keep={keep}
                onToggleKeep={onToggleKeep}
                onEveryone={markAsked}
                waiting={waiting}
              />
            )}
            {news && news.changes.length > 0 && <NewsSince {...news} onDismiss={onDismissNews} onGo={goTo} />}
            {/* The lead: the best move, its odds chart and the season as its foot band. */}
            <div id="moves-best">
              {tradesPending ? (
                <BestMovePending status={tradesStatus} onRetry={onRerun} foot={<SeasonBand report={report} />} />
              ) : (
                <BestMove report={report} foot={<SeasonBand report={report} />} />
              )}
            </div>
            <CategoryTiles categories={report.categories} />
            {/* Two lists: Trades | FA Targets side by side from 1100px; below that FA Targets come first. */}
            <div className="mv-lists">
              <div className="mv-trades">
                {tradesPending ? (
                  <TradesPending status={tradesStatus} onRetry={onRerun} />
                ) : (
                  <Trades
                    fair={report.trades}
                    edge={report.edge_trades}
                    categories={report.league.categories}
                    teams={report.league.teams}
                    myTeamId={report.team_id}
                    kept={keepChanged ? [] : keptNow}
                    untouchable={
                      !asking && <UntouchableLine roster={report.roster} keep={keep} onToggleKeep={onToggleKeep} />
                    }
                    keep={keep}
                    partnerStyles={partnerStyles}
                    onToggleKeep={onToggleKeep}
                    pickups={report.pickups}
                    onCheck={openCheck}
                  />
                )}
              </div>
              <div className="mv-fa">
                <Pickups
                  pickups={report.pickups}
                  faab={report.faab_remaining}
                  waiverPriority={report.waiver_priority}
                  teams={report.league.teams.length}
                  week={report.week}
                  today={{ leagueId: report.league.id, season: report.league.season, teamId: report.team_id, creds }}
                />
              </div>
            </div>
            {/* Around the league, not your move: after your lists on every width. */}
            <TradeOfTheDay
              leagueId={report.league.id}
              season={report.league.season}
              leagueName={report.league.name}
              myTeamId={report.team_id}
              teamIds={report.season.map((r) => r.team_id)}
              creds={creds}
            />
          </div>
        )}

        {(tab === 'park' || tab === 'trade-for') && <TradeModes mode={tradeMode} onMode={onTradeMode} />}

        {tab === 'park' &&
          (parkMode === 'find' ? (
            <TradePark
              report={report}
              keep={keep}
              creds={creds}
              picks={picks}
              onPicks={setPicks}
              onCheck={openCheck}
            />
          ) : (
            <TradeCheck key={checkOpened} report={report} keep={keep} creds={creds} />
          ))}

        {tab === 'trade-for' && <TradeFor report={report} keep={keep} creds={creds} onCheck={openCheck} />}

        {tab === 'team' && (
          // One sheet for the whole tab: no cards, sections parted by air (team-sheet.css).
          <div className="team-sheet">
            <WinPath leagueRef={{ leagueId: report.league.id, season: report.league.season }} creds={creds} />
            <MyPlayers
              leagueId={report.league.id}
              season={report.league.season}
              teamId={report.team_id}
              creds={creds}
            />
            <div className="ts-split">
              <CategoryOutlook categories={report.categories} />
              <Roster roster={report.roster} keep={keep} onToggleKeep={onToggleKeep} onShop={shopPlayer} />
            </div>
          </div>
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
                onCheckTrade={(teamId) => openCheck({ ...EMPTY_DEAL, partner: teamId })}
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
            <button onClick={rerun} disabled={rerunning}>
              {rerunning ? 'Updating…' : 'Update moves with these keepers'}
            </button>
          </div>
        )}

        {tab !== 'chat' && tab !== 'park' && tab !== 'trade-for' && tab !== 'scores' && tab !== 'news' && (
          <HowItWorks parts={howParts(report, tab === 'moves')} notes={report.assumptions.notes} />
        )}
      </div>
    </FeedbackContext.Provider>
  )
}
