import { ArrowSquareOut, CaretRight, Check, MagnifyingGlass, Prohibit, Target, Ticket, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { fetchPlayerIndex, type LeagueRef } from '../api/client'
import { couponsOf, whyNot } from '../lib/coupons'
import type { Credentials } from '../lib/credentials'
import { useEscapeLayer } from '../lib/escapeStack'
import { phaseOf } from '../lib/gameStage'
import { MIN_ODD, STAT_NAME, clock, num, odds, signed } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, Line } from '../lib/iddaaCompare'
import { teamLight, teamName as nbaTeamName } from '../lib/nbaTeams'
import {
  SPOT_SECTION,
  clubLight,
  inGamePicks,
  nightPool,
  playerFile,
  rowSummary,
  searchNight,
  teamFile,
  type FileLeg,
  type NightPlayer,
  type NightTeam,
  type Place,
  type PlayerFile,
  type Result,
  type Spot,
  type TeamFile,
} from '../lib/nightFile'
import { usePlayerCard } from '../lib/playerCard'
import { useVisualViewport } from '../lib/visualViewport'
import { pieces, type Mark } from '../lib/playerSearch'
import { teamName as fullTeamName } from '../lib/teamSearch'
import { Chance } from './EstimateBits'
import { PlayerLink } from './PlayerCard'
import { PlayerHead, TeamLogo } from './PlayerHead'
import './NightFile.css'

/** The league whose player index fills "Not on tonight" (the one player cards open in here). */
export interface SearchLeague {
  leagueRef: LeagueRef
  creds: Credentials | null
}

type Picked = { kind: 'player'; player: NightPlayer } | { kind: 'team'; team: NightTeam }

const PHONE = '(max-width: 719px)'

function usePhone() {
  const ask = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches
  const [phone, setPhone] = useState(ask)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return phone
}

const typingIn = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

/** "Live", "13:20", "Final 118–111": where a game stands. */
function stateOf(g: CompareGame): { word: string; live: boolean } {
  const ph = phaseOf(g)
  if (ph === 'final') return { word: `Final ${g.away_score ?? ''}–${g.home_score ?? ''}`, live: false }
  if (ph === 'live') return { word: 'Live', live: true }
  return { word: clock(g.tip), live: false }
}

function GameState({ g }: { g: CompareGame }) {
  const s = stateOf(g)
  return s.live ? <span className="ic-sr-live">Live</span> : <span className="num">{s.word}</span>
}

function Marked({ text, marks }: { text: string; marks: Mark[] }) {
  return (
    <>
      {pieces(text, marks).map((p, i) => (p.marked ? <u key={i}>{p.text}</u> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  )
}

/** A player's face with his club's disc, the club light gold-guarded. */
function Face({ id, name, team, size = 40 }: { id: number; name: string; team: string; size?: number }) {
  const tl = clubLight(team, teamLight(team))
  return (
    <span
      className="ic-sr-face"
      style={{ '--tl': tl ?? 'transparent', '--s': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <PlayerHead player={{ id, name }} team={team} size={size} />
      {team && (
        <span className="ic-sr-disc">
          <TeamLogo abbrev={team} size={Math.max(14, Math.round(size * 0.36))} fallback />
        </span>
      )}
    </span>
  )
}

function Crest({ team, size = 40 }: { team: string; size?: number }) {
  const tl = clubLight(team, teamLight(team))
  return (
    <span
      className="ic-sr-crest"
      style={{ '--tl': tl ?? 'transparent', '--s': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <TeamLogo abbrev={team} size={Math.round(size * 0.62)} fallback />
    </span>
  )
}

/** Search on Our Estimates (Night File): a field in the page head; picking a player or team opens
 *  everything the page knows about them tonight, with a way to each place they appear. */
export function NightSearch({
  data,
  lines,
  slot,
  league,
  onJump,
}: {
  data: BookCompare
  lines: Line[]
  /** The page head's spot for the field. */
  slot: HTMLElement | null
  league: SearchLeague | null
  onJump: (s: Spot) => void
}) {
  const phone = usePhone()
  const ids = useId()
  const [q, setQ] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [active, setActive] = useState(0)
  const [picked, setPicked] = useState<Picked | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const sheetInput = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null)

  const pool = useMemo(() => nightPool(data, lines), [data, lines])
  const slots = useMemo(() => couponsOf(lines), [lines])
  const shots = useMemo(() => whyNot(lines), [lines])
  const index = useQuery({
    queryKey: ['player-index', league?.leagueRef.leagueId, league?.leagueRef.season],
    queryFn: () => fetchPlayerIndex(league!.leagueRef, league!.creds),
    enabled: !!league && (listOpen || sheet) && q.trim().length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const found = useMemo(() => searchNight(pool, q, index.data?.players ?? null), [pool, q, index.data])
  const items = useMemo(() => [...found.tonight, ...found.off.filter((r) => r.kind === 'off-player')], [found])
  const typing = q.trim().length > 0
  useEffect(() => setActive(0), [q])

  const openSheet = () => {
    flushSync(() => setSheet(true))
    sheetInput.current?.focus()
  }
  const focusField = () => {
    if (phone) openSheet()
    else {
      field.current?.focus()
      setListOpen(true)
    }
  }
  // "/" (outside a field) and Ctrl/Cmd+K: the header search's keys, owned here on this page.
  const focusRef = useRef(focusField)
  useEffect(() => {
    focusRef.current = focusField
  })
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        focusRef.current()
      } else if (e.key === '/' && !typingIn(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        focusRef.current()
      }
    }
    document.addEventListener('keydown', on)
    return () => document.removeEventListener('keydown', on)
  }, [])

  // the desktop list closes when focus or a click leaves the field
  useEffect(() => {
    if (!listOpen || phone) return
    const on = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setListOpen(false)
    }
    document.addEventListener('pointerdown', on)
    return () => document.removeEventListener('pointerdown', on)
  }, [listOpen, phone])

  useEffect(() => {
    if (!sheet) return
    document.documentElement.classList.add('ic-sr-lock')
    return () => document.documentElement.classList.remove('ic-sr-lock')
  }, [sheet])
  useVisualViewport(sheet && phone, sheetEl)
  useEffect(() => {
    if (!phone) setSheet(false)
  }, [phone])

  useEscapeLayer((listOpen || sheet) && !picked, () => {
    if (q) setQ('')
    else if (sheet) setSheet(false)
    else {
      setListOpen(false)
      field.current?.blur()
    }
  })

  const card = usePlayerCard()
  const choose = (r: Result) => {
    if (r.kind === 'off-team') return
    if (r.kind === 'off-player') {
      if (phone) sheetInput.current?.blur()
      card?.open({ id: r.player.player_id, name: r.player.name })
      return
    }
    setListOpen(false)
    setSheet(false)
    setPicked(r.kind === 'player' ? { kind: 'player', player: r.player } : { kind: 'team', team: r.team })
  }
  const pickTeam = (t: NightTeam) => {
    setListOpen(false)
    setSheet(false)
    setPicked({ kind: 'team', team: t })
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setListOpen(true)
      if (!items.length) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (Math.min(a, items.length - 1) + step + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const it = items[active]
      if (it) choose(it)
    }
  }
  const closeFile = () => {
    setPicked(null)
    if (!phone) field.current?.focus({ preventScroll: true })
  }
  const jump = (s: Spot) => {
    setPicked(null)
    requestAnimationFrame(() => onJump(s))
  }

  const listId = `${ids}-list`
  const optId = (i: number) => `${ids}-o${i}`
  const list = (
    <ResultList
      id={listId}
      found={found}
      items={items}
      typing={typing}
      active={active}
      optId={optId}
      teams={pool.teams}
      games={data.games.length}
      onChoose={choose}
      onTeam={pickTeam}
      onHover={setActive}
      loadingOff={!!league && index.isPending && typing}
    />
  )
  const comboProps = {
    role: 'combobox',
    'aria-expanded': listOpen || sheet,
    'aria-controls': listId,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': typing && items[active] ? optId(active) : undefined,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    enterKeyHint: 'search' as const,
    value: q,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setQ(e.target.value)
      setListOpen(true)
    },
    onKeyDown,
  }

  const inline = (
    <div className={`ic-sr${listOpen && !phone ? ' open' : ''}`} ref={wrap}>
      {phone ? (
        <button type="button" className="ic-sr-field" aria-haspopup="dialog" onClick={openSheet}>
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="ph">{q || 'Find a player or team tonight'}</span>
        </button>
      ) : (
        <label className="ic-sr-field">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Find a player or team tonight</span>
          <input
            ref={field}
            className="ic-sr-input"
            placeholder="Find a player or team tonight"
            onFocus={() => setListOpen(true)}
            {...comboProps}
          />
          {q ? (
            <button
              type="button"
              className="ic-sr-x"
              aria-label="Clear"
              onClick={() => {
                setQ('')
                field.current?.focus()
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : (
            <kbd className="ic-sr-kbd" aria-hidden="true">
              /
            </kbd>
          )}
        </label>
      )}
      {listOpen && !phone && (
        <div className="ic-sr-drop">
          {list}
          <p className="ic-sr-foot" aria-hidden="true">
            <span>
              <kbd className="ic-sr-kbd">↑</kbd>
              <kbd className="ic-sr-kbd">↓</kbd> move
            </span>
            <span>
              <kbd className="ic-sr-kbd">↵</kbd> open
            </span>
            <span>
              <kbd className="ic-sr-kbd">Esc</kbd> clear
            </span>
          </p>
        </div>
      )}
    </div>
  )

  const file =
    picked &&
    createPortal(
      picked.kind === 'player' ? (
        <PlayerFileView
          file={playerFile(picked.player, lines, slots, shots)}
          lines={lines}
          onClose={closeFile}
          onJump={jump}
        />
      ) : (
        <TeamFileView
          file={teamFile(picked.team, pool.players, lines, slots, shots)}
          onClose={closeFile}
          onJump={jump}
          onPlayer={(p) => setPicked({ kind: 'player', player: p })}
        />
      ),
      document.body,
    )

  return (
    <>
      {slot ? createPortal(inline, slot) : null}
      {sheet &&
        createPortal(
          <div
            className="ic-sr-sheet"
            ref={setSheetEl}
            role="dialog"
            aria-modal="true"
            aria-label="Find a player or team tonight"
          >
            <div className="ic-sr-sheet-list">{list}</div>
            <div className="ic-sr-sheet-bar">
              <label className="ic-sr-field on">
                <MagnifyingGlass size={18} aria-hidden="true" />
                <span className="sr-only">Find a player or team tonight</span>
                <input ref={sheetInput} className="ic-sr-input" placeholder="Player or team" {...comboProps} />
                {q && (
                  <button type="button" className="ic-sr-x" aria-label="Clear" onClick={() => setQ('')}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </label>
              <button type="button" className="ic-sr-close" aria-label="Close search" onClick={() => setSheet(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </div>,
          document.body,
        )}
      {file}
    </>
  )
}

/** The results: tonight first, then "Not on tonight"; with nothing typed, tonight's teams to tap. */
function ResultList({
  id,
  found,
  items,
  typing,
  active,
  optId,
  teams,
  games,
  onChoose,
  onTeam,
  onHover,
  loadingOff,
}: {
  id: string
  found: { tonight: Result[]; off: Result[] }
  items: Result[]
  typing: boolean
  active: number
  optId: (i: number) => string
  teams: NightTeam[]
  games: number
  onChoose: (r: Result) => void
  onTeam: (t: NightTeam) => void
  onHover: (i: number) => void
  loadingOff: boolean
}) {
  const none = typing && !found.tonight.length
  const row = (r: Result) => {
    const i = items.indexOf(r)
    return (
      <ResultRow
        key={keyOf(r)}
        r={r}
        id={i >= 0 ? optId(i) : undefined}
        active={i === active}
        onChoose={onChoose}
        onHover={() => i >= 0 && onHover(i)}
      />
    )
  }
  const teamGrid = (
    <div className="ic-sr-teams">
      {teams.map((t) => (
        <button key={t.abbrev} type="button" className="ic-sr-tm" onClick={() => onTeam(t)}>
          <Crest team={t.abbrev} size={28} />
          <span>{t.abbrev}</span>
        </button>
      ))}
    </div>
  )
  return (
    <div className="ic-sr-list" id={id} role="listbox" aria-label="Players and teams">
      {!typing && (
        <div className="ic-sr-grp-wrap" role="presentation">
          <p className="ic-sr-grp" role="presentation">
            <span>Tonight's teams</span>
            <span>
              <b className="num">{games}</b> {games === 1 ? 'game' : 'games'}
            </span>
          </p>
          {teamGrid}
        </div>
      )}
      {typing && found.tonight.length > 0 && (
        <div role="group" aria-label="Tonight">
          <p className="ic-sr-grp" role="presentation">
            <span>Tonight</span>
            <span>
              <b className="num">{found.tonight.length}</b> found
            </span>
          </p>
          {found.tonight.map(row)}
        </div>
      )}
      {none && (
        <div className="ic-sr-none" role="presentation">
          <p className="h">
            No one on tonight's {games} {games === 1 ? 'game' : 'games'} matches that.
          </p>
          <p>Try a last name or a club, or pick a team.</p>
        </div>
      )}
      {typing && (found.off.length > 0 || (loadingOff && none)) && (
        <div role="group" aria-label="Not on tonight">
          <p className="ic-sr-grp" role="presentation">
            <span>Not on tonight</span>
          </p>
          {found.off.map(row)}
          {loadingOff && !found.off.length && <p className="ic-sr-wait">Looking through every player…</p>}
        </div>
      )}
      {none && teamGrid}
    </div>
  )
}

const keyOf = (r: Result) =>
  r.kind === 'player'
    ? `p-${r.player.id}-${r.player.name}`
    : r.kind === 'team'
      ? `t-${r.team.abbrev}`
      : r.kind === 'off-player'
        ? `o-${r.player.player_id}`
        : `ot-${r.team.abbrev}`

function ResultRow({
  r,
  id,
  active,
  onChoose,
  onHover,
}: {
  r: Result
  id?: string
  active: boolean
  onChoose: (r: Result) => void
  onHover: () => void
}) {
  let face: ReactNode
  let name: ReactNode
  let sub: ReactNode
  let peek: ReactNode
  if (r.kind === 'player') {
    const p = r.player
    face = <Face id={p.id} name={p.name} team={p.team} />
    name = <Marked text={p.name} marks={r.marks} />
    sub = (
      <>
        {p.team} · {p.game.away} @ {p.game.home} · <GameState g={p.game} />
      </>
    )
    peek = rowSummary(p)
  } else if (r.kind === 'team') {
    const t = r.team
    face = <Crest team={t.abbrev} />
    name = <Marked text={fullTeamName(t.team)} marks={r.marks} />
    sub = (
      <>
        {t.game.away} @ {t.game.home} · <GameState g={t.game} />
      </>
    )
    peek = 'Their night'
  } else if (r.kind === 'off-player') {
    face = <Face id={r.player.player_id} name={r.player.name} team={r.player.pro_team} />
    name = <Marked text={r.player.name} marks={r.marks} />
    sub = r.player.pro_team ? `${nbaTeamName(r.player.pro_team)} don't play tonight` : 'On no NBA team'
    peek = (
      <>
        Player card <ArrowSquareOut size={14} aria-hidden="true" />
      </>
    )
  } else {
    face = <Crest team={r.team.abbrev} />
    name = <Marked text={fullTeamName(r.team)} marks={r.marks} />
    sub = 'Not on tonight'
    peek = null
  }
  const inner = (
    <>
      {face}
      <span className="who">
        <span className="nm">{name}</span>
        <span className="sub">{sub}</span>
      </span>
      {peek && <span className="peek">{peek}</span>}
    </>
  )
  if (r.kind === 'off-team')
    return (
      <div className="ic-sr-res off" role="option" aria-disabled="true" aria-selected={false}>
        {inner}
      </div>
    )
  return (
    <div
      id={id}
      className={`ic-sr-res${active ? ' hi' : ''}`}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onPointerMove={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChoose(r)}
    >
      {inner}
    </div>
  )
}

/** The dialog both files sit in: a panel on the right on desktop, the whole screen on phones. Focus
 *  stays inside while it is open, Esc closes it, and the page's own keys pause (aria-modal). */
function FileShell({
  label,
  kicker,
  tl,
  onClose,
  children,
  dock,
}: {
  label: string
  kicker: ReactNode
  tl: string | undefined
  onClose: () => void
  children: ReactNode
  dock?: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  useEscapeLayer(true, onClose)
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    const html = document.documentElement
    html.classList.add('ic-sr-lock')
    return () => html.classList.remove('ic-sr-lock')
  }, [])
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !box.current) return
    const all = [
      ...box.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.offsetParent !== null)
    if (!all.length) return
    const first = all[0]
    const last = all[all.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  return (
    <>
      <div className="ic-sr-scrim" aria-hidden="true" onClick={onClose} />
      <div
        className="ic-sr-file"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={box}
        style={{ '--tl': tl ?? 'transparent' } as CSSProperties}
        onKeyDown={trap}
      >
        <div className="ic-sr-in">
          <div className="ic-sr-grab">
            <span className="t">{kicker}</span>
            <button type="button" className="ic-sr-ib" aria-label="Close" onClick={onClose} data-autofocus>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
        {dock && <div className="ic-sr-dock">{dock}</div>}
      </div>
    </>
  )
}

function PlayerFileView({
  file: f,
  lines,
  onClose,
  onJump,
}: {
  file: PlayerFile
  lines: Line[]
  onClose: () => void
  onJump: (s: Spot) => void
}) {
  const p = f.player
  const g = p.game
  const card = usePlayerCard()
  const opp = p.team === g.home ? g.away : g.home
  const tl = clubLight(p.team, teamLight(p.team))
  const openCard = card && p.id > 0 ? () => card.open({ id: p.id, name: p.name }) : null
  const picks = inGamePicks(g, lines)
  const settled = phaseOf(g) === 'final'
  const won = p.lines.filter((l) => l.barem && l.oursHit === true).length
  const cardBtn = openCard && (
    <button type="button" className="ic-sr-btn pri" aria-haspopup="dialog" onClick={openCard}>
      Player card
    </button>
  )
  const gameBtn = picks && (
    <button type="button" className="ic-sr-btn" onClick={() => onJump({ where: 'game', gameId: g.game_id })}>
      <Target size={18} aria-hidden="true" />
      Show {g.away} @ {g.home} in Game picks
    </button>
  )
  return (
    <FileShell
      label={`${p.name}, tonight`}
      kicker={
        <>
          His night · {g.away} @ {g.home}
        </>
      }
      tl={tl}
      onClose={onClose}
      dock={
        cardBtn || gameBtn ? (
          <>
            {cardBtn}
            {gameBtn}
          </>
        ) : null
      }
    >
      <div className="ic-sr-top">
        <Face id={p.id} name={p.name} team={p.team} size={72} />
        <div className="id">
          <h2 className="ic-sr-name">{p.id > 0 ? <PlayerLink player={{ id: p.id, name: p.name }} /> : p.name}</h2>
          <p className="ic-sr-meta">
            <span>{nbaTeamName(p.team)}</span>
            <span>
              vs <b>{opp}</b>
            </span>
            <GameState g={g} />
            {p.est && (
              <span>
                <b className="num">{Math.round(p.est.minutes)}</b> min est.
              </span>
            )}
          </p>
        </div>
      </div>
      {(cardBtn || gameBtn) && (
        <div className="ic-sr-acts">
          {cardBtn}
          {gameBtn}
        </div>
      )}
      {p.lines.length > 0 && (
        <p className="ic-sr-count">
          <span>
            <b className="num">{f.counts.lines}</b>
            {f.counts.lines === 1 ? 'line' : 'lines'}
          </span>
          <span>
            <b className="num">{f.counts.bets}</b>
            {f.counts.bets === 1 ? 'bet' : 'bets'}
            {settled && f.counts.bets > 0 && <> · won {won}</>}
          </span>
          <span>
            <b className="num">{f.counts.kupons}</b>in <i>Kupons</i>
          </span>
          <span>
            <b className="num">{f.counts.whyNot}</b>Why not
          </span>
        </p>
      )}

      <section className="ic-sr-sec" aria-label="His lines">
        <h3>
          His lines
          {p.lines.length > 0 && (
            <small>
              {f.counts.bets} {f.counts.bets === 1 ? 'bet' : 'bets'} we'd take
              {phaseOf(g) === 'live' ? ' · bets settle at the final' : ''}
            </small>
          )}
        </h3>
        {p.lines.length ? (
          <ul className="ic-sr-tiles">
            {f.tiles.map((t) => (
              <LineTile key={t.line.id} line={t.line} place={t.place} kupons={t.kupons} onJump={onJump} />
            ))}
          </ul>
        ) : (
          <p className="ic-sr-plain">
            No iddaa line on him tonight.
            {p.est && (
              <>
                {' '}
                Ours: <b className="num">{num(p.est.pts)}</b> pts · <b className="num">{num(p.est.reb)}</b> reb ·{' '}
                <b className="num">{num(p.est.ast)}</b> ast · <b className="num">{num(p.est.three_pm)}</b> 3PM.
              </>
            )}
          </p>
        )}
      </section>

      {f.spots.length > 0 && <Ribbon spots={f.spots} who={p.name} onJump={onJump} />}

      <LegsSection kupons={f.kupons} whyNot={f.whyNot} none="Not in tonight's Kupons, not in Why not." />

      <section className="ic-sr-sec" aria-label="His match">
        <h3>His match</h3>
        <div className="ic-sr-match">
          <span className="pair" aria-hidden="true">
            <Crest team={g.away} size={36} />
            <Crest team={g.home} size={36} />
          </span>
          <span className="mt">
            <b>
              {g.away} @ {g.home}
            </b>
            <span>
              {' · '}
              <GameState g={g} />
            </span>
            {f.win?.barem && (
              <span className="call">
                Our pick <b>{f.win.barem.label}</b> ·{' '}
                <span className="num">{f.win.barem.odd != null ? odds(f.win.barem.odd) : '–'}</span>
                {f.win.barem.sure != null && (
                  <>
                    {' '}
                    · <span className="num">{Math.round(f.win.barem.sure * 100)}%</span>
                  </>
                )}
              </span>
            )}
          </span>
        </div>
      </section>
    </FileShell>
  )
}

function noBet(l: Line): string {
  const low = l.rungs[0]
  return low ? `No bet · lowest rung ${low.n}+` : `No bet · odds ${MIN_ODD.toFixed(2)} or less`
}

function placeWords(pl: Place): string | null {
  if (pl == null) return null
  return pl === 'level' ? 'Disagree · level or below' : `Disagree #${pl.rank}`
}

/** His line where the book prices it: ours against the book on a short lane, the bet the page takes
 *  (its own odds and our chance), and after the final what he got. */
function LineTile({
  line: l,
  place,
  kupons,
  onJump,
}: {
  line: Line
  place: Place
  kupons: FileLeg[]
  onJump: (s: Spot) => void
}) {
  const b = l.barem
  const final = l.game.status === 'final'
  const done = final && l.oursHit != null && !!b
  const where = placeWords(place)
  return (
    <li className={`ic-sr-tile${b ? ' bet' : ''}`}>
      <p className="hd">
        <span className="st">{STAT_NAME[l.stat]}</span>
        <b className="gp num">
          <span className="sr-only">Gap </span>
          {signed(l.gap ?? 0, l.stat)}
        </b>
      </p>
      <Lane line={l} />
      <p className="ob">
        Ours <b className="num">{l.ours == null ? '–' : num(l.ours)}</b> · Book{' '}
        <b className="num">{l.book == null ? '–' : num(l.book)}</b>
        {final && l.actual != null && (
          <>
            {' '}
            · Got <b className="num">{num(l.actual)}</b>
          </>
        )}
        {final && l.played === false && <> · Didn’t play</>}
      </p>
      {b ? (
        <p className="bt">
          <span className="lab">Bet</span>
          <b className="b num">{b.label}</b>
          <b className="o num">{b.odd != null ? odds(b.odd) : '–'}</b>
          {done ? (
            <span className={l.oursHit ? 'ic-sr-ok' : 'ic-sr-no'}>
              {l.oursHit ? (
                <Check size={14} weight="bold" aria-hidden="true" />
              ) : (
                <X size={14} weight="bold" aria-hidden="true" />
              )}
              {l.oursHit ? 'Won' : 'Lost'}
            </span>
          ) : b.sure != null ? (
            <Chance value={b.sure} className="c" />
          ) : null}
        </p>
      ) : (
        <p className="nb">
          <Prohibit size={15} aria-hidden="true" />
          {noBet(l)}
        </p>
      )}
      {kupons.length > 0 && (
        <p className="kp">
          <Ticket size={14} weight="fill" aria-hidden="true" />
          In <i>Kupon</i> · {kupons.map((k) => k.title).join(' · ')}
          {kupons.some((k) => k.leg.bet !== b?.label) && (
            <> · its own rung {kupons.find((k) => k.leg.bet !== b?.label)!.leg.bet}</>
          )}
        </p>
      )}
      {where && (
        <button type="button" className="jump" onClick={() => onJump({ where: 'disagree', line: l, place })}>
          {where}
          <span className="sr-only">: go to his {STAT_NAME[l.stat]} line on the page</span>
          <CaretRight size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

/** The lane GapRow draws: the book's tick, our dot, and after the final his result as a ring. Each
 *  side sits a band's worth of gap from the middle; the numbers beside it say the same. */
function Lane({ line: l }: { line: Line }) {
  if (l.book == null || l.ours == null) return <span className="ic-sr-lane" aria-hidden="true" />
  const span = Math.max(l.band * 1.6, Math.abs(l.ours - l.book) * 1.3, Math.abs((l.actual ?? l.book) - l.book) * 1.15)
  const at = (v: number) => Math.max(3, Math.min(97, 50 + ((v - l.book!) / span) * 50))
  const o = at(l.ours)
  const res = l.game.status === 'final' && l.actual != null ? at(l.actual) : null
  return (
    <span className="ic-sr-lane" aria-hidden="true">
      <i className="ln" />
      <i className="sg" style={{ left: `${Math.min(50, o)}%`, width: `${Math.abs(o - 50)}%` }} />
      <i className="tk" style={{ left: '50%' }} />
      {res != null && <i className="rs" style={{ left: `${res}%` }} />}
      <i className="dt" style={{ left: `${o}%` }} />
    </span>
  )
}

/** The page drawn as one ribbon: Kupons, Why not, Game picks and Disagree, his spots lit and
 *  numbered in page order. A light takes you there. */
function Ribbon({ spots, who, onJump }: { spots: Spot[]; who: string; onJump: (s: Spot) => void }) {
  const segs: Spot['where'][] = ['kupon', 'whynot', 'game', 'disagree']
  return (
    <section className="ic-sr-sec" aria-label="On this page">
      <h3>
        On this page
        <small>
          {spots.length} {spots.length === 1 ? 'spot' : 'spots'}, in page order
        </small>
      </h3>
      <div className="ic-sr-ribbon">
        {segs.map((w) => {
          const mine = spots.map((s, i) => ({ s, i })).filter((x) => x.s.where === w)
          return (
            <div
              key={w}
              className={`seg ${w}${mine.length ? '' : ' zero'}`}
              style={{ flexGrow: Math.max(1, mine.length) }}
            >
              <div className="lts">
                {mine.length ? (
                  mine.map(({ s, i }) => (
                    <button
                      key={i}
                      type="button"
                      className="lt num"
                      aria-label={`Spot ${i + 1} of ${spots.length}: ${spotWords(s)}. Go there`}
                      title={spotWords(s)}
                      onClick={() => onJump(s)}
                    >
                      {i + 1}
                    </button>
                  ))
                ) : (
                  <span className="dash" aria-label={`Not in ${SPOT_SECTION[w]}`}>
                    –
                  </span>
                )}
              </div>
              <span className="lab">{SPOT_SECTION[w]}</span>
            </div>
          )
        })}
      </div>
      <span className="sr-only">{`${who} appears in ${spots.length} places on this page.`}</span>
    </section>
  )
}

function spotWords(s: Spot): string {
  if (s.where === 'kupon') return `${s.title} Kupon`
  if (s.where === 'whynot') return 'Why not'
  if (s.where === 'game') return 'Game picks'
  const pl = s.place === 'level' ? 'level or below' : s.place ? `#${s.place.rank}` : ''
  return `Disagree ${pl} · ${STAT_NAME[s.line.stat]}`
}

/** The Kupon and Why not legs that carry him (or the team's game), each with its slip. */
function LegsSection({ kupons, whyNot: wn, none }: { kupons: FileLeg[]; whyNot: FileLeg[]; none: string }) {
  const all = [...kupons, ...wn]
  return (
    <section className="ic-sr-sec" aria-label="Kupons and Why not">
      <h3>
        <span>
          <i>Kupons</i> and Why not
        </span>
      </h3>
      {all.length ? (
        <ul className="ic-sr-legs">
          {all.map((k, i) => {
            const l = k.leg
            const res = l.result
            return (
              <li key={`${k.title ?? 'wn'}-${l.id}-${i}`} className="ic-sr-kup">
                <Ticket size={18} weight={k.title ? 'fill' : 'regular'} aria-hidden="true" />
                <span className="k">
                  <b>{k.title ?? 'Why not'}</b>
                  <span>
                    {l.kind === 'player' ? `${l.line.name} ${l.bet} ${STAT_NAME[l.stat].toLowerCase()}` : l.bet}
                    {k.slip && <> · slip {k.slip}</>}
                  </span>
                </span>
                <span className="o">
                  <b className="num">{odds(l.odd)}</b>
                  {res === 'won' || res === 'lost' ? (
                    <span className={res === 'won' ? 'ic-sr-ok' : 'ic-sr-no'}>{res === 'won' ? 'Won' : 'Lost'}</span>
                  ) : res === 'void' ? (
                    <span>Sat out</span>
                  ) : (
                    <span className="num">{Math.round(l.chance * 100)}%</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="ic-sr-plain">{none}</p>
      )}
    </section>
  )
}

const MARKET: Record<string, string> = { WIN: 'Match result', MAR: 'Handicap', TOT: 'Total points' }

function TeamFileView({
  file: f,
  onClose,
  onJump,
  onPlayer,
}: {
  file: TeamFile
  onClose: () => void
  onJump: (s: Spot) => void
  onPlayer: (p: NightPlayer) => void
}) {
  const t = f.team
  const g = t.game
  const opp = t.abbrev === g.home ? g.away : g.home
  const tl = clubLight(t.abbrev, teamLight(t.abbrev))
  const picksSpot = f.spots.find((s) => s.where === 'game')
  const gameBtn = picksSpot && (
    <button type="button" className="ic-sr-btn pri" onClick={() => onJump(picksSpot)}>
      <Target size={18} aria-hidden="true" />
      Show in Game picks
    </button>
  )
  return (
    <FileShell
      label={`${fullTeamName(t.team)}, tonight`}
      kicker={
        <>
          Their night · {g.away} @ {g.home}
        </>
      }
      tl={tl}
      onClose={onClose}
      dock={gameBtn}
    >
      <div className="ic-sr-top">
        <Crest team={t.abbrev} size={72} />
        <div className="id">
          <h2 className="ic-sr-name">{fullTeamName(t.team)}</h2>
          <p className="ic-sr-meta">
            <span>
              vs <b>{opp}</b>
            </span>
            <GameState g={g} />
          </p>
        </div>
      </div>
      {gameBtn && <div className="ic-sr-acts">{gameBtn}</div>}
      <p className="ic-sr-count">
        <span>
          <b className="num">{f.counts.gameBets}</b>
          game {f.counts.gameBets === 1 ? 'bet' : 'bets'}
        </span>
        <span>
          <b className="num">{f.counts.playerBets}</b>
          player {f.counts.playerBets === 1 ? 'bet' : 'bets'}
        </span>
        <span>
          <b className="num">{f.counts.kupons}</b>in <i>Kupons</i>
        </span>
        <span>
          <b className="num">{f.counts.whyNot}</b>Why not
        </span>
      </p>

      {f.game.length > 0 && (
        <section className="ic-sr-sec" aria-label="The match">
          <h3>The match</h3>
          <ul className="ic-sr-gls">
            {f.game.map((l) => (
              <GameRow key={l.id} line={l} />
            ))}
          </ul>
        </section>
      )}

      <section className="ic-sr-sec" aria-label="Their players">
        <h3>
          Their players
          <small>{f.players.length}</small>
        </h3>
        {f.players.length ? (
          <ul className="ic-sr-pls">
            {f.players.map((p) => (
              <li key={`${p.id}-${p.name}`} className="ic-sr-pl">
                <Face id={p.id} name={p.name} team={p.team} size={40} />
                <span className="who">
                  {p.id > 0 ? <PlayerLink player={{ id: p.id, name: p.name }} /> : <b>{p.name}</b>}
                  <small>
                    {p.lines.length ? (
                      rowSummary(p)
                    ) : p.est ? (
                      <>
                        No iddaa lines · ours <span className="num">{num(p.est.pts)}</span> pts ·{' '}
                        <span className="num">{num(p.est.reb)}</span> reb ·{' '}
                        <span className="num">{num(p.est.ast)}</span> ast
                      </>
                    ) : (
                      'No iddaa lines'
                    )}
                  </small>
                  {p.lines.some((l) => l.barem) && (
                    <span className="chips">
                      {p.lines
                        .filter((l) => l.barem)
                        .map((l) => (
                          <span key={l.id}>
                            {l.stat} <b className="num">{l.barem!.label}</b>{' '}
                            <span className="num">{l.barem!.odd != null ? odds(l.barem!.odd) : ''}</span>
                            {l.game.status === 'final' && l.oursHit != null && (
                              <span className={l.oursHit ? 'ic-sr-ok' : 'ic-sr-no'}>
                                {l.oursHit ? (
                                  <Check size={12} weight="bold" aria-label="won" />
                                ) : (
                                  <X size={12} weight="bold" aria-label="lost" />
                                )}
                              </span>
                            )}
                          </span>
                        ))}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="ic-sr-ib open"
                  aria-label={`Open ${p.name}'s night`}
                  onClick={() => onPlayer(p)}
                >
                  <CaretRight size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ic-sr-plain">No player lines or estimates for them yet.</p>
        )}
      </section>

      {f.spots.length > 0 && <Ribbon spots={f.spots} who={fullTeamName(t.team)} onJump={onJump} />}

      <LegsSection kupons={f.kupons} whyNot={f.whyNot} none="Nothing from this game in tonight's Kupons or Why not." />
    </FileShell>
  )
}

/** One of the match's bets: what we'd take on it, its odds and our chance, or how it went. */
function GameRow({ line: l }: { line: Line }) {
  const b = l.barem
  const final = l.game.status === 'final'
  const label = l.stat === 'TEAM' ? `${l.team} points` : MARKET[l.stat]
  const pair =
    l.stat === 'WIN'
      ? null
      : `Ours ${l.ours == null ? '–' : num(l.ours)} · Book ${l.book == null ? '–' : num(l.book)}${final && l.actual != null ? ` · Got ${num(l.actual)}` : ''}`
  return (
    <li className="ic-sr-gl">
      <span className="l">
        <b>{label}</b>
        {pair && <span className="num">{pair}</span>}
      </span>
      {b ? (
        <>
          <span className="bt">
            <b className="num">{b.label}</b>
            <span className="num">{b.odd != null ? odds(b.odd) : '–'}</span>
          </span>
          <span className="r">
            {final && l.oursHit != null ? (
              <span className={l.oursHit ? 'ic-sr-ok' : 'ic-sr-no'}>{l.oursHit ? 'Won' : 'Lost'}</span>
            ) : b.sure != null ? (
              <Chance value={b.sure} />
            ) : null}
          </span>
        </>
      ) : (
        <span className="bt nob">No bet</span>
      )}
    </li>
  )
}
