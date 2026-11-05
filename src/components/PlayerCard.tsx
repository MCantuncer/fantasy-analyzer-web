import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fetchPlayerCard, fetchPlayerCardExtras } from '../api/client'
import type { GameStats, LeagueRef, PlayerCard as Card, PlayerGame } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { ago } from '../lib/news'
import {
  CATS,
  average,
  dealGroups,
  formTiles,
  gameDate,
  healthStatus,
  moveOthers,
  moveText,
  opponent,
  ownerText,
  setPlayerCardHost,
  shortDate,
  spotlight,
  usePlayerCard,
  withExtras,
} from '../lib/playerCard'
import type { FormTile } from '../lib/playerCard'
import { teamColour, teamName } from '../lib/nbaTeams'
import type { CardPlayer, Deal, PlayerCardApi } from '../lib/playerCard'
import { teamLogoUrl } from '../lib/league'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { ShotSplit } from './ShotSplit'
import { ratioPct } from '../lib/shooting'
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
// A card stays fresh for two minutes, so a second look (or a prefetch then a tap) is instant.
const CARD_STALE_MS = 2 * 60_000

function coreQuery(ref: LeagueRef, playerId: number, creds: Credentials | null) {
  return {
    queryKey: ['player-card', ref.leagueId, ref.season, playerId, creds?.swid ?? null],
    queryFn: () => fetchPlayerCard(ref, playerId, creds),
    retry: false,
    staleTime: CARD_STALE_MS,
  }
}

function extrasQuery(ref: LeagueRef, playerId: number, creds: Credentials | null) {
  return {
    queryKey: ['player-card-extras', ref.leagueId, ref.season, playerId, creds?.swid ?? null],
    queryFn: () => fetchPlayerCardExtras(ref, playerId, creds),
    retry: false,
    staleTime: CARD_STALE_MS,
  }
}

export function PlayerCardHost({ leagueRef, creds, teams, myTeamId }: HostProps) {
  const [player, setPlayer] = useState<CardPlayer | null>(null)
  const client = useQueryClient()
  // The latest league and cookies for prefetches, without re-registering the host on each change.
  const ctx = useRef({ leagueRef, creds })
  useEffect(() => {
    ctx.current = { leagueRef, creds }
  })
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
      prefetch: (p: CardPlayer) => {
        const { leagueRef: ref, creds: c } = ctx.current
        if (!ref || p.id <= 0) return
        void client.prefetchQuery(coreQuery(ref, p.id, c))
        void client.prefetchQuery(extrasQuery(ref, p.id, c))
      },
    })
    return () => setPlayerCardHost(null)
  }, [leagueKey, client])

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
  after,
}: {
  player: CardPlayer
  children?: ReactNode
  className?: string
  decorative?: boolean
  /** A mark that belongs to the name (an injury pill): inside the link, so it never wraps away from the name. */
  after?: ReactNode
}) {
  const card = usePlayerCard()
  if (!card || player.id <= 0)
    return (
      <>
        {children ?? player.name}
        {after}
      </>
    )
  const base = decorative ? 'pc-link pc-link-face' : after ? 'pc-link pc-link-split' : 'pc-link'
  return (
    <button
      type="button"
      className={className ? `${base} ${className}` : base}
      aria-haspopup={decorative ? undefined : 'dialog'}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && card.prefetch(player)}
      onPointerDown={() => card.prefetch(player)}
      onClick={() => card.open(player)}
    >
      {after ? (
        <>
          <span className="pc-link-name">{children ?? player.name}</span>
          {after}
        </>
      ) : (
        (children ?? player.name)
      )}
    </button>
  )
}

/** One head-and-name chip that opens the player's card. */
function PlayerChip({ player, card }: { player: CardPlayer; card: PlayerCardApi }) {
  return (
    <button
      type="button"
      className="pc-chip"
      aria-haspopup="dialog"
      onPointerEnter={(e) => e.pointerType === 'mouse' && card.prefetch(player)}
      onPointerDown={() => card.prefetch(player)}
      onClick={() => card.open(player)}
    >
      <PlayerHead player={player} size={24} />
      <span>{player.name}</span>
    </button>
  )
}

function linkable(players: CardPlayer[]): CardPlayer[] {
  return players.filter((p, i) => p.id > 0 && players.findIndex((q) => q.id === p.id) === i)
}

/** Head-and-name chips that open each player's card, for places where the name itself can't be a button. */
export function PlayerChips({ players, label = 'Players' }: { players: CardPlayer[]; label?: string }) {
  const card = usePlayerCard()
  const unique = linkable(players)
  if (!card || !unique.length) return null
  return (
    <div className="pc-chips">
      <span className="detail-label pc-chips-label">{label}</span>
      <ul className="pc-chip-list">
        {unique.map((p) => (
          <li key={p.id}>
            <PlayerChip player={p} card={card} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A trade's players as chips grouped by role (Give, Get, the drops and adds), shown first in an
 * opened trade so each player can be checked before the pitch.
 */
export function DealChips({ deal, label = 'Players in this deal' }: { deal: Deal; label?: string }) {
  const card = usePlayerCard()
  const groups = dealGroups(deal)
    .map((g) => ({ ...g, players: linkable(g.players) }))
    .filter((g) => g.players.length > 0)
  if (!card || !groups.length) return null
  return (
    <section className="pc-chips pc-deal" aria-label={label}>
      <span className="detail-label pc-chips-label">{label}</span>
      <dl className="pc-deal-groups">
        {groups.map((g) => (
          <div className="pc-deal-group" key={g.label}>
            <dt className="pc-deal-role">{g.label}</dt>
            <dd>
              <ul className="pc-chip-list">
                {g.players.map((p) => (
                  <li key={p.id}>
                    <PlayerChip player={p} card={card} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
  // The core (header, form, games, moves) shows as soon as it lands; news fills in after.
  const q = useQuery(coreQuery(leagueRef, player.id, creds))
  const extras = useQuery(extrasQuery(leagueRef, player.id, creds))

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

  const card = useMemo(() => (q.data ? withExtras(q.data, extras.data) : undefined), [q.data, extras.data])
  const status = card ? healthStatus(card.injury_status) : null
  const abbrev = card?.pro_team ?? ''
  const colour = teamColour(abbrev)
  const heroStyle = colour ? ({ '--pc-team': colour } as CSSProperties) : undefined
  return createPortal(
    <div className="pc-layer">
      <div className="pc-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={dialog} className="pc-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={trap}>
        <header className={colour ? 'pc-hero pc-hero-team' : 'pc-hero'} style={heroStyle}>
          <div className="pc-grab" aria-hidden="true" />
          <TeamWatermark abbrev={abbrev} />
          <span className="pc-face">
            <PlayerHead player={player} size={88} />
            {card?.position && <span className="pc-face-pos">{card.position}</span>}
          </span>
          <div className="pc-who">
            {card && (
              <span className="pc-eyebrow">
                {card.pro_team && (
                  <span className="pc-eyebrow-logo">
                    <TeamLogo abbrev={card.pro_team} size={18} />
                  </span>
                )}
                {[teamName(card.pro_team || null), card.position].filter(Boolean).join(' · ')}
              </span>
            )}
            <h2 id={titleId} className="pc-name">
              {card?.name || player.name}
            </h2>
            {card && status && (
              <div className="pc-pills">
                <span className={`pc-pill pc-health pc-${status.tone}`}>
                  <i aria-hidden="true" />
                  {status.label}
                </span>
                <span className="pc-pill">{ownerText(card, teams, myTeamId)}</span>
                <span className="pc-pill tnum">{card.percent_owned}% owned</span>
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
          {card && (
            <CardBody
              card={card}
              season={leagueRef.season}
              teams={teams}
              myTeamId={myTeamId}
              news={extras.isPending ? 'loading' : extras.isError ? 'failed' : 'ready'}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Loading() {
  return (
    <div className="pc-loading" role="status">
      <span className="sr-only">Loading his games and moves…</span>
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
  /** News arrives after the rest of the card. */
  news: 'loading' | 'ready' | 'failed'
}

function Section({
  id,
  title,
  aside,
  children,
}: {
  id: string
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="pc-section" aria-labelledby={id}>
      <div className="pc-section-head">
        <h3 id={id} className="pc-title">
          {title}
        </h3>
        {aside && <span className="pc-aside">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function CardBody({ card, season, teams, myTeamId, news }: BodyProps) {
  const now = new Date()
  const injury = card.news.find((n) => n.kind === 'injury' || n.kind === 'return')
  const lastSeason = card.games.length > 0 && card.games[0].season < season
  const recent = card.games.slice(0, 5)
  const last5 = recent.length >= 3 ? average(recent) : null
  const line = card.season_line
  return (
    <>
      {injury && card.injury_status !== 'ACTIVE' && (
        <p className="pc-injury">
          <span className="pc-injury-label">Latest</span> {injury.headline}{' '}
          <span className="muted">· {ago(injury.updated_at, now)}</span>
        </p>
      )}

      {!card.games.length && !line ? (
        <p className="pc-empty">No games played yet this season.</p>
      ) : (
        <>
          {last5 && (
            <Section
              id="pc-form-title"
              title={`Form · last ${recent.length} games`}
              aside={line && !lastSeason ? '▲▼ vs his season average' : undefined}
            >
              <FormTiles
                tiles={formTiles(
                  last5,
                  line && !lastSeason ? line.per_game : null,
                  line?.fg_pct ?? null,
                  line?.ft_pct ?? null,
                )}
              />
            </Section>
          )}
          {card.games.length > 1 && (
            <Section
              id="pc-minutes-title"
              title="Minutes"
              aside={line ? `dashed line: season ${line.per_game.minutes.toFixed(1)} a game` : undefined}
            >
              <MinutesChart games={card.games} average={line?.per_game.minutes ?? null} />
            </Section>
          )}
          <Section
            id="pc-games-title"
            title={lastSeason ? 'Game log · last season' : 'Game log'}
            aside={line ? `season ${line.games} G` : undefined}
          >
            <GameTable card={card} />
            <p className="pc-legend small muted">
              <span className="pc-legend-glow" aria-hidden="true" /> a big night for him
              <span className="pc-legend-quiet" aria-hidden="true">
                0
              </span>{' '}
              a quiet one
              <span className="pc-swipe"> · swipe for all categories</span>
            </p>
          </Section>
        </>
      )}

      <div className="pc-two">
        <Section id="pc-news-title" title="News">
          {news === 'loading' ? (
            <div className="pc-news-loading" role="status">
              <span className="sr-only">Loading his news…</span>
              <span className="pc-skeleton pc-skeleton-line" aria-hidden="true" />
              <span className="pc-skeleton pc-skeleton-line pc-skeleton-short" aria-hidden="true" />
            </div>
          ) : news === 'failed' ? (
            <p className="pc-quiet">His news didn't load. Open the card again to retry.</p>
          ) : card.news.length ? (
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
            <p className="pc-quiet">Quiet: no news about him in the last few days.</p>
          )}
        </Section>

        <Section id="pc-moves-title" title="Moves in this league">
          {card.moves.length ? (
            <ol className="pc-timeline">
              {card.moves.map((m) => (
                <li key={m.id} className={`pc-step pc-step-${m.kind}`}>
                  <span className="pc-step-text">
                    {moveText(m, teams, myTeamId)}
                    {m.bid ? <span className="pc-bid tnum">${m.bid}</span> : null}
                  </span>
                  <span className="pc-step-meta small muted">
                    <time dateTime={m.at}>{shortDate(m.at)}</time>
                    {moveOthers(m) && ` · ${moveOthers(m)}`}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pc-quiet">No one in this league has drafted, added, dropped or traded him.</p>
          )}
        </Section>
      </div>
    </>
  )
}

function FormTiles({ tiles }: { tiles: FormTile[] }) {
  return (
    <ul className="pc-tiles">
      {tiles.map((t) => {
        const moved = t.delta != null && Math.abs(t.delta) >= 0.05
        return (
          <li key={t.key} className={moved && t.better ? 'pc-tile pc-tile-up' : 'pc-tile'}>
            <span className="pc-tile-label">{t.label}</span>
            <span className="pc-tile-value tnum">
              {t.value}
              {t.value !== '–' && (t.key === 'fg' || t.key === 'ft') && <small>%</small>}
            </span>
            <span className="pc-tile-delta tnum">
              {t.delta == null ? (
                (t.note ?? '')
              ) : moved ? (
                <>
                  <span className="pc-tile-arrow" aria-hidden="true">{t.delta > 0 ? '▲' : '▼'}</span>
                  <span className="sr-only">{t.delta > 0 ? 'up' : 'down'}</span> {Math.abs(t.delta).toFixed(1)}
                </>
              ) : (
                'same'
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// Share of the chart's height a full-length bar may take; the rest holds the number above it.
const BAR_ROOM = 80

/** One bar per game, oldest left, against a dashed line at his season average. */
function MinutesChart({ games, average: avg }: { games: PlayerGame[]; average: number | null }) {
  const shown = [...games].reverse()
  const top = Math.max(36, ...shown.map((g) => g.stats.minutes))
  const label = shown.map((g) => `${gameDate(g.date)} ${opponent(g)} ${Math.round(g.stats.minutes)}`).join(', ')
  return (
    <div className="pc-minutes" role="img" aria-label={`Minutes by game: ${label}`}>
      <div className="pc-bars">
        {avg != null && <span className="pc-avg-line" style={{ bottom: `${(avg / top) * BAR_ROOM}%` }} />}
        {shown.map((g) => (
          <span key={g.game_id} className="pc-bar">
            <span className="pc-bar-value tnum">{Math.round(g.stats.minutes)}</span>
            <span className="pc-bar-fill" style={{ height: `${(g.stats.minutes / top) * BAR_ROOM}%` }} />
          </span>
        ))}
      </div>
      <div className="pc-bar-labels" aria-hidden="true">
        {shown.map((g) => (
          <span key={g.game_id}>
            <Opponent game={g} size={20} />
          </span>
        ))}
      </div>
    </div>
  )
}

function GameTable({ card }: { card: Card }) {
  const line = card.season_line
  const base = line?.per_game ?? average(card.games)
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
          {line && (
            <tr className="pc-avg">
              <th scope="row" className="pc-first">
                Season avg
              </th>
              <td>{line.per_game.minutes.toFixed(1)}</td>
              <td>{ratioPct(line.fg_pct)}</td>
              <td>{ratioPct(line.ft_pct)}</td>
              {CATS.map((c) => (
                <td key={c.key}>{line.per_game[c.key].toFixed(1)}</td>
              ))}
            </tr>
          )}
          {card.games.map((g) => (
            <GameRow key={g.game_id} game={g} base={base} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GameRow({ game: g, base }: { game: PlayerGame; base: GameStats | null }) {
  const s = g.stats
  return (
    <tr>
      <th scope="row" className="pc-first">
        <span className="pc-game">
          <span className="pc-date">{gameDate(g.date)}</span>
          <Opponent game={g} size={22} />
        </span>
      </th>
      <td>{Math.round(s.minutes)}</td>
      <td className="shot-cell">
        <ShotSplit made={s.fgm} attempts={s.fga} label="FG" />
      </td>
      <td className="shot-cell">
        <ShotSplit made={s.ftm} attempts={s.fta} label="FT" />
      </td>
      {CATS.map((c) => {
        const glow = base ? spotlight(c.key, s[c.key], base[c.key]) : 0
        if (glow > 0) {
          return (
            <td
              key={c.key}
              className="pc-glow"
              style={{ '--pc-glow': (0.18 + glow * 0.3).toFixed(2) } as CSSProperties}
            >
              {s[c.key]}
              <span className="sr-only"> (big night)</span>
            </td>
          )
        }
        return (
          <td key={c.key} className={glow < 0 ? 'pc-quiet-cell' : undefined}>
            {s[c.key]}
          </td>
        )
      })}
    </tr>
  )
}

/** The NBA team's logo, big and faded behind the header; nothing when ESPN has no logo for the team. */
function TeamWatermark({ abbrev }: { abbrev: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!abbrev || failed === abbrev) return null
  return (
    <img
      className="pc-watermark"
      src={teamLogoUrl(abbrev)}
      alt=""
      aria-hidden="true"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(abbrev)}
    />
  )
}

/**
 * The opponent as box scores show it, with the team's logo in place of the letters: "@" away, "vs" at home.
 * The letters stay for screen readers, and come back if ESPN has no logo for the team.
 */
function Opponent({ game: g, size }: { game: Pick<PlayerGame, 'opponent' | 'home'>; size: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!g.opponent) return <span className="pc-opp">–</span>
  if (failed === g.opponent) return <span className="pc-opp">{opponent(g)}</span>
  return (
    <span className="pc-opp pc-opp-logo" title={`${g.home === false ? 'at' : 'vs'} ${teamName(g.opponent)}`}>
      <span className="pc-opp-at" aria-hidden="true">
        {g.home === false ? '@' : 'vs'}
      </span>
      <img
        src={teamLogoUrl(g.opponent)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(g.opponent)}
      />
      <span className="sr-only">{opponent(g)}</span>
    </span>
  )
}
