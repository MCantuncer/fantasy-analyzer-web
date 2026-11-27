import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { NewsSkeleton } from './Skeleton'
import { useEffect, useState } from 'react'
import { CaretDown, Eye, Pulse, SealCheck, TrendUp } from '@phosphor-icons/react'
import { fetchInjuryImpact, fetchNews } from '../api/client'
import type {
  Beneficiary,
  InjuryImpact,
  NewsPage,
  NewsPlayer,
  NewsSourceHealth,
  NewsStory,
  TrendingPlayer,
} from '../api/client'
import type { Credentials } from '../lib/credentials'
import {
  CONFIDENCE_LABEL,
  KIND_LABEL,
  STATUS_LABEL,
  ago,
  groupByDay,
  inFilter,
  inScope,
  kindsIn,
  minutesChange,
  ownership,
  shortStatus,
  topGains,
} from '../lib/news'
import type { NewsFilter, NewsScope } from '../lib/news'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { NewsRefresh } from './NewsRefresh'
import { HowItWorks } from './HowItWorks'
import { useNewsRefresh } from '../lib/useNewsRefresh'
import './News.css'

interface Props {
  leagueId: number
  season: number | null
  myTeamId: number | null
  teams: { id: number; abbrev: string }[]
  creds: Credentials | null
}

export function News({ leagueId, season, myTeamId, teams, creds }: Props) {
  const [filter, setFilter] = useState<NewsFilter>('all')
  const [scope, setScope] = useState<NewsScope>('nba')
  const [showHeld, setShowHeld] = useState(false)
  const news = useQuery({
    queryKey: ['news', leagueId, season, showHeld, creds?.swid ?? null],
    queryFn: () => fetchNews(leagueId, season, showHeld, creds),
    retry: false,
    staleTime: 60_000,
    // Showing or hiding the social-only stories keeps the page up while the other list loads.
    placeholderData: keepPreviousData,
    // While the server is checking its sources, ask again shortly; otherwise every 5 minutes.
    // A check the reader asked for is followed more closely by the refresh button itself.
    refetchInterval: (q) => (q.state.data?.refreshing ? 15_000 : 300_000),
  })
  const refresh = useNewsRefresh(news.data, news.refetch)
  // "Updated 4 min ago" keeps counting while the page stays open.
  const [, tick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(t)
  }, [])

  if (news.isLoading) return <NewsSkeleton />
  // A failed refresh keeps the stories on screen; only news that never loaded shows the error card.
  if (!news.data) {
    return (
      <div className="card error stack">
        <h2>Couldn't load the news</h2>
        <p>{news.error?.message ?? 'Try again in a minute.'}</p>
        <div className="row">
          <button className="secondary" onClick={() => news.refetch()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const data = news.data
  const now = new Date()
  const abbrev = new Map(teams.map((t) => [t.id, t.abbrev]))
  const scoped = data.stories.filter((s) => inScope(s, scope, myTeamId))
  // Kinds with no story in this scope are hidden, and the whole kind group when only one is left.
  const kinds = kindsIn(scoped)
  const kindChips = kinds.length > 1 ? kinds : []
  // A kind that has nothing in the new scope (or whose chips are gone) falls back to every kind.
  const kind = kindChips.some((k) => k.id === filter) ? filter : 'all'
  const shown = scoped.filter((s) => inFilter(s, kind))
  const scopes: { id: NewsScope; label: string }[] = [
    { id: 'nba', label: 'All NBA' },
    { id: 'league', label: 'In My League' },
    ...(myTeamId !== null ? [{ id: 'mine' as const, label: 'My Roster' }] : []),
  ]

  return (
    <div className="stack news">
      <header className="news-head">
        <h2>NBA News</h2>
        <NewsRefresh data={data} now={now} refresh={refresh} />
        {news.isError && (
          <p className="small muted" role="status">
            Couldn't refresh the news just now. Trying again shortly.
          </p>
        )}
      </header>

      <div className="news-toolbar" role="toolbar" aria-label="Filter stories">
        <div className="news-chips" role="group" aria-label="Which players">
          {scopes.map((s) => (
            <button
              key={s.id}
              type="button"
              className="news-chip"
              aria-pressed={scope === s.id}
              onClick={() => setScope(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {kindChips.length > 0 && (
          <>
            <span className="news-chip-seam" aria-hidden="true" />
            <div className="news-chips" role="group" aria-label="Kind of news">
              {kindChips.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className="news-chip"
                  aria-pressed={kind === k.id}
                  // Pressed again, a kind chip lets every kind back in.
                  onClick={() => setFilter(kind === k.id ? 'all' : k.id)}
                >
                  {k.label} <span className="num">{k.count}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="split">
        <div className="wide">
          <section className="news-feed" aria-label="Stories">
            {shown.length === 0 ? (
              <EmptyNews data={data} />
            ) : (
              groupByDay(shown, now).map((g) => (
                <div key={g.day} className="news-group">
                  <h3 className="news-day">{g.day}</h3>
                  {g.stories.map((s) => (
                    <Story
                      key={s.id}
                      story={s}
                      now={now}
                      myTeamId={myTeamId}
                      abbrev={abbrev}
                      leagueId={leagueId}
                      season={season}
                      creds={creds}
                    />
                  ))}
                </div>
              ))
            )}
          </section>
          <button
            type="button"
            className="news-held-row"
            aria-pressed={showHeld}
            onClick={() => setShowHeld((v) => !v)}
          >
            <Eye className="news-held-ic" aria-hidden="true" />
            <span className="news-held-text">Show stories seen only on social sites</span>
            <span className="news-held-switch" aria-hidden="true" />
          </button>
        </div>
        <div className="narrow stack news-rail">
          <Trending players={data.trending} myTeamId={myTeamId} abbrev={abbrev} />
          <Sources sources={data.sources} now={now} />
        </div>
      </div>

      <HowItWorks notes={HOW_NOTES} />
    </div>
  )
}

interface ImpactContext {
  leagueId: number
  season: number | null
  creds: Credentials | null
}

function Story({
  story,
  now,
  myTeamId,
  abbrev,
  ...ctx
}: {
  story: NewsStory
  now: Date
  myTeamId: number | null
  abbrev: Map<number, string>
} & ImpactContext) {
  const lead = story.sources.find((s) => s.title === story.headline && s.url) ?? story.sources.find((s) => s.url)
  const held = story.status === 'held' || story.status === 'didnt_happen'
  // Only published injury stories, and only for a player on an NBA team.
  const injured = story.kind === 'injury' && !held ? story.players.filter((p) => p.pro_team) : []
  return (
    <article className="news-story" data-status={story.status}>
      {story.players.length > 0 && (
        <ul className="news-players">
          {story.players.map((p) => (
            <PlayerRow key={p.player_id} player={p} myTeamId={myTeamId} abbrev={abbrev} />
          ))}
        </ul>
      )}
      <h4 className="news-headline">
        {lead ? (
          <a href={lead.url} target="_blank" rel="noopener noreferrer">
            {held ? `“${story.headline}”` : story.headline}
          </a>
        ) : (
          story.headline
        )}
      </h4>
      {story.summary && <p className="news-summary">{story.summary}</p>}
      {story.conflict && (
        <p className="news-conflict" role="note">
          {story.conflict}
        </p>
      )}
      <div className="news-meta small">
        <span className={`news-kind news-kind-${story.kind}`}>{KIND_LABEL[story.kind]}</span>
        <span className={`news-status news-status-${story.status}`}>
          {story.status === 'confirmed' && <SealCheck className="news-seal" aria-hidden="true" />}
          {STATUS_LABEL[story.status]}
        </span>
        {story.conflict && <span className="news-status news-status-conflict">Sources disagree</span>}
        {/* When the story broke (its earliest source), not when its latest source came in. */}
        <time className="muted" dateTime={story.published_at}>
          {ago(story.published_at, now)}
        </time>
        <span className="news-sources">
          <span className="muted">{held ? 'Seen on' : 'via'}</span>{' '}
          {story.sources.map((s, i) => (
            <span key={`${s.source_id}-${i}`} className="news-source-item">
              {s.url ? (
                <a
                  className={`news-source news-src-${s.kind}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.title}
                >
                  {s.name}
                </a>
              ) : (
                <span className={`news-source news-src-${s.kind}`} title={s.title}>
                  {s.name}
                </span>
              )}
            </span>
          ))}
        </span>
      </div>
      {injured.map((p) => (
        <Gains
          key={p.player_id}
          player={p}
          label={injured.length > 1 ? `Who gains with ${p.name} out?` : undefined}
          myTeamId={myTeamId}
          abbrev={abbrev}
          {...ctx}
        />
      ))}
    </article>
  )
}

/** "Who gains?" under an injury story: a bare button that opens the teammates who gain. */
function Gains({
  player,
  label,
  myTeamId,
  abbrev,
  ...impact
}: {
  player: NewsPlayer
  /** Only when a story has more than one injured player, to say whose absence. */
  label?: string
  myTeamId: number | null
  abbrev: Map<number, string>
} & ImpactContext) {
  const [open, setOpen] = useState(false)
  const panelId = `gains-${player.player_id}`
  return (
    <div className="news-gains-wrap">
      <button
        type="button"
        className="news-gains-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        Who gains?
        <CaretDown className="news-gains-caret" aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="news-gains">
          <WhoGains player={player} myTeamId={myTeamId} abbrev={abbrev} {...impact} />
        </div>
      )}
    </div>
  )
}

/** Fantasy owner as a plain abbreviation: yours in ink with the small gold owner dot, a free agent muted. */
function NewsOwner({
  player,
  myTeamId,
  abbrev,
}: {
  player: { owner_team_id?: number | null }
  myTeamId: number | null
  abbrev: Map<number, string>
}) {
  const own = ownership(player, myTeamId, abbrev.size > 0)
  if (own === 'none') return null
  if (own === 'free') {
    return (
      <span className="news-owner news-owner-free" title="Free agent">
        FA<span className="sr-only">Free agent</span>
      </span>
    )
  }
  const code = abbrev.get(player.owner_team_id ?? 0) ?? 'Rival'
  if (own === 'mine') {
    return (
      <span className="news-owner news-owner-mine" title="Your team">
        {code}
        <span className="news-owner-dot" aria-hidden="true" />
        <span className="sr-only">Your team</span>
      </span>
    )
  }
  return <span className="news-owner">{code}</span>
}

/** Face, name and club on one line, with ESPN's injury status when there is one; the owner on the right. */
function PlayerRow({
  player,
  myTeamId,
  abbrev,
}: {
  player: NewsPlayer
  myTeamId: number | null
  abbrev: Map<number, string>
}) {
  const status = shortStatus(player)
  return (
    <li className="news-player">
      <PlayerLink player={{ id: player.player_id, name: player.name }} decorative>
        <PlayerHead player={{ id: player.player_id, name: player.name }} size={32} team={player.pro_team} />
      </PlayerLink>
      <span className="news-player-id news-player-line">
        <span className="news-player-name">
          <PlayerLink player={{ id: player.player_id, name: player.name }} />
        </span>
        <span className="news-player-club">{player.pro_team || 'Free agent'}</span>
        {status && (
          <span className="news-injury" title={`ESPN status: ${status}`}>
            {status}
          </span>
        )}
      </span>
      <NewsOwner player={player} myTeamId={myTeamId} abbrev={abbrev} />
    </li>
  )
}

function WhoGains({
  player,
  myTeamId,
  abbrev,
  leagueId,
  season,
  creds,
}: {
  player: NewsPlayer
  myTeamId: number | null
  abbrev: Map<number, string>
} & ImpactContext) {
  const impact = useQuery({
    queryKey: ['injury-impact', player.player_id, leagueId, season, creds?.swid ?? null],
    queryFn: () => fetchInjuryImpact(player.player_id, leagueId, season, creds),
    retry: false,
    staleTime: 30 * 60_000,
  })
  if (impact.isLoading) {
    return (
      <p className="small muted" role="status">
        Comparing {player.pro_team}'s games with and without{' '}
        <span className="news-keep">
          <PlayerLink player={{ id: player.player_id, name: player.name }} />…
        </span>
      </p>
    )
  }
  if (impact.error || !impact.data) {
    return (
      <div className="row small">
        <span>Couldn't work out who gains. {impact.error?.message}</span>
        <button type="button" className="secondary small" onClick={() => impact.refetch()}>
          Try again
        </button>
      </div>
    )
  }
  return <GainsList data={impact.data} myTeamId={myTeamId} abbrev={abbrev} />
}

function GainsList({
  data,
  myTeamId,
  abbrev,
}: {
  data: InjuryImpact
  myTeamId: number | null
  abbrev: Map<number, string>
}) {
  const games = Math.round(data.games_missed)
  return (
    <div className="stack news-gains-body">
      <p className="small muted">
        {games > 0
          ? `Based on about ${games} ${data.pro_team} game${games === 1 ? '' : 's'} without him, compared with games he played (${data.minutes.toFixed(0)} min a game).`
          : `${data.pro_team} haven't played without him yet, so this is an estimate from positions and minutes.`}
      </p>
      {data.beneficiaries.length === 0 ? (
        <p className="small">No teammate gains clearly enough to matter for fantasy.</p>
      ) : (
        <ol className="news-gains-list">
          {data.beneficiaries.map((b) => (
            <GainRow key={b.player_id} b={b} myTeamId={myTeamId} abbrev={abbrev} />
          ))}
        </ol>
      )}
      <details className="footnote">
        <summary>How this is worked out</summary>
        <p>{data.method}</p>
        <p>{data.track_record}</p>
      </details>
    </div>
  )
}

function GainRow({ b, myTeamId, abbrev }: { b: Beneficiary; myTeamId: number | null; abbrev: Map<number, string> }) {
  const gains = topGains(b.gains)
  return (
    <li className="news-gain">
      <div className="row news-gain-head">
        <PlayerLink player={{ id: b.player_id, name: b.name }} decorative>
          <PlayerHead player={{ id: b.player_id, name: b.name }} size={28} />
        </PlayerLink>
        <span className="name">
          <PlayerLink player={{ id: b.player_id, name: b.name }} />
        </span>
        <NewsOwner player={b} myTeamId={myTeamId} abbrev={abbrev} />
        <span className={`news-conf news-conf-${b.confidence}`}>{CONFIDENCE_LABEL[b.confidence]}</span>
      </div>
      <div className="row small">
        <span className="num">
          {b.minutes_before.toFixed(0)} → {b.minutes_after.toFixed(0)} min
        </span>
        <span className="muted num">({minutesChange(b)})</span>
        {gains.length > 0 && <span className="num">{gains.join(' · ')}</span>}
      </div>
      {b.note && <p className="small muted">{b.note}.</p>}
    </li>
  )
}

function Trending({
  players,
  myTeamId,
  abbrev,
}: {
  players: TrendingPlayer[]
  myTeamId: number | null
  abbrev: Map<number, string>
}) {
  if (players.length === 0) return null
  return (
    <section className="news-side news-trend-rail" aria-labelledby="trending-h">
      <h3 id="trending-h" className="news-rail-head">
        <TrendUp aria-hidden="true" />
        Trending pickups
      </h3>
      <ol className="news-trending">
        {players.slice(0, 8).map((p) => (
          <li key={p.player_id} className="news-trend">
            <PlayerLink player={{ id: p.player_id, name: p.name }} decorative>
              <PlayerHead player={{ id: p.player_id, name: p.name }} size={32} team={p.pro_team} />
            </PlayerLink>
            <span className="news-player-id">
              <span className="news-player-name">
                <PlayerLink player={{ id: p.player_id, name: p.name }} />
              </span>
              <span className="news-player-sub small muted">
                {p.pro_team || 'Free agent'} · <span className="num">{p.percent_owned.toFixed(0)}%</span> rostered
              </span>
            </span>
            <NewsOwner player={p} myTeamId={myTeamId} abbrev={abbrev} />
            <span
              className="num news-trend-change"
              title={`Share of ESPN leagues rostering him, today: ${p.percent_change >= 0 ? '+' : '−'}${Math.abs(p.percent_change).toFixed(1)} points`}
            >{`${p.percent_change >= 0 ? '+' : '−'}${Math.abs(p.percent_change).toFixed(1)}%`}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Source health, folded into one quiet line: it matters when something looks thin, not on every
 * visit. Open, each source with its state in words. When the sources were last checked is under
 * Refresh news, so it isn't repeated here.
 */
function Sources({ sources, now }: { sources: NewsSourceHealth[]; now: Date }) {
  const [open, setOpen] = useState(false)
  const answering = sources.filter((s) => s.ok === true).length
  return (
    <section className="news-srcs-sec" aria-label="Sources">
      <button
        type="button"
        className="news-srcs-row"
        aria-expanded={open}
        aria-controls="news-src-list"
        onClick={() => setOpen((o) => !o)}
      >
        <Pulse className="news-srcs-ic" aria-hidden="true" />
        <span className="news-srcs-sum">
          <b>Sources</b> · {answering} of {sources.length} answering
        </span>
        <CaretDown className="news-srcs-caret" aria-hidden="true" />
      </button>
      <ul id="news-src-list" className="news-health" hidden={!open}>
        {sources.map((s) => (
          <li key={s.source_id}>
            <span className="news-health-name">
              {s.name}
              {s.kind === 'tip' && <span className="news-health-tip"> · tips only</span>}
            </span>
            <span className={s.ok === false ? 'news-health-state news-health-down' : 'news-health-state'}>
              {s.ok === false
                ? `Not answering${s.last_success ? `, last ${ago(s.last_success, now)}` : ''}`
                : s.ok
                  ? `${s.items} items`
                  : 'Waiting'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EmptyNews({ data }: { data: NewsPage }) {
  if (data.refreshing) {
    return (
      <div className="stack news-empty">
        <p>Checking every source now.</p>
        <p className="small muted">Stories appear in a minute.</p>
      </div>
    )
  }
  if (data.stories.length === 0) {
    return (
      <div className="stack news-empty">
        <p>No checked stories in the last 7 days.</p>
      </div>
    )
  }
  return (
    <div className="stack news-empty">
      <p>No stories match.</p>
      <p className="small muted">Try All NBA or another filter.</p>
    </div>
  )
}

/** How a story gets published: the shipped five notes, in the shared How this works row. */
const HOW_NOTES = [
  <>
    Every 15 minutes, or when you press Refresh news, the site reads ESPN's player data and several news outlets. Reddit
    counts only as a tip.
  </>,
  <>Items naming the same player and the same kind of news within two days become one story.</>,
  <>
    <b>Confirmed</b>: ESPN's data agrees (an injury status, a team change) or two independent outlets report it.{' '}
    <b>Reported</b>: one outlet. A story seen only on social sites is not published.
  </>,
  <>A trade reported as done is marked "Didn't happen" if the player's team hasn't changed three days later.</>,
  <>
    Headlines and summaries are the sources' own. When sources disagree on an injury, the story shows each version.
  </>,
]
