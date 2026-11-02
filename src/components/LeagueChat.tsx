import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { createPost, deletePost, fetchFeed, fetchReplies, react } from '../api/client'
import type { FeedItem, FeedPage, FeedTeam, LeagueRef, Reactions } from '../api/client'
import type { Credentials } from '../lib/credentials'
import {
  FILTERS,
  REACTIONS,
  bidLine,
  biggestBidId,
  daySummary,
  faabLine,
  groupByDay,
  matches,
  postId,
  teamAbbrev,
  teamName,
  timeLabel,
  tradeSides,
  wonVotes,
} from '../lib/feed'
import type { Filter } from '../lib/feed'
import { pct } from '../lib/format'
import { teamColours } from '../lib/league'
import './LeagueChat.css'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import { PlayerLink } from './PlayerCard'

interface Props {
  leagueId: number
  season: number
  creds: Credentials | null
  /** Shown instead of the composer to accounts that haven't verified a team here. */
  onVerify?: () => void
}

// The verified team this account posts as; null shows moves only.
interface Poster {
  teamId: number
  teamName: string
}

// Fresh enough for a group chat without a socket; a free server can't hold connections open.
const REFRESH_MS = 30_000

interface Ctx {
  ref: LeagueRef
  teams: FeedTeam[]
  budget: number | null
  /** Team id to crest colour; your team is the accent. */
  colours: Map<number, string>
  /** The week's single biggest waiver bid, which gets a highlighted card. */
  bigId: string | null
  link: Poster | null
  creds: Credentials | null
  onReact: (item: FeedItem, reaction: string, on: boolean) => void
  onDelete: (item: FeedItem) => void
}

export function LeagueChat({ leagueId, season, creds, onVerify }: Props) {
  const ref: LeagueRef = { leagueId, season }
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const feedKey = ['feed', leagueId, season]

  const feed = useInfiniteQuery({
    queryKey: feedKey,
    queryFn: ({ pageParam }) => fetchFeed(ref, pageParam, creds),
    initialPageParam: 0,
    getNextPageParam: (last: FeedPage) => (last.has_more ? last.page + 1 : undefined),
    refetchInterval: REFRESH_MS,
  })

  const first = feed.data?.pages[0]
  const link: Poster | null = first?.me ? { teamId: first.me.team_id, teamName: first.me.team_name } : null

  function patchItem(id: string, patch: (item: FeedItem) => FeedItem) {
    qc.setQueryData<InfiniteData<FeedPage>>(feedKey, (data) =>
      data
        ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? patch(i) : i)) })) }
        : data,
    )
    qc.setQueriesData<{ target: string; items: FeedItem[] }>({ queryKey: ['replies', leagueId, season] }, (data) =>
      data ? { ...data, items: data.items.map((i) => (i.id === id ? patch(i) : i)) } : data,
    )
  }

  const reaction = useMutation({
    mutationFn: (v: { item: FeedItem; reaction: string; on: boolean }) =>
      react(ref, v.item.id, v.reaction, v.on, creds),
    onSuccess: (out) => patchItem(out.target, (i) => ({ ...i, reactions: out.reactions })),
  })

  const removal = useMutation({
    mutationFn: (item: FeedItem) => deletePost(ref, postId(item)!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', leagueId, season] })
      qc.invalidateQueries({ queryKey: ['replies', leagueId, season] })
    },
  })

  if (feed.isPending) {
    return <div className="card muted">Loading the league feed…</div>
  }
  if (feed.isError || !first) {
    return (
      <div className="card error stack">
        <h2>Couldn't load the league feed</h2>
        <p>{feed.error?.message}</p>
        <div className="row">
          <button className="secondary" onClick={() => feed.refetch()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const teams = first.teams
  const seen = new Set<string>()
  const items = feed.data.pages
    .flatMap((p) => p.items)
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .filter((i) => matches(i, filter, link?.teamId ?? null))
  const ctx: Ctx = {
    ref,
    teams,
    budget: first.faab_budget ?? null,
    colours: teamColours(
      teams.map((t) => t.id),
      link?.teamId ?? null,
    ),
    bigId: first.faab_budget ? biggestBidId(first.items) : null,
    link,
    creds,
    onReact: (item, r, on) => reaction.mutate({ item, reaction: r, on }),
    onDelete: (item) => removal.mutate(item),
  }

  return (
    <div className="chat-layout">
      <div className="chat-main stack">
        {link ? (
          <Composer ctx={ctx} target={null} placeholder="Talk to the league…" />
        ) : (
          onVerify && (
            <div className="verify-banner">
              <span>Manage a team here? Verify it to post, reply and react.</span>
              <button type="button" onClick={onVerify}>
                Verify
              </button>
            </div>
          )
        )}

        <div className="chat-filters" role="group" aria-label="Show">
          {FILTERS.filter((f) => link || (f.id !== 'post' && f.id !== 'mine')).map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {items.length === 0 && (
          <div className="card empty">
            {filter === 'all' ? 'Nothing has happened in this league yet this week.' : 'Nothing like that this week.'}
          </div>
        )}

        {groupByDay(items).map((g) => {
          const summary = daySummary(g.items, ctx.budget)
          return (
            <section key={g.label} className="stack chat-day" aria-label={g.label}>
              <h3 className="chat-day-label feed-day-label">
                {g.label}
                {summary && <span className="feed-day-summary"> · {summary}</span>}
              </h3>
              <div className="feed-grid">
                {g.items.map((item) => (
                  <Item key={item.id} item={item} ctx={ctx} />
                ))}
              </div>
            </section>
          )
        })}

        {feed.hasNextPage && (
          <button className="secondary" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            {feed.isFetchingNextPage ? 'Loading…' : 'Show the week before'}
          </button>
        )}
      </div>

      <aside className="chat-rail stack">
        {link && (
          <section className="card stack chat-me">
            <span className="kpi-label">Posting as</span>
            <strong>{link.teamName}</strong>
          </section>
        )}
        {first.faab_budget ? (
          <FaabSpent teams={teams} budget={first.faab_budget} myTeamId={link?.teamId ?? null} />
        ) : null}
      </aside>
    </div>
  )
}

function FaabSpent({ teams, budget, myTeamId }: { teams: FeedTeam[]; budget: number; myTeamId: number | null }) {
  const rows = [...teams].sort((a, b) => (b.faab_spent ?? 0) - (a.faab_spent ?? 0))
  const idle = rows.filter((t) => !t.faab_spent).length
  return (
    <section className="card stack" aria-labelledby="faab-title">
      <h2 id="faab-title" className="kpi-label">
        FAAB spent
      </h2>
      <table className="faab-table">
        <tbody>
          {rows
            .filter((t) => t.faab_spent)
            .map((t) => (
              <tr key={t.id} className={t.id === myTeamId ? 'me' : undefined}>
                <th scope="row">{t.name}</th>
                <td className="num">${t.faab_spent}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <span className="small muted">
        Of ${budget} each.{idle > 0 && ` ${idle} ${idle === 1 ? 'team has' : 'teams have'} not spent any yet.`}
      </span>
    </section>
  )
}

function Item({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  if (item.kind === 'post') return <Post item={item} ctx={ctx} />
  if (item.kind === 'trade') return <Trade item={item} ctx={ctx} />
  return <Move item={item} ctx={ctx} />
}

function MoveLines({ item, note }: { item: FeedItem; note?: string | null }) {
  const moves = item.moves ?? []
  const adds = moves.filter((m) => m.kind !== 'drop')
  const drops = moves.filter((m) => m.kind === 'drop')
  return (
    <ul className="feed-tile-moves">
      {adds.map((m, i) => (
        <li key={`add-${m.player.id}`} className="feed-tile-add">
          <span className="feed-tile-sign" aria-label="Added">
            +
          </span>
          <PlayerLink player={m.player} decorative>
            <PlayerHead player={m.player} size={36} />
          </PlayerLink>
          <span className="feed-tile-who">
            <span className="feed-tile-name">
              <PlayerLink player={m.player} />
              {m.player.position && <span className="feed-pos"> {m.player.position}</span>}
            </span>
            {i === 0 && note && <span className="feed-tile-note">{note}</span>}
          </span>
        </li>
      ))}
      {drops.map((m) => (
        <li key={`drop-${m.player.id}`} className="feed-tile-drop">
          <span className="feed-tile-sign" aria-label="Dropped">
            −
          </span>
          <PlayerLink player={m.player} decorative>
            <PlayerHead player={m.player} size={26} />
          </PlayerLink>
          <span className="feed-tile-name">
            <PlayerLink player={m.player} />
            {m.player.position && <span className="feed-pos"> {m.player.position}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function TileHead({ ctx, teamId, label, children }: { ctx: Ctx; teamId: number; label: string; children: ReactNode }) {
  return (
    <header className="feed-tile-head">
      <TeamCrest name={label} colour={ctx.colours.get(teamId)} size={28} />
      <span className="feed-tile-team">{label}</span>
      {children}
    </header>
  )
}

function Move({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const big = ctx.bigId === item.id
  const bids = bidLine(item, ctx.teams, ctx.budget)
  const note = big
    ? `Biggest bid this week.${bids ? ` ${bids}` : ''}`
    : (bids ?? (item.kind === 'waiver' ? 'No other claims.' : 'Straight off free agency.'))
  const faab = faabLine(item, ctx.teams, ctx.budget)
  const mine = ctx.link?.teamId === item.team_id
  return (
    <article className={['card', 'feed-tile', mine && 'mine', big && 'big'].filter(Boolean).join(' ')}>
      <TileHead ctx={ctx} teamId={item.team_id} label={teamName(ctx.teams, item.team_id)}>
        <span className={item.kind === 'waiver' ? 'feed-pill waiver' : 'feed-pill fa'}>
          {item.kind === 'waiver' && ctx.budget ? (
            <>
              Waiver <span className="num">${item.bid ?? 0}</span>
            </>
          ) : item.kind === 'waiver' ? (
            'Waiver'
          ) : (
            'Free agent'
          )}
        </span>
        <time className="small muted" dateTime={item.at}>
          {timeLabel(item.at)}
        </time>
      </TileHead>
      <MoveLines item={item} note={note} />
      {faab && <p className="feed-tile-faab small muted">{faab}</p>}
      <Social item={item} ctx={ctx} />
    </article>
  )
}

function Trade({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const sides = tradeSides(item)
  const votes = wonVotes(item)
  const mine = ctx.link != null && sides.some((s) => s.teamId === ctx.link!.teamId)
  return (
    <article className={['card', 'feed-tile', 'trade', mine && 'mine'].filter(Boolean).join(' ')}>
      <header className="feed-tile-head">
        <span className="feed-pill trade">Trade</span>
        <time className="small muted" dateTime={item.at}>
          {timeLabel(item.at)}
        </time>
      </header>
      {sides.map((s) => (
        <div key={s.teamId} className="feed-tile-side">
          <span className="feed-tile-gets">
            <TeamCrest name={teamName(ctx.teams, s.teamId)} colour={ctx.colours.get(s.teamId)} size={22} />
            <span className="feed-tile-team">{teamName(ctx.teams, s.teamId)} get</span>
          </span>
          <ul className="feed-tile-moves">
            {(s.gets ?? []).map((m) => (
              <li key={m.player.id} className="feed-tile-add">
                <span className="feed-tile-sign" aria-label="Gets">
                  +
                </span>
                <PlayerLink player={m.player} decorative>
                  <PlayerHead player={m.player} size={32} />
                </PlayerLink>
                <span className="feed-tile-name">
                  <PlayerLink player={m.player} />
                  {m.player.position && <span className="feed-pos"> {m.player.position}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {ctx.link && (
        <div className="feed-vote stack">
          <span className="kpi-label">Who won it?</span>
          <div className="row" role="group" aria-label="Who won the trade?">
            {sides.map((s) => (
              <button
                key={s.teamId}
                type="button"
                className="chip"
                aria-pressed={votes.mine === s.teamId}
                onClick={() => ctx.onReact(item, `won:${s.teamId}`, votes.mine !== s.teamId)}
              >
                {teamName(ctx.teams, s.teamId)}
                {votes.mine !== null && votes.total > 0 && (
                  <span className="num">{pct((votes.counts[s.teamId] ?? 0) / votes.total)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <Social item={item} ctx={ctx} />
    </article>
  )
}

function Post({ item, ctx, compact = false }: { item: FeedItem; ctx: Ctx; compact?: boolean }) {
  const mine = ctx.link?.teamId === item.team_id
  return (
    <article className={compact ? 'feed-post compact' : 'feed-post feed-wide'}>
      <span className="feed-avatar" aria-hidden="true">
        {teamAbbrev(ctx.teams, item.team_id)}
      </span>
      <div className="stack feed-post-body">
        <div className="row feed-post-head">
          <span className="feed-team">{teamName(ctx.teams, item.team_id)}</span>
          <time className="small muted" dateTime={item.at}>
            {timeLabel(item.at)}
          </time>
          {mine && (
            <button className="link small feed-delete" onClick={() => ctx.onDelete(item)}>
              Delete
            </button>
          )}
        </div>
        <p className="feed-text">{item.body}</p>
        <Social item={item} ctx={ctx} canReply={!compact} />
      </div>
    </article>
  )
}

function Social({ item, ctx, canReply = true }: { item: FeedItem; ctx: Ctx; canReply?: boolean }) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  if (!ctx.link) return null
  const r: Reactions = item.reactions ?? { counts: {}, mine: [] }
  const replies = item.replies ?? 0
  // Only reactions someone used take up room; the rest sit behind "React".
  const shown = REACTIONS.filter((x) => picking || (r.counts?.[x.key] ?? 0) > 0)
  return (
    <>
      <div className="feed-social">
        {shown.map((x) => {
          const n = r.counts?.[x.key] ?? 0
          const on = (r.mine ?? []).includes(x.key)
          return (
            <button
              key={x.key}
              type="button"
              className="chip sm"
              aria-pressed={on}
              onClick={() => {
                ctx.onReact(item, x.key, !on)
                setPicking(false)
              }}
            >
              {x.label}
              {n > 0 && <span className="num">{n}</span>}
            </button>
          )
        })}
        {!picking && (
          <button
            type="button"
            className="link small feed-react"
            aria-expanded={false}
            onClick={() => setPicking(true)}
          >
            React
          </button>
        )}
        {canReply && (
          <button
            type="button"
            className="link small feed-reply-toggle"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {replies === 0 ? 'Reply' : `${replies} ${replies === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
      </div>
      {open && <Replies item={item} ctx={ctx} />}
    </>
  )
}

function Replies({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const replies = useQuery({
    queryKey: ['replies', ctx.ref.leagueId, ctx.ref.season, item.id],
    queryFn: () => fetchReplies(ctx.ref, item.id),
    refetchInterval: REFRESH_MS,
  })
  return (
    <div className="feed-replies stack">
      {replies.isPending && <span className="small muted">Loading replies…</span>}
      {replies.data?.items.map((p) => (
        <Post key={p.id} item={p} ctx={ctx} compact />
      ))}
      <Composer ctx={ctx} target={item.id} placeholder={`Reply as ${ctx.link!.teamName}`} />
    </div>
  )
}

function Composer({ ctx, target, placeholder }: { ctx: Ctx; target: string | null; placeholder: string }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const send = useMutation({
    mutationFn: (body: string) => createPost(ctx.ref, body, target),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['feed', ctx.ref.leagueId, ctx.ref.season] })
      if (target) qc.invalidateQueries({ queryKey: ['replies', ctx.ref.leagueId, ctx.ref.season, target] })
    },
  })
  const id = `compose-${target ?? 'chat'}`
  return (
    <form
      className={target ? 'composer reply' : 'card composer'}
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) send.mutate(text.trim())
      }}
    >
      {!target && (
        <span className="feed-avatar" aria-hidden="true">
          {teamAbbrev(ctx.teams, ctx.link!.teamId)}
        </span>
      )}
      <label className="sr-only" htmlFor={id}>
        {target ? 'Reply' : 'Message the league'}
      </label>
      <input
        id={id}
        value={text}
        maxLength={500}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" disabled={!text.trim() || send.isPending}>
        {target ? 'Reply' : 'Post'}
      </button>
      {send.error && (
        <span className="small bad composer-error" role="alert">
          {send.error.message}
        </span>
      )}
    </form>
  )
}
