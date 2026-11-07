import { useQuery } from '@tanstack/react-query'
import { NewsSkeleton } from './Skeleton'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
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
  FILTERS,
  KIND_LABEL,
  ago,
  countBy,
  groupByDay,
  inFilter,
  inScope,
  minutesChange,
  ownership,
  shortStatus,
  statusText,
  topGains,
} from '../lib/news'
import type { NewsFilter, NewsScope } from '../lib/news'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { NewsRefresh } from './NewsRefresh'
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
  if (news.error || !news.data) {
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
  const shown = scoped.filter((s) => inFilter(s, filter))
  const scopes: { id: NewsScope; label: string }[] = [
    { id: 'nba', label: 'All NBA' },
    { id: 'league', label: 'In My League' },
    ...(myTeamId !== null ? [{ id: 'mine' as const, label: 'My Roster' }] : []),
  ]

  return (
    <div className="stack news">
      <header className="news-head">
        <h2>NBA News</h2>
        <p className="small muted">
          Injuries, trades and role changes from around the NBA, checked against several sources before they show.
        </p>
        <NewsRefresh data={data} now={now} refresh={refresh} />
      </header>

      <div className="news-toolbar">
        <div
          className="news-scope"
          role="group"
          aria-label="Which players"
          style={{ '--news-scope-count': scopes.length } as CSSProperties}
        >
          {scopes.map((s) => (
            <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => setScope(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="news-filters" role="group" aria-label="Kind of news">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="news-filter"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span className="num">{countBy(scoped, f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="split">
        <div className="wide">
          <section className="card flush news-feed" aria-label="Stories">
            {shown.length === 0 ? (
              <EmptyNews data={data} />
            ) : (
              groupByDay(shown, now).map((g) => (
                <div key={g.day}>
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
          <label className="row small muted news-held">
            <input type="checkbox" checked={showHeld} onChange={(e) => setShowHeld(e.target.checked)} />
            Show stories seen only on social sites (not published)
          </label>
        </div>
        <div className="narrow stack news-rail">
          <Trending players={data.trending} myTeamId={myTeamId} abbrev={abbrev} />
          <Sources sources={data.sources} updatedAt={data.updated_at ?? null} now={now} />
        </div>
      </div>

      <HowItWorks />
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
  const mine = myTeamId !== null && story.players.some((p) => p.owner_team_id === myTeamId)
  return (
    <article className="news-story" data-status={story.status} data-mine={mine || undefined}>
      {story.players.length > 0 && (
        <ul className="news-players">
          {story.players.map((p) => (
            <PlayerRow
              key={p.player_id}
              player={p}
              myTeamId={myTeamId}
              abbrev={abbrev}
              // Only published injury stories, and only for a player on an NBA team.
              impact={story.kind === 'injury' && !held && p.pro_team ? ctx : null}
            />
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
          {story.conflict} Treat the worse version as true until the official injury report settles it.
        </p>
      )}
      <div className="news-meta small">
        <span className={`news-kind news-kind-${story.kind}`}>{KIND_LABEL[story.kind]}</span>
        <span className={`news-status news-status-${story.status}`}>{statusText(story)}</span>
        {story.conflict && <span className="news-status news-status-conflict">Sources disagree</span>}
        <span className="muted">{ago(story.updated_at, now)}</span>
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
    </article>
  )
}

/** Fantasy owner as one compact chip: always the team's abbreviation; yours gets an accent tint and a dot. */
function OwnerChip({
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
        <span className="news-owner-dot" aria-hidden="true" />
        {code}
        <span className="sr-only">Your team</span>
      </span>
    )
  }
  return <span className="news-owner">{code}</span>
}

function PlayerRow({
  player,
  myTeamId,
  abbrev,
  impact,
}: {
  player: NewsPlayer
  myTeamId: number | null
  abbrev: Map<number, string>
  impact: ImpactContext | null
}) {
  const [open, setOpen] = useState(false)
  const status = shortStatus(player)
  const panelId = `gains-${player.player_id}`
  return (
    <li className="news-player">
      <PlayerLink player={{ id: player.player_id, name: player.name }} decorative>
        <PlayerHead player={{ id: player.player_id, name: player.name }} size={36} team={player.pro_team} />
      </PlayerLink>
      <span className="news-player-id">
        <span className="news-player-name">
          <PlayerLink player={{ id: player.player_id, name: player.name }} />
        </span>
        <span className="news-player-sub small muted">
          <TeamLogo abbrev={player.pro_team} size={16} />
          {player.pro_team || 'Free agent'}
          {status && <span className="news-injury">ESPN: {status}</span>}
        </span>
      </span>
      <OwnerChip player={player} myTeamId={myTeamId} abbrev={abbrev} />
      {impact && (
        <button
          type="button"
          className="secondary news-gains-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide' : 'Who gains?'}
        </button>
      )}
      {impact && open && (
        <div id={panelId} className="news-gains">
          <WhoGains player={player} myTeamId={myTeamId} abbrev={abbrev} {...impact} />
        </div>
      )}
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
        Comparing {player.pro_team}'s games with and without {player.name}…
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
          ? `Based on about ${games} ${data.pro_team} game${games === 1 ? '' : 's'} without him (older games count less), compared with games he played (${data.minutes.toFixed(0)} min a game).`
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
        <OwnerChip player={b} myTeamId={myTeamId} abbrev={abbrev} />
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
    <section className="card stack news-side" aria-labelledby="trending-h">
      <div>
        <h3 id="trending-h">Trending pickups</h3>
        <p className="small muted">Biggest rise today in % of ESPN leagues rostering him.</p>
      </div>
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
                <TeamLogo abbrev={p.pro_team} size={14} />
                {p.pro_team || 'Free agent'} · <span className="num">{p.percent_owned.toFixed(0)}%</span> rostered
              </span>
            </span>
            <OwnerChip player={p} myTeamId={myTeamId} abbrev={abbrev} />
            <span className="num news-trend-change">{`${p.percent_change >= 0 ? '+' : '−'}${Math.abs(p.percent_change).toFixed(1)}`}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Source health, folded into one line: it matters when something looks thin, not on every visit. */
function Sources({ sources, updatedAt, now }: { sources: NewsSourceHealth[]; updatedAt: string | null; now: Date }) {
  const answering = sources.filter((s) => s.ok === true).length
  const down = sources.filter((s) => s.ok === false).length
  return (
    <details className="card news-side news-health-card">
      <summary>
        <span className={`news-dot ${down > 0 ? 'down' : answering > 0 ? 'ok' : 'idle'}`} aria-hidden="true" />
        <span className="grow">
          <span className="news-health-title">Sources</span>{' '}
          <span className="small muted">
            {answering} of {sources.length} answering
            {updatedAt ? ` · checked ${ago(updatedAt, now)}` : ' · not checked yet'}
          </span>
        </span>
      </summary>
      <ul className="news-health">
        {sources.map((s) => (
          <li key={s.source_id}>
            <span
              className={`news-dot ${s.ok === true ? 'ok' : s.ok === false ? 'down' : 'idle'}`}
              aria-hidden="true"
            />
            <span className="grow">
              {s.name}
              {s.kind === 'tip' && <span className="small muted"> (tips only)</span>}
            </span>
            <span className="small muted">
              {s.ok === false
                ? `Not answering${s.last_success ? `, last ${ago(s.last_success, now)}` : ''}`
                : s.ok
                  ? `${s.items} items`
                  : 'Waiting'}
            </span>
          </li>
        ))}
      </ul>
    </details>
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
        <p className="small muted">
          A story shows once ESPN's data confirms it or an outlet reports it. The source list says which sources are
          answering.
        </p>
      </div>
    )
  }
  return (
    <div className="stack news-empty">
      <p>No stories match.</p>
      <p className="small muted">Try "All NBA" or another filter.</p>
    </div>
  )
}

function HowItWorks() {
  return (
    <details className="footnote">
      <summary>How a story gets published</summary>
      <ul>
        <li>
          Every 15 minutes, or when you press Refresh news, the site reads ESPN's player data and several news outlets.
          Reddit counts only as a tip.
        </li>
        <li>Items naming the same player and the same kind of news within two days become one story.</li>
        <li>
          Confirmed: ESPN's data agrees (an injury status, a team change) or two independent outlets report it.
          Reported: one outlet. A story seen only on social sites is not published.
        </li>
        <li>
          A trade reported as done is marked "Didn't happen" if the player's team hasn't changed three days later.
        </li>
        <li>
          Headlines and summaries are the sources' own. When sources disagree on an injury, the story shows each
          version.
        </li>
      </ul>
    </details>
  )
}
