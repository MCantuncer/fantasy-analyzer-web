import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fetchPlayerCard } from '../api/client'
import type { GameStats, LeagueRef, PlayerCard as Card, PlayerGame } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { ago } from '../lib/news'
import {
  average,
  gameDate,
  healthStatus,
  moveText,
  moveTone,
  opponent,
  ownerText,
  shootingPct,
  setPlayerCardHost,
  shortDate,
  usePlayerCard,
} from '../lib/playerCard'
import type { CardPlayer } from '../lib/playerCard'
import { PlayerHead, TeamLogo } from './PlayerHead'
import './PlayerCard.css'

interface HostProps {
  /** The open league; without one, names stay plain text. */
  leagueRef: LeagueRef | null
  creds: Credentials | null
  teams: { id: number; name: string }[]
  myTeamId: number | null
}

/**
 * Mounted once by App. While a league is open, every ``PlayerLink`` opens one shared player
 * card: his latest games with the nine categories and minutes, health, news and this
 * league's moves of him. A centered dialog on wide screens, a bottom sheet on phones.
 */
export function PlayerCardHost({ leagueRef, creds, teams, myTeamId }: HostProps) {
  const [player, setPlayer] = useState<CardPlayer | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const leagueKey = leagueRef ? `${leagueRef.leagueId}:${leagueRef.season}` : null

  useEffect(() => {
    setPlayer(null) // a card from the last league never stays open
    if (leagueKey === null) return
    setPlayerCardHost({
      open: (p: CardPlayer) => {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setPlayer({ id: p.id, name: p.name })
      },
    })
    return () => setPlayerCardHost(null)
  }, [leagueKey])

  const close = useCallback(() => {
    setPlayer(null)
    opener.current?.focus()
  }, [])
  const names = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams])

  if (!player || !leagueRef) return null
  return (
    <PlayerSheet
      key={`${leagueKey}:${player.id}`}
      player={player}
      leagueRef={leagueRef}
      creds={creds}
      teams={names}
      myTeamId={myTeamId}
      onClose={close}
    />
  )
}

/**
 * A player's name (or face) that opens his card. Plain text outside a league. Not for use
 * inside another button (a clickable trade row): put a ``PlayerChips`` row in its details.
 * ``decorative`` is for a headshot next to a name that is already a link: it opens the same
 * card on a tap, but stays out of the tab order and screen readers.
 */
export function PlayerLink({
  player,
  children,
  className,
  decorative = false,
}: {
  player: CardPlayer
  children?: ReactNode
  className?: string
  decorative?: boolean
}) {
  const card = usePlayerCard()
  if (!card || player.id <= 0) return <>{children ?? player.name}</>
  const base = decorative ? 'pc-link pc-link-face' : 'pc-link'
  return (
    <button
      type="button"
      className={className ? `${base} ${className}` : base}
      aria-haspopup={decorative ? undefined : 'dialog'}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      onClick={() => card.open(player)}
    >
      {children ?? player.name}
    </button>
  )
}

/** Head-and-name chips that open each player's card, for places where the name itself can't be a button. */
export function PlayerChips({ players, label = 'Players' }: { players: CardPlayer[]; label?: string }) {
  const card = usePlayerCard()
  const unique = players.filter((p, i) => p.id > 0 && players.findIndex((q) => q.id === p.id) === i)
  if (!card || !unique.length) return null
  return (
    <div className="pc-chips">
      <span className="detail-label pc-chips-label">{label}</span>
      <ul className="pc-chip-list">
        {unique.map((p) => (
          <li key={p.id}>
            <button type="button" className="pc-chip" aria-haspopup="dialog" onClick={() => card.open(p)}>
              <PlayerHead player={p} size={24} />
              <span>{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface SheetProps {
  player: CardPlayer
  leagueRef: LeagueRef
  creds: Credentials | null
  teams: Map<number, string>
  myTeamId: number | null
  onClose: () => void
}

function PlayerSheet({ player, leagueRef, creds, teams, myTeamId, onClose }: SheetProps) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const q = useQuery({
    queryKey: ['player-card', leagueRef.leagueId, leagueRef.season, player.id, creds?.swid ?? null],
    queryFn: () => fetchPlayerCard(leagueRef, player.id, creds),
    retry: false,
    staleTime: 2 * 60_000,
  })

  useEffect(() => {
    closeBtn.current?.focus()
    const body = document.body.style
    const before = body.overflow
    body.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      body.overflow = before
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Keep Tab inside the card while it is open.
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !dialog.current) return
    const items = dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const card = q.data
  const status = card ? healthStatus(card.injury_status) : null
  return createPortal(
    <div className="pc-layer">
      <div className="pc-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={dialog} className="pc-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={trap}>
        <div className="pc-grab" aria-hidden="true" />
        <header className="pc-head">
          <PlayerHead player={player} size={56} />
          <div className="pc-who">
            <h2 id={titleId} className="pc-name">
              {card?.name || player.name}
            </h2>
            {card && (
              <div className="pc-meta">
                <span className="pc-team">
                  <TeamLogo abbrev={card.pro_team} size={16} />
                  {[card.position, card.pro_team || 'No NBA team'].filter(Boolean).join(' · ')}
                </span>
                <span className="pc-owner">{ownerText(card, teams, myTeamId)}</span>
              </div>
            )}
            {card && status && (
              <div className="pc-status-row">
                <span className={`badge pc-status pc-${status.tone}`}>{status.label}</span>
                <span className="small muted tnum">{card.percent_owned}% owned in ESPN leagues</span>
              </div>
            )}
          </div>
          <button ref={closeBtn} type="button" className="pc-close" aria-label="Close player card" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="pc-body">
          {q.isPending && <Loading />}
          {q.error && (
            <div className="pc-error">
              <p>{q.error.message}</p>
              <button type="button" className="secondary" onClick={() => void q.refetch()}>
                Try again
              </button>
            </div>
          )}
          {card && <CardBody card={card} season={leagueRef.season} teams={teams} myTeamId={myTeamId} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Loading() {
  return (
    <div className="pc-loading" role="status">
      <span className="sr-only">Loading his games, news and moves…</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="pc-skeleton" aria-hidden="true" />
      ))}
    </div>
  )
}

interface BodyProps {
  card: Card
  season: number
  teams: Map<number, string>
  myTeamId: number | null
}

function CardBody({ card, season, teams, myTeamId }: BodyProps) {
  const now = new Date()
  const injury = card.news.find((n) => n.kind === 'injury' || n.kind === 'return')
  const lastSeason = card.games.length > 0 && card.games[0].season < season
  return (
    <>
      {injury && card.injury_status !== 'ACTIVE' && (
        <p className="pc-injury">
          <span className="pc-injury-label">Latest</span> {injury.headline}{' '}
          <span className="muted">· {ago(injury.updated_at, now)}</span>
        </p>
      )}

      <section className="pc-section" aria-labelledby="pc-games-title">
        <h3 id="pc-games-title" className="pc-title">
          {card.games.length ? `Last ${card.games.length} games` : 'Games'}
          {lastSeason && <span className="muted"> · last season</span>}
        </h3>
        {card.games.length || card.season_line ? (
          <>
            <GameTable card={card} />
            <p className="pc-swipe small muted" aria-hidden="true">
              Swipe the table for all nine categories.
            </p>
          </>
        ) : (
          <p className="pc-empty">No games played yet this season.</p>
        )}
      </section>

      <section className="pc-section" aria-labelledby="pc-news-title">
        <h3 id="pc-news-title" className="pc-title">
          News
        </h3>
        {card.news.length ? (
          <ul className="pc-list">
            {card.news.map((n) => (
              <li key={n.id} className="pc-news">
                <a href={n.url} target="_blank" rel="noopener noreferrer">
                  {n.headline}
                </a>
                <span className="small muted">
                  {n.source} · {ago(n.updated_at, now)}
                  {n.status === 'reported' && ' · one source'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pc-empty">No news about him in the last few days.</p>
        )}
      </section>

      <section className="pc-section" aria-labelledby="pc-moves-title">
        <h3 id="pc-moves-title" className="pc-title">
          Moves in this league
        </h3>
        {card.moves.length ? (
          <ol className="pc-list">
            {card.moves.map((m) => (
              <li key={m.id} className="pc-move">
                <span className={`pc-dot pc-dot-${moveTone(m)}`} aria-hidden="true" />
                <span className="pc-move-text">{moveText(m, teams, myTeamId)}</span>
                <time className="small muted tnum" dateTime={m.at}>
                  {shortDate(m.at)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pc-empty">No one in this league has drafted, added, dropped or traded him.</p>
        )}
      </section>
    </>
  )
}

const CATS: { key: keyof GameStats; label: string }[] = [
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'tpm', label: '3PM' },
  { key: 'to', label: 'TO' },
]

function GameTable({ card }: { card: Card }) {
  const recent = card.games.slice(0, 5)
  const last5 = recent.length >= 3 ? average(recent) : null
  const season = card.season_line
  return (
    <div className="pc-table-wrap" tabIndex={0} role="region" aria-label="Game log">
      <table className="pc-table tnum">
        <thead>
          <tr>
            <th scope="col" className="pc-first">
              Game
            </th>
            <th scope="col">MIN</th>
            <th scope="col">FG</th>
            <th scope="col">FT</th>
            {CATS.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {season && (
            <AverageRow
              label={`Season · ${season.games} G`}
              stats={season.per_game}
              fg={season.fg_pct}
              ft={season.ft_pct}
            />
          )}
          {last5 && (
            <AverageRow
              label="Last 5"
              stats={last5}
              fg={last5.fga ? last5.fgm / last5.fga : null}
              ft={last5.fta ? last5.ftm / last5.fta : null}
            />
          )}
          {card.games.map((g) => (
            <GameRow key={g.game_id} game={g} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AverageRow({
  label,
  stats,
  fg,
  ft,
}: {
  label: string
  stats: GameStats
  fg?: number | null
  ft?: number | null
}) {
  const pct = (x: number | null | undefined) => (x == null ? '–' : `${(x * 100).toFixed(1)}%`)
  return (
    <tr className="pc-avg">
      <th scope="row" className="pc-first">
        {label}
      </th>
      <td>{stats.minutes.toFixed(1)}</td>
      <td>{pct(fg)}</td>
      <td>{pct(ft)}</td>
      {CATS.map((c) => (
        <td key={c.key}>{stats[c.key].toFixed(1)}</td>
      ))}
    </tr>
  )
}

function GameRow({ game: g }: { game: PlayerGame }) {
  const s = g.stats
  return (
    <tr>
      <th scope="row" className="pc-first">
        <span className="pc-date">{gameDate(g.date)}</span> <span className="pc-opp">{opponent(g)}</span>
      </th>
      <td>{Math.round(s.minutes)}</td>
      <td title={shootingPct(s.fgm, s.fga)}>
        {s.fgm}-{s.fga}
      </td>
      <td title={shootingPct(s.ftm, s.fta)}>
        {s.ftm}-{s.fta}
      </td>
      {CATS.map((c) => (
        <td key={c.key}>{s[c.key]}</td>
      ))}
    </tr>
  )
}
