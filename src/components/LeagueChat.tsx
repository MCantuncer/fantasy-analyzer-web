import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FeedSkeleton } from './Skeleton'
import { VerifyBanner } from './VerifyBanner'
import type { InfiniteData } from '@tanstack/react-query'
import { useState } from 'react'
import { createPost, deletePost, fetchFeed, fetchReplies, react, retryDropped, retryDroppedDelay } from '../api/client'
import type { FeedItem, FeedPage, FeedTeam, LeagueRef, Reactions } from '../api/client'
import { Gavel, User, UserPlus } from '@phosphor-icons/react'
import type { Credentials } from '../lib/credentials'
import {
  FILTERS,
  REACTIONS,
  beatenBids,
  biggestBidId,
  dayDate,
  daySummary,
  faabLine,
  faabLineId,
  groupByDay,
  isMoment,
  matches,
  postId,
  teamAbbrev,
  teamName,
  timeLabel,
  timeRunStarts,
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
import { FilmPostCard } from './FilmShare'
import { filmPostNote, filmPostPeriod } from '../lib/filmRoom'

interface Props {
  leagueId: number
  season: number
  creds: Credentials | null
  /** Shown instead of the composer to accounts that haven't verified a team here. */
  onVerify?: () => void
  /** Opens a week's Film Room from a shared game-balls card. */
  onOpenFilm?: (period: number) => void
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
  /** The one move that carries the FAAB-leader line: the newest by the team that spent the most. */
  faabId: string | null
  link: Poster | null
  creds: Credentials | null
  onReact: (item: FeedItem, reaction: string, on: boolean) => void
  onDelete: (item: FeedItem) => void
  onOpenFilm?: (period: number) => void
}

export function LeagueChat({ leagueId, season, creds, onVerify, onOpenFilm }: Props) {
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
    // A dropped request (a phone switching apps, Render restarting) is asked again, not shown as a failure.
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
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
    return <FeedSkeleton />
  }
  // A failed refresh keeps the feed on screen; only a feed that never loaded shows the error card.
  if (!feed.data || !first) {
    return (
      <div className="card error stack">
        <h2>Couldn't load the league feed</h2>
        <p>{feed.error instanceof Error ? feed.error.message : 'Try again in a moment.'}</p>
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
    faabId: faabLineId(items, teams, first.faab_budget ?? null),
    link,
    creds,
    onReact: (item, r, on) => reaction.mutate({ item, reaction: r, on }),
    onDelete: (item) => removal.mutate(item),
    onOpenFilm,
  }
  const starts = timeRunStarts(items)

  return (
    <div className="chat-layout">
      <div className="chat-main stack">
        {link ? (
          <Composer ctx={ctx} target={null} placeholder="Talk to the league…" />
        ) : (
          onVerify && (
            <VerifyBanner detail="Verify it to post, reply and react." action="Verify" onClick={onVerify} />
          )
        )}

        {feed.isError && (
          <p className="chat-stale small muted" role="status">
            Couldn't refresh the feed just now. Trying again shortly.
          </p>
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

        {(items.length > 0 || feed.hasNextPage) && (
          <ol className="feed-wire" aria-label="League moves, newest first">
            {groupByDay(items).map((g) => (
              <Day key={g.label} label={g.label} items={g.items} ctx={ctx} starts={starts} />
            ))}
            {feed.hasNextPage && (
              <li className="feed-entry feed-end">
                <span className="feed-node" aria-hidden="true" />
                <button className="secondary" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
                  {feed.isFetchingNextPage ? 'Loading…' : 'Show the week before'}
                </button>
              </li>
            )}
          </ol>
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

function Day({ label, items, ctx, starts }: { label: string; items: FeedItem[]; ctx: Ctx; starts: Set<string> }) {
  const summary = daySummary(items, ctx.budget)
  const date = dayDate(items[0].at)
  return (
    <>
      <li className="feed-entry feed-day">
        <span className="feed-node" aria-hidden="true" />
        <h3 className="feed-day-label">{label}</h3>
        {date && <span className="feed-day-date">{date}</span>}
        {summary && (
          <span className="feed-day-summary">
            {summary.split(/(\$\d+)/).map((part, i) =>
              i % 2 ? (
                <b key={i} className="num">
                  {part}
                </b>
              ) : (
                part
              ),
            )}
          </span>
        )}
      </li>
      {items.map((item) => (
        <Entry key={item.id} item={item} ctx={ctx} start={starts.has(item.id)} />
      ))}
    </>
  )
}

function Entry({ item, ctx, start }: { item: FeedItem; ctx: Ctx; start: boolean }) {
  if (item.kind === 'post' || item.kind === 'trade') {
    const teamIds = item.kind === 'trade' ? tradeSides(item).map((s) => s.teamId) : [item.team_id]
    return (
      <li className={`feed-entry feed-moment feed-moment-${item.kind}`}>
        <span className={teamIds.length > 1 ? 'feed-node feed-node-pair' : 'feed-node'} aria-hidden="true">
          {teamIds.slice(0, 2).map((id) => (
            <TeamCrest
              key={id}
              name={teamName(ctx.teams, id)}
              colour={ctx.colours.get(id)}
              size={item.kind === 'post' ? 28 : 24}
            />
          ))}
        </span>
        {item.kind === 'post' ? <Post item={item} ctx={ctx} /> : <Trade item={item} ctx={ctx} />}
        <time className="feed-time" dateTime={item.at} aria-hidden="true">
          {timeLabel(item.at)}
        </time>
      </li>
    )
  }
  // Moves with replies only become moments where the replies can be read.
  const moment = ctx.link != null && isMoment(item)
  return (
    <>
      {start && (
        <li className="feed-tick" aria-hidden="true">
          {timeLabel(item.at)}
        </li>
      )}
      <li className={moment ? 'feed-entry feed-moment feed-moment-move' : 'feed-entry feed-line'}>
        <span className="feed-node" aria-hidden="true">
          <TeamCrest name={teamName(ctx.teams, item.team_id)} colour={ctx.colours.get(item.team_id)} size={24} />
        </span>
        <FeedLine item={item} ctx={ctx} />
        <time className={start ? 'feed-time' : 'sr-only'} dateTime={item.at}>
          {timeLabel(item.at)}
        </time>
        <Social item={item} ctx={ctx} />
      </li>
    </>
  )
}

function You() {
  return (
    <>
      <User className="feed-you" size={13} weight="bold" aria-hidden="true" />
      <span className="sr-only">(you)</span>
    </>
  )
}

function FeedPlayerCell({
  move,
  face,
  sign,
  label,
}: {
  move: NonNullable<FeedItem['moves']>[number]
  face: number
  sign: string
  label: string
}) {
  return (
    <span className="feed-player">
      <span className="feed-mark" aria-hidden="true">
        {sign}
      </span>
      <span className="sr-only">{label}</span>
      <span className="feed-face">
        <PlayerLink player={move.player} decorative>
          <PlayerHead player={move.player} size={face} />
        </PlayerLink>
      </span>
      <span className="feed-pn">
        <PlayerLink player={move.player} />
      </span>
      {move.player.position && <span className="feed-pos">{move.player.position}</span>}
    </span>
  )
}

function FeedLine({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const moves = item.moves ?? []
  const adds = moves.filter((m) => m.kind !== 'drop')
  const drops = moves.filter((m) => m.kind === 'drop')
  const big = ctx.bigId === item.id
  const beat = beatenBids(item, ctx.budget)
  const faab = ctx.faabId === item.id ? faabLine(item, ctx.teams, ctx.budget) : null
  return (
    <div className="feed-row">
      <span className="feed-team">
        <span className="feed-team-name">{teamName(ctx.teams, item.team_id)}</span>
        {ctx.link?.teamId === item.team_id && <You />}
      </span>
      <span className="feed-players">
        {adds.length > 0 && (
          <span className="feed-add">
            {adds.map((m) => (
              <FeedPlayerCell key={m.player.id} move={m} face={32} sign="+" label="Added" />
            ))}
          </span>
        )}
        {drops.length > 0 && (
          <span className="feed-drop">
            {drops.map((m) => (
              <FeedPlayerCell key={m.player.id} move={m} face={24} sign="−" label="Dropped" />
            ))}
          </span>
        )}
      </span>
      <span className="feed-slot">
        {item.kind === 'free_agent' ? (
          <>
            <UserPlus size={15} aria-hidden="true" />
            <span className="feed-slot-label">Free agent</span>
          </>
        ) : ctx.budget ? (
          <>
            <Gavel size={15} aria-hidden="true" />
            <span className="sr-only">Waiver bid</span>
            <span className="feed-bid num">${item.bid ?? 0}</span>
          </>
        ) : (
          <>
            <Gavel size={15} aria-hidden="true" />
            <span className="feed-slot-label">Waiver</span>
          </>
        )}
      </span>
      {(big || beat || faab) && (
        <span className="feed-meta">
          {big && <span className="feed-meta-big">Biggest bid this week</span>}
          {beat && (
            <span className="feed-beat">
              Beat {beat.count} {beat.count === 1 ? beat.unit : `${beat.unit}s`}
              {beat.rows.map((r, i) => (
                <span key={i} className="feed-beat-row">
                  <span className="sr-only">{teamName(ctx.teams, r.teamId)}</span>
                  <TeamCrest name={teamName(ctx.teams, r.teamId)} colour={ctx.colours.get(r.teamId)} size={16} />
                  {r.bid != null && <span className="num">${r.bid}</span>}
                </span>
              ))}
            </span>
          )}
          {faab && <span>{faab}</span>}
        </span>
      )}
    </div>
  )
}

function Trade({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const sides = tradeSides(item)
  const votes = wonVotes(item)
  return (
    <div className="feed-trade">
      <header className="feed-trade-head">
        <span className="feed-pill trade">Trade</span>
        <time className="small muted feed-inline-time" dateTime={item.at}>
          {timeLabel(item.at)}
        </time>
      </header>
      {sides.map((s) => (
        <div key={s.teamId} className="feed-side">
          <span className="feed-side-head">
            <TeamCrest name={teamName(ctx.teams, s.teamId)} colour={ctx.colours.get(s.teamId)} size={22} />
            <span className="feed-side-team">{teamName(ctx.teams, s.teamId)} get</span>
          </span>
          <ul className="feed-side-list">
            {(s.gets ?? []).map((m) => (
              <li key={m.player.id}>
                <FeedPlayerCell move={m} face={32} sign="+" label="Gets" />
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
    </div>
  )
}

function Post({ item, ctx, compact = false }: { item: FeedItem; ctx: Ctx; compact?: boolean }) {
  const mine = ctx.link?.teamId === item.team_id
  return (
    <article className={compact ? 'feed-post compact' : 'feed-post'}>
      {compact && (
        <span className="feed-avatar" aria-hidden="true">
          {teamAbbrev(ctx.teams, item.team_id)}
        </span>
      )}
      <div className="stack feed-post-body">
        <div className="row feed-post-head">
          <span className="feed-team">{teamName(ctx.teams, item.team_id)}</span>
          <time className={compact ? 'small muted' : 'small muted feed-inline-time'} dateTime={item.at}>
            {timeLabel(item.at)}
          </time>
          {mine && (
            <button className="link small feed-delete" onClick={() => ctx.onDelete(item)}>
              Delete
            </button>
          )}
        </div>
        {(() => {
          const period = filmPostPeriod(item.body ?? '')
          if (period == null) return <p className="feed-text">{item.body}</p>
          const note = filmPostNote(item.body ?? '')
          return (
            <>
              {note && <p className="feed-text">{note}</p>}
              <FilmPostCard
                leagueRef={ctx.ref}
                creds={ctx.creds}
                period={period}
                name={(id) => teamName(ctx.teams, id)}
                colours={ctx.colours}
                onOpen={ctx.onOpenFilm}
              />
            </>
          )
        })()}
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
              className="chip sm feed-reaction"
              aria-pressed={on}
              aria-label={n > 0 ? `${x.label}, ${n}` : x.label}
              title={x.label}
              onClick={() => {
                ctx.onReact(item, x.key, !on)
                setPicking(false)
              }}
            >
              <span className="feed-reaction-emoji" aria-hidden="true">
                {x.emoji}
              </span>
              {n > 0 && (
                <span className="num" aria-hidden="true">
                  {n}
                </span>
              )}
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
