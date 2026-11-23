import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FeedSkeleton } from './Skeleton'
import { VerifyBanner } from './VerifyBanner'
import type { InfiniteData } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { createPost, deletePost, fetchFeed, fetchReplies, react, retryDropped, retryDroppedDelay } from '../api/client'
import type { FeedItem, FeedPage, FeedTeam, LeagueRef } from '../api/client'
import {
  ArrowBendUpLeft,
  ArrowsLeftRight,
  CaretDown,
  ChatCircle,
  FilmSlate,
  Gavel,
  ListBullets,
  Smiley,
  Trash,
  User,
  UserPlus,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { Credentials } from '../lib/credentials'
import {
  FILTERS,
  REACTIONS,
  beatenBids,
  biggestBidId,
  dayDate,
  daySummary,
  faabLeaderId,
  groupByDay,
  isMoment,
  matches,
  postId,
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

// One icon per filter; the label stays Title Case next to it.
const FILTER_ICONS: Record<Filter, Icon> = {
  all: ListBullets,
  trade: ArrowsLeftRight,
  waiver: Gavel,
  free_agent: UserPlus,
  post: ChatCircle,
  mine: User,
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
    link,
    creds,
    onReact: (item, r, on) => reaction.mutate({ item, reaction: r, on }),
    onDelete: (item) => removal.mutate(item),
    onOpenFilm,
  }
  const starts = timeRunStarts(items)

  const budget = first.faab_budget ?? null
  const myTeamId = link?.teamId ?? null

  return (
    <div className={budget ? 'feed-page has-rail' : 'feed-page'}>
      <div className="feed-main">
        {!link && onVerify && (
          <VerifyBanner detail="Verify it to post, reply and react." action="Verify" onClick={onVerify} />
        )}

        {budget ? <FaabSummary teams={teams} budget={budget} myTeamId={myTeamId} colours={ctx.colours} /> : null}

        {feed.isError && (
          <p className="chat-stale small muted" role="status">
            Couldn't refresh the feed just now. Trying again shortly.
          </p>
        )}

        <div className="feed-filters" role="group" aria-label="Show">
          {FILTERS.filter((f) => link || (f.id !== 'post' && f.id !== 'mine')).map((f) => {
            const FilterIcon = FILTER_ICONS[f.id]
            return (
              <button
                key={f.id}
                type="button"
                className="feed-filter"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                <FilterIcon size={16} aria-hidden="true" />
                {f.label}
              </button>
            )
          })}
        </div>

        {(link || items.length > 0 || feed.hasNextPage) && (
          <ol className="feed-wire" aria-label="League moves, newest first">
            {link && (
              <li className="feed-entry chat-compose">
                <span className="feed-node" aria-hidden="true">
                  <TeamCrest name={link.teamName} colour={ctx.colours.get(link.teamId)} size={28} />
                </span>
                <span className="feed-time" aria-hidden="true">
                  Now
                </span>
                <Composer ctx={ctx} target={null} placeholder="Talk to the league…" />
                <p className="chat-as">
                  Posting as <b>{link.teamName}</b>
                </p>
              </li>
            )}
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

        {items.length === 0 && (
          <div className="card empty">
            {filter === 'all' ? 'Nothing has happened in this league yet this week.' : 'Nothing like that this week.'}
          </div>
        )}
      </div>

      {budget ? (
        <aside className="feed-faab" aria-labelledby="feed-faab-title">
          <div className="feed-faab-head">
            <h2 id="feed-faab-title">FAAB spent</h2>
            <span>Of ${budget} each</span>
          </div>
          <FaabList teams={teams} budget={budget} myTeamId={myTeamId} colours={ctx.colours} />
        </aside>
      ) : null}
    </div>
  )
}

interface FaabProps {
  teams: FeedTeam[]
  budget: number
  myTeamId: number | null
  colours: Map<number, string>
}

/** Teams that have spent, most first. */
function spenders(teams: FeedTeam[]): FeedTeam[] {
  return teams.filter((t) => (t.faab_spent ?? 0) > 0).sort((a, b) => (b.faab_spent ?? 0) - (a.faab_spent ?? 0))
}

/** The FAAB table without a box: crest, name, a thin bar of the budget spent, and the amount. */
function FaabList({ teams, budget, myTeamId, colours }: FaabProps) {
  const rows = spenders(teams)
  const idle = teams.length - rows.length
  const leader = faabLeaderId(teams)
  return (
    <>
      <ul className="feed-faab-list">
        {rows.map((t) => {
          const spent = t.faab_spent ?? 0
          return (
            <li key={t.id} className={t.id === myTeamId ? 'feed-faab-row is-me' : 'feed-faab-row'}>
              <TeamCrest name={t.name} colour={colours.get(t.id)} size={20} />
              <span className="feed-faab-name">
                <span className="feed-faab-team">{t.name}</span>
                {t.id === myTeamId && <You />}
                {t.id === leader && <span className="feed-faab-most">Most</span>}
              </span>
              <span className="feed-faab-amt num">${spent}</span>
              <span className="feed-faab-bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
      {idle > 0 && (
        <p className="feed-faab-note">
          {idle} {idle === 1 ? 'team has' : 'teams have'} not spent any yet.
        </p>
      )}
    </>
  )
}

/** Below 1100px the rail folds into one row: the top three spenders, and the full list on open. */
function FaabSummary({ teams, budget, myTeamId, colours }: FaabProps) {
  const top = spenders(teams).slice(0, 3)
  return (
    <details className="feed-faab-sum">
      <summary>
        <b>FAAB spent</b>
        <span className="feed-faab-top">
          {top.map((t) => (
            <span key={t.id} className="num">
              <TeamCrest name={t.name} colour={colours.get(t.id)} size={18} />
              <span className="sr-only">{t.name}</span>${t.faab_spent}
            </span>
          ))}
        </span>
        <span className="feed-faab-all">
          All {teams.length}
          <CaretDown size={14} aria-hidden="true" />
        </span>
      </summary>
      <div className="feed-faab-body">
        <p className="feed-faab-each">Of ${budget} each</p>
        <FaabList teams={teams} budget={budget} myTeamId={myTeamId} colours={colours} />
      </div>
    </details>
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
  return <MoveEntry item={item} ctx={ctx} start={start} />
}

/**
 * A move on the wire. In Chat a plain line carries one trailing React/Reply button that opens a tray
 * in place; once someone replies, the same line is promoted in place to a moment with its thread.
 * The tray and thread state live here so they survive that promotion.
 */
function MoveEntry({ item, ctx, start }: { item: FeedItem; ctx: Ctx; start: boolean }) {
  const chat = ctx.link != null
  // Moves with replies only become moments where the replies can be read.
  const moment = chat && isMoment(item)
  // Animate only a line that turns into a moment while on screen, not moments that load as moments.
  const [wasMoment, setWasMoment] = useState(moment)
  const [promoted, setPromoted] = useState(false)
  if (moment !== wasMoment) {
    setWasMoment(moment)
    setPromoted(moment)
  }
  const [tray, setTray] = useState(false)
  const [thread, setThread] = useState(false)
  const actRef = useRef<HTMLButtonElement>(null)
  const trayId = useId()

  function closeTray() {
    setTray(false)
    actRef.current?.focus()
  }

  const cls = moment
    ? `feed-entry feed-moment feed-moment-move${promoted ? ' is-promoted' : ''}`
    : `feed-entry feed-line${tray || thread ? ' is-open' : ''}`
  return (
    <>
      {start && (
        <li className="feed-tick" aria-hidden="true">
          {timeLabel(item.at)}
        </li>
      )}
      <li className={cls}>
        <span className="feed-node" aria-hidden="true">
          <TeamCrest name={teamName(ctx.teams, item.team_id)} colour={ctx.colours.get(item.team_id)} size={24} />
        </span>
        <FeedLine
          item={item}
          ctx={ctx}
          act={
            chat && !moment ? (
              <ChatAct
                ref={actRef}
                item={item}
                open={tray}
                controls={trayId}
                onToggle={() => setTray(!tray)}
                onClose={closeTray}
              />
            ) : null
          }
        />
        <time className={start ? 'feed-time' : 'sr-only'} dateTime={item.at}>
          {timeLabel(item.at)}
        </time>
        {chat && !moment && tray && (
          <ReactTray
            id={trayId}
            item={item}
            ctx={ctx}
            onClose={closeTray}
            onReply={() => {
              setTray(false)
              setThread(true)
            }}
          />
        )}
        {moment && <Actions item={item} ctx={ctx} thread={thread} onThread={() => setThread(!thread)} />}
        {chat && thread && <Replies item={item} ctx={ctx} focus={!moment} />}
      </li>
    </>
  )
}

/** The reactions used on an item, most used first. */
function usedReactions(item: FeedItem) {
  const counts = item.reactions?.counts ?? {}
  return REACTIONS.map((x) => ({ ...x, n: counts[x.key] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
}

/**
 * One 44px button at the end of a line in Chat. Empty, it's a smiley that hides until hover on a
 * fine pointer (opacity, so it stays in the tab order); with reactions it shows up to two of them
 * and the total, always visible.
 */
function ChatAct({
  ref,
  item,
  open,
  controls,
  name = 'React or reply',
  onToggle,
  onClose,
}: {
  ref: Ref<HTMLButtonElement>
  item: FeedItem
  open: boolean
  controls: string
  /** What the button does: "React or reply" on a move, "React" on a reply. */
  name?: string
  onToggle: () => void
  onClose: () => void
}) {
  const used = usedReactions(item)
  const total = used.reduce((s, x) => s + x.n, 0)
  const label = used.length ? `${used.map((x) => `${x.label}, ${x.n}`).join('; ')}. ${name}` : name
  return (
    <button
      ref={ref}
      type="button"
      className={used.length ? 'chat-act has' : 'chat-act'}
      aria-label={label}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          onClose()
        }
      }}
    >
      {used.length ? (
        <>
          {used.slice(0, 2).map((x) => (
            <span key={x.key} className="chat-emo" aria-hidden="true">
              {x.emoji}
            </span>
          ))}
          <span className="num" aria-hidden="true">
            {total}
          </span>
        </>
      ) : (
        <Smiley size={20} aria-hidden="true" />
      )}
    </button>
  )
}

/** A reaction chip: the emoji, and its count once used. The meaning is in its name and title. */
function ReactionChip({
  item,
  reaction,
  ctx,
  label = false,
  onDone,
}: {
  item: FeedItem
  reaction: (typeof REACTIONS)[number]
  ctx: Ctx
  label?: boolean
  onDone?: () => void
}) {
  const n = item.reactions?.counts?.[reaction.key] ?? 0
  const on = (item.reactions?.mine ?? []).includes(reaction.key)
  return (
    <button
      type="button"
      className="chat-chip"
      aria-pressed={on}
      aria-label={n > 0 ? `${reaction.label}, ${n}` : reaction.label}
      title={reaction.label}
      onClick={() => {
        ctx.onReact(item, reaction.key, !on)
        onDone?.()
      }}
    >
      <span className="chat-emo" aria-hidden="true">
        {reaction.emoji}
      </span>
      {label && (
        <span className="chat-chip-label" aria-hidden="true">
          {reaction.label}
        </span>
      )}
      {n > 0 && (
        <span className="num" aria-hidden="true">
          {n}
        </span>
      )}
    </button>
  )
}

/** The tray a line's button opens in place: the four reactions (yours pressed) and, on a move, Reply. */
function ReactTray({
  id,
  item,
  ctx,
  onClose,
  onReply,
}: {
  id: string
  item: FeedItem
  ctx: Ctx
  onClose: () => void
  onReply?: () => void
}) {
  return (
    <div
      id={id}
      className="chat-tray"
      role="group"
      aria-label={`React to ${teamName(ctx.teams, item.team_id)}'s ${item.kind === 'post' ? 'reply' : 'move'}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      {REACTIONS.map((x) => (
        <ReactionChip key={x.key} item={item} reaction={x} ctx={ctx} label onDone={onClose} />
      ))}
      {onReply && (
        <button type="button" className="chat-chip chat-ghost" onClick={onReply}>
          <ArrowBendUpLeft size={17} aria-hidden="true" />
          Reply
        </button>
      )}
    </div>
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

function FeedLine({ item, ctx, act }: { item: FeedItem; ctx: Ctx; act?: ReactNode }) {
  const moves = item.moves ?? []
  const adds = moves.filter((m) => m.kind !== 'drop')
  const drops = moves.filter((m) => m.kind === 'drop')
  const big = ctx.bigId === item.id
  const beat = beatenBids(item, ctx.budget)
  return (
    <div className={ctx.link ? 'feed-row has-act' : 'feed-row'}>
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
      {act}
      {(big || beat) && (
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
      <Talk item={item} ctx={ctx} />
    </div>
  )
}

function Post({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const mine = ctx.link?.teamId === item.team_id
  const period = filmPostPeriod(item.body ?? '')
  return (
    <article className="chat-msg">
      <header className="chat-msg-head">
        <span className="chat-msg-team">
          <span className="feed-team-name">{teamName(ctx.teams, item.team_id)}</span>
          {mine && <You />}
        </span>
        <span className="chat-kind">
          {period == null ? <ChatCircle size={14} aria-hidden="true" /> : <FilmSlate size={14} aria-hidden="true" />}
          <span className="chat-kind-label">{period == null ? 'Chat' : 'Film Room'}</span>
        </span>
        <time className="small muted feed-inline-time" dateTime={item.at}>
          {timeLabel(item.at)}
        </time>
        {mine && <DeleteControl label="Delete your post" onDelete={() => ctx.onDelete(item)} />}
      </header>
      {period == null ? (
        <p className="feed-text">{item.body}</p>
      ) : (
        <>
          {filmPostNote(item.body ?? '') && <p className="feed-text">{filmPostNote(item.body ?? '')}</p>}
          <FilmPostCard
            leagueRef={ctx.ref}
            creds={ctx.creds}
            period={period}
            name={(id) => teamName(ctx.teams, id)}
            colours={ctx.colours}
            onOpen={ctx.onOpenFilm}
          />
        </>
      )}
      <Talk item={item} ctx={ctx} />
    </article>
  )
}

/** A moment's actions and its reply thread, open or closed. */
function Talk({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const [thread, setThread] = useState(false)
  if (!ctx.link) return null
  return (
    <>
      <Actions item={item} ctx={ctx} thread={thread} onThread={() => setThread(!thread)} />
      {thread && <Replies item={item} ctx={ctx} />}
    </>
  )
}

/**
 * A moment's actions row: the reactions people used (yours ringed), "React" to pick another, and
 * "Reply" or the reply count, which opens the thread.
 */
function Actions({
  item,
  ctx,
  thread,
  onThread,
}: {
  item: FeedItem
  ctx: Ctx
  thread: boolean
  onThread: () => void
}) {
  const [picking, setPicking] = useState(false)
  const reactRef = useRef<HTMLButtonElement>(null)
  if (!ctx.link) return null
  const replies = item.replies ?? 0
  const used = new Set(usedReactions(item).map((x) => x.key))
  // Only reactions someone used take up room; the rest wait behind "React".
  const shown = REACTIONS.filter((x) => picking || used.has(x.key))
  function stopPicking() {
    setPicking(false)
    reactRef.current?.focus()
  }
  return (
    <div
      className="chat-actions"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && picking) {
          e.preventDefault()
          stopPicking()
        }
      }}
    >
      {shown.map((x) => (
        <ReactionChip
          key={x.key}
          item={item}
          reaction={x}
          ctx={ctx}
          onDone={picking ? stopPicking : undefined}
        />
      ))}
      <button
        ref={reactRef}
        type="button"
        className="chat-chip chat-ghost"
        aria-expanded={picking}
        onClick={() => setPicking(!picking)}
      >
        <Smiley size={17} aria-hidden="true" />
        React
      </button>
      <button type="button" className="chat-chip chat-ghost" aria-expanded={thread} onClick={onThread}>
        <ArrowBendUpLeft size={17} aria-hidden="true" />
        {replies === 0 ? 'Reply' : `${replies} ${replies === 1 ? 'reply' : 'replies'}`}
      </button>
    </div>
  )
}

/** Replies branch off the wire: each with its crest, team, time and text, then "Write a reply…". */
function Replies({ item, ctx, focus = false }: { item: FeedItem; ctx: Ctx; focus?: boolean }) {
  const replies = useQuery({
    queryKey: ['replies', ctx.ref.leagueId, ctx.ref.season, item.id],
    queryFn: () => fetchReplies(ctx.ref, item.id),
    refetchInterval: REFRESH_MS,
    // A line with no replies yet has nothing to load.
    enabled: (item.replies ?? 0) > 0,
  })
  const rows = replies.data?.items ?? []
  return (
    <div className="chat-thread">
      {replies.isLoading && <p className="chat-thread-note">Loading replies…</p>}
      {rows.length > 0 && (
        <ul className="chat-replies" aria-label="Replies">
          {rows.map((p) => (
            <Reply key={p.id} item={p} ctx={ctx} />
          ))}
        </ul>
      )}
      <Composer ctx={ctx} target={item.id} placeholder="Write a reply…" focus={focus} />
    </div>
  )
}

/** One reply: crest, team, time and text, with the same quiet trailing React button as a line. */
function Reply({ item, ctx }: { item: FeedItem; ctx: Ctx }) {
  const mine = ctx.link?.teamId === item.team_id
  const name = teamName(ctx.teams, item.team_id)
  const [tray, setTray] = useState(false)
  const actRef = useRef<HTMLButtonElement>(null)
  const trayId = useId()
  function closeTray() {
    setTray(false)
    actRef.current?.focus()
  }
  return (
    <li className={tray ? 'chat-reply is-open' : 'chat-reply'}>
      <TeamCrest name={name} colour={ctx.colours.get(item.team_id)} size={20} />
      <div className="chat-reply-body">
        <div className="chat-reply-who">
          <span className="feed-team-name">{name}</span>
          {mine && <You />}
          <time className="num" dateTime={item.at}>
            {timeLabel(item.at)}
          </time>
          {mine && <DeleteControl label="Delete your reply" onDelete={() => ctx.onDelete(item)} />}
        </div>
        <p className="feed-text">{item.body}</p>
      </div>
      <ChatAct
        ref={actRef}
        item={item}
        open={tray}
        controls={trayId}
        name="React"
        onToggle={() => setTray(!tray)}
        onClose={closeTray}
      />
      {tray && <ReactTray id={trayId} item={item} ctx={ctx} onClose={closeTray} />}
    </li>
  )
}

/** A trash button that asks once: "Delete" or "Keep", with focus on Keep. */
function DeleteControl({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [asking, setAsking] = useState(false)
  const trashRef = useRef<HTMLButtonElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const asked = useRef(false)
  useEffect(() => {
    if (asking) keepRef.current?.focus()
    else if (asked.current) trashRef.current?.focus()
    asked.current = asking
  }, [asking])
  if (!asking) {
    return (
      <button
        ref={trashRef}
        type="button"
        className="chat-del"
        aria-label={label}
        title={label}
        onClick={() => setAsking(true)}
      >
        <Trash size={18} aria-hidden="true" />
      </button>
    )
  }
  return (
    <span
      className="chat-del-ask"
      role="group"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          setAsking(false)
        }
      }}
    >
      <button type="button" className="chat-ink" onClick={onDelete}>
        Delete
      </button>
      <button ref={keepRef} type="button" className="chat-chip" onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  )
}

function Composer({
  ctx,
  target,
  placeholder,
  focus = false,
}: {
  ctx: Ctx
  target: string | null
  placeholder: string
  focus?: boolean
}) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focus) input.current?.focus()
  }, [focus])
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
      className={target ? 'chat-compose-row chat-reply-row' : 'chat-compose-row'}
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) send.mutate(text.trim())
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {target ? 'Reply' : 'Message the league'}
      </label>
      <input
        ref={input}
        id={id}
        value={text}
        maxLength={500}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        className={target ? 'chat-soft' : 'chat-post'}
        disabled={!text.trim() || send.isPending}
      >
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
