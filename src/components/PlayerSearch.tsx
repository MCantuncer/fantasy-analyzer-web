import { MagnifyingGlass, Plus, User, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { fetchPlayerIndex, type IndexedPlayer, type LeagueRef, type OverviewTeam } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { useEscapeLayer } from '../lib/escapeStack'
import { injuryShort } from '../lib/injury'
import { teamColours } from '../lib/league'
import { teamName } from '../lib/nbaTeams'
import { usePlayerCard } from '../lib/playerCard'
import {
  buildIndex,
  clearRecent,
  ownerKind,
  pieces,
  pushRecent,
  readRecent,
  search,
  type Hit,
  type OwnerFilter,
} from '../lib/playerSearch'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import './PlayerSearch.css'

// One search per page: the keys (tab row, bottom bar) open it, the panel in the header shows it.
// A module store, like the player card's, keeps App.tsx free of a provider.
let isOpen = false
let input: HTMLInputElement | null = null
let opener: HTMLElement | null = null
const listeners = new Set<() => void>()

function setOpen(next: boolean) {
  isOpen = next
  listeners.forEach((l) => l())
}

function useSearchOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => isOpen,
    () => false,
  )
}

/** Opens the search with the field focused in the same tap, so phones raise the keyboard. */
function openPlayerSearch() {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  flushSync(() => setOpen(true))
  input?.focus()
}

function closePlayerSearch() {
  setOpen(false)
  opener?.focus()
  opener = null
}

const SHOWN = 40
const PHONE = '(max-width: 640px)'
const POSITION: Record<string, string> = {
  PG: 'point guard',
  SG: 'shooting guard',
  SF: 'small forward',
  PF: 'power forward',
  C: 'center',
}
const FILTERS: { id: OwnerFilter; label: string; short?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free Agents', short: 'FA' },
  { id: 'taken', label: 'Taken' },
  { id: 'yours', label: 'Yours' },
]

function isPhone() {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches
}

/** The key at the end of the tab row: "Find a player /" on wide screens, a 44px icon key below. */
export function PlayerSearchKey() {
  return (
    <div className="ps-slot">
      <button
        type="button"
        className="ps-key"
        aria-label="Find a player"
        aria-keyshortcuts="/ Control+K Meta+K"
        title="Find a player (/)"
        onClick={openPlayerSearch}
        onPointerEnter={warmIndex}
        onFocus={warmIndex}
      >
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span className="ps-key-label">Find a player</span>
        <kbd className="ps-kbd">/</kbd>
      </button>
    </div>
  )
}

/** The Search key at the end of the phone's bottom bar. */
export function PlayerSearchBarKey() {
  return (
    <button type="button" className="sn-item ps-bar-key" aria-label="Find a player" onClick={openPlayerSearch}>
      <MagnifyingGlass className="sn-ic" size={22} aria-hidden="true" />
      <span>Search</span>
    </button>
  )
}

// Hovering or focusing the key starts loading the players, so the list is there when it opens.
let warm = () => {}
function warmIndex() {
  warm()
}

/** Pins the sheet to the part of the screen the keyboard leaves (iOS moves the page, not the layout). */
function useVisualViewport(active: boolean, el: HTMLElement | null) {
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !el || !vv) return
    let frame = 0
    const apply = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--ps-vvh', `${vv.height}px`)
        el.style.setProperty('--ps-vvy', `${vv.offsetTop}px`)
        el.classList.toggle('ps-kb-up', window.innerHeight - vv.height > 120)
      })
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [active, el])
}

function InjuryTag({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const tone = status === 'OUT' || status === 'INJURY_RESERVE' ? 'out' : status === 'SUSPENSION' ? 'susp' : 'dtd'
  return (
    <span className={`ps-tag ps-tag-${tone}`}>
      {injuryShort(status) === 'DTD' ? 'DTD' : titleWord(injuryShort(status))}
    </span>
  )
}

function titleWord(s: string) {
  return s.length <= 4 && s === s.toUpperCase() && s !== 'OUT' ? s : s.charAt(0) + s.slice(1).toLowerCase()
}

function Name({ hit }: { hit: Hit }) {
  return (
    <>
      {pieces(hit.player.name, hit.marks).map((p, i) =>
        p.marked ? <u key={i}>{p.text}</u> : <Fragment key={i}>{p.text}</Fragment>,
      )}
    </>
  )
}

interface Owners {
  myTeamId: number | null
  names: Map<number, string>
  colours: Map<number, string>
}

function Owner({ p, owners }: { p: IndexedPlayer; owners: Owners }) {
  const kind = ownerKind(p, owners.myTeamId)
  if (kind === 'yours')
    return (
      <span className="ps-own ps-own-yours">
        <User size={16} weight="fill" aria-hidden="true" />
        <span>Yours</span>
      </span>
    )
  if (kind === 'free')
    return (
      <span className="ps-own ps-own-fa">
        <Plus size={14} weight="bold" aria-hidden="true" />
        <span>Free agent</span>
      </span>
    )
  const name = owners.names.get(p.owner_team_id!) ?? `Team ${p.owner_team_id}`
  return (
    <span className="ps-own">
      <TeamCrest name={name} colour={owners.colours.get(p.owner_team_id!)} size={18} />
      <span>{name}</span>
    </span>
  )
}

function ownerWords(p: IndexedPlayer, owners: Owners) {
  const kind = ownerKind(p, owners.myTeamId)
  if (kind === 'yours') return 'on your team'
  if (kind === 'free') return 'free agent'
  return `on ${owners.names.get(p.owner_team_id!) ?? `team ${p.owner_team_id}`}`
}

function label(p: IndexedPlayer, owners: Owners) {
  return [
    p.name,
    p.pro_team ? teamName(p.pro_team) : 'no NBA team',
    POSITION[p.position] ?? p.position,
    p.injury_status ? p.injury_status.replace(/_/g, ' ').toLowerCase() : '',
    ownerWords(p, owners),
    `${Math.round(p.percent_owned)}% rostered`,
  ]
    .filter(Boolean)
    .join(', ')
}

function Rostered({ pct, big }: { pct: number; big?: string }) {
  const v = pct >= 10 || pct === 0 ? Math.round(pct) : pct
  return (
    <span className="ps-ros">
      <span className="ps-ros-v">
        {v}
        <small>%</small>
      </span>
      {big && <span className="ps-ros-lbl">{big}</span>}
    </span>
  )
}

/**
 * Player search in the header ("Scorer's Table"): every NBA player, filtered on the device with each
 * key press, each row saying who has him in this league. Picking one opens his player card; the
 * search waits behind it, so closing the card comes back to the same list. Desktop: the tab row
 * turns into the search line and the results drop from the header. Phones: a sheet pinned to the
 * part of the screen the keyboard leaves, best match nearest the thumb.
 */
export function PlayerSearch({
  leagueRef,
  creds,
  teams,
  myTeamId,
}: {
  leagueRef: LeagueRef
  creds: Credentials | null
  teams: OverviewTeam[]
  myTeamId: number | null
}) {
  const open = useSearchOpen()
  const card = usePlayerCard()
  const ids = useId()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<OwnerFilter>('all')
  const [active, setActive] = useState(0)
  const [keyed, setKeyed] = useState(false) // the gold edge shows once the arrows are used
  const [want, setWant] = useState(false)
  const [recent, setRecent] = useState<number[]>(() => readRecent(leagueRef.leagueId, leagueRef.season))
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const [phone, setPhone] = useState(isPhone)
  const listRef = useRef<HTMLUListElement>(null)
  const { leagueId, season } = leagueRef

  useEffect(() => {
    warm = () => setWant(true)
    // A quiet moment after the league opens, so the first search rarely waits.
    const t = window.setTimeout(() => setWant(true), 3000)
    return () => {
      window.clearTimeout(t)
      warm = () => {}
    }
  }, [])

  useEffect(() => {
    setRecent(readRecent(leagueId, season))
    setQ('')
    setOpen(false) // another league's search never stays open
  }, [leagueId, season])

  const index = useQuery({
    queryKey: ['player-index', leagueId, season],
    queryFn: () => fetchPlayerIndex(leagueRef, creds),
    enabled: want || open,
    staleTime: 5 * 60_000,
  })
  const searchable = useMemo(() => (index.data ? buildIndex(index.data.players) : null), [index.data])
  const byId = useMemo(() => new Map((index.data?.players ?? []).map((p) => [p.player_id, p])), [index.data])
  const owners: Owners = useMemo(
    () => ({
      myTeamId,
      names: new Map(teams.map((t) => [t.id, t.name])),
      colours: teamColours(
        teams.map((t) => t.id),
        myTeamId,
      ),
    }),
    [teams, myTeamId],
  )

  const hits = useMemo(() => (searchable && q.trim() ? search(searchable, q, Infinity) : []), [searchable, q])
  const counts = useMemo(() => {
    const c: Record<OwnerFilter, number> = {
      all: hits.length,
      free: 0,
      taken: 0,
      yours: 0,
    }
    for (const h of hits) c[ownerKind(h.player, myTeamId)]++
    return c
  }, [hits, myTeamId])
  const typing = q.trim().length > 0
  const filtered = filter === 'all' ? hits : hits.filter((h) => ownerKind(h.player, myTeamId) === filter)
  const recentHits: Hit[] = typing
    ? []
    : recent.flatMap((id) => {
        const p = byId.get(id)
        return p ? [{ player: p, rank: 0, marks: [] }] : []
      })
  const rows = typing ? filtered.slice(0, SHOWN) : recentHits
  const one = typing && hits.length === 1
  const activeRow = Math.min(active, Math.max(rows.length - 1, 0))

  useEffect(() => {
    setActive(0)
  }, [q, filter])

  useEffect(() => {
    if (!open) {
      setQ('')
      setFilter('all')
      setKeyed(false)
    }
  }, [open])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])

  // "/" (outside a field) and Ctrl/Cmd+K open it anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typingElsewhere = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (isOpen) input?.focus()
        else openPlayerSearch()
      } else if (e.key === '/' && !typingElsewhere && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        openPlayerSearch()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // While the phone sheet is up the page behind stays still.
  useEffect(() => {
    if (!open || !phone) return
    document.documentElement.classList.add('ps-lock')
    return () => document.documentElement.classList.remove('ps-lock')
  }, [open, phone])
  useEffect(() => {
    if (!open) return
    document.documentElement.classList.add('ps-on')
    return () => document.documentElement.classList.remove('ps-on')
  }, [open])
  useVisualViewport(open && phone, panel)

  // Screen readers hear the count once typing settles, not on every key.
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      if (!typing) setSaid('')
      else if (!searchable) setSaid('Loading players')
      else
        setSaid(
          hits.length ? `${hits.length} ${hits.length === 1 ? 'player' : 'players'}, best first` : 'No players found',
        )
    }, 400)
    return () => window.clearTimeout(t)
  }, [open, typing, hits.length, searchable])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${activeRow}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [activeRow])

  const pick = (p: IndexedPlayer) => {
    setRecent(pushRecent(leagueId, season, p.player_id))
    // On phones the keyboard drops so the card has the screen; on desktop focus stays in the field.
    if (phone) input?.blur()
    card?.open({ id: p.player_id, name: p.name })
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!rows.length) return
      setKeyed(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (Math.min(a, rows.length - 1) + step + rows.length) % rows.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[activeRow]
      if (row) pick(row.player)
    }
  }
  // Esc clears the field first, then closes; a player card opened from here closes before either.
  useEscapeLayer(open, () => {
    if (q) setQ('')
    else closePlayerSearch()
  })

  const listId = `${ids}-list`
  const countLabel = typing
    ? searchable
      ? `${hits.length} ${hits.length === 1 ? 'player' : 'players'}${hits.length > 1 ? ', best first' : ''}`
      : 'Loading players'
    : 'Recently opened'
  const noResults = typing && !!searchable && hits.length === 0
  const cls = [
    'ps',
    open && 'ps-open',
    typing && 'ps-typing',
    typing && hits.length > 1 && 'ps-many',
    one && 'ps-one-only',
    noResults && 'ps-nores',
    !typing && !recentHits.length && 'ps-first',
    keyed && 'ps-keyed',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} ref={setPanel} style={{} as CSSProperties} hidden={!open}>
      <div className="ps-scrim" onClick={closePlayerSearch} aria-hidden="true" />
      <div className="ps-line">
        <div className="ps-box">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input
            ref={(el) => {
              input = el
            }}
            className="ps-input"
            type="search"
            role="combobox"
            aria-label="Find a player"
            aria-expanded={open && rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={rows.length && (keyed || typing) ? `${ids}-row-${activeRow}` : undefined}
            aria-describedby={`${ids}-hint`}
            placeholder="Find a player"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {q && (
            <button
              type="button"
              className="ps-clear"
              aria-label="Clear"
              onClick={() => {
                setQ('')
                input?.focus()
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
          <kbd className="ps-kbd ps-esc">Esc</kbd>
        </div>
        <button type="button" className="ps-cancel" onClick={closePlayerSearch}>
          Cancel
        </button>
      </div>
      <div className="ps-drawer">
        <div className="ps-in">
          <div className="ps-top">
            {(typing || recentHits.length > 0) && (
              <span className="ps-label" id={`${ids}-count`}>
                {countLabel}
              </span>
            )}
            {!typing && recentHits.length > 0 && (
              <button
                type="button"
                className="ps-clearall"
                onClick={() => {
                  clearRecent(leagueId, season)
                  setRecent([])
                }}
              >
                Clear
              </button>
            )}
            <span className="ps-keys" aria-hidden="true">
              <span>
                <kbd className="ps-kbd">↑</kbd>
                <kbd className="ps-kbd">↓</kbd> Move
              </span>
              <span>
                <kbd className="ps-kbd">↵</kbd> Open card
              </span>
              <span>
                <kbd className="ps-kbd">Esc</kbd> Close
              </span>
            </span>
          </div>
          {typing && hits.length > 1 && (
            <div className="ps-segs" role="group" aria-label="Who has him">
              <div className="ps-seg-group">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="ps-seg"
                    aria-pressed={filter === f.id}
                    onClick={() => {
                      setFilter(f.id)
                      input?.focus({ preventScroll: true })
                    }}
                  >
                    {f.short ? (
                      <>
                        <span className="ps-long">{f.label}</span>
                        <span className="ps-short" aria-hidden="true">
                          {f.short}
                        </span>
                      </>
                    ) : (
                      f.label
                    )}
                    <span className="ps-n">{counts[f.id]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {typing && hits.length > 1 && (
            <div className="ps-cols" aria-hidden="true">
              <span>Player</span>
              <span>Health</span>
              <span>In your league</span>
              <span>ESPN rostered</span>
            </div>
          )}
          <ul className="ps-list" id={listId} role="listbox" aria-labelledby={`${ids}-count`} ref={listRef}>
            {rows.map((h, i) => {
              const p = h.player
              const rowCls = [
                'ps-row',
                i === activeRow && (keyed || typing) && 'ps-active',
                one && 'ps-one',
                typing && i === 0 && !one && 'ps-best',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <li
                  key={p.player_id}
                  id={`${ids}-row-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={i === activeRow && (keyed || typing)}
                  aria-label={label(p, owners)}
                  className={rowCls}
                  onClick={() => pick(p)}
                  onMouseMove={() => i !== active && setActive(i)}
                  onMouseEnter={() => card?.prefetch({ id: p.player_id, name: p.name })}
                  onPointerDown={() => card?.prefetch({ id: p.player_id, name: p.name })}
                >
                  <PlayerHead
                    player={{ id: p.player_id, name: p.name }}
                    team={p.pro_team || null}
                    size={one ? 72 : 40}
                  />
                  <span className="ps-nm">
                    <Name hit={h} />
                  </span>
                  <span className="ps-meta">
                    {p.pro_team ? <TeamLogo abbrev={p.pro_team} size={16} /> : <span className="ps-nologo" />}
                    <span className={one ? 'ps-tm-full' : undefined}>
                      {p.pro_team ? (one ? teamName(p.pro_team) : p.pro_team) : 'No NBA team'}
                    </span>
                    {one && p.pro_team && <span className="ps-tm-ab">{p.pro_team}</span>}
                    {p.position && (
                      <>
                        <span className="ps-dot">·</span>
                        {p.position}
                      </>
                    )}
                    <span className="ps-meta-tag">
                      <InjuryTag status={p.injury_status} />
                    </span>
                  </span>
                  <span className="ps-health">
                    <InjuryTag status={p.injury_status} />
                  </span>
                  <Owner p={p} owners={owners} />
                  <Rostered pct={p.percent_owned} big={one ? 'rostered on ESPN' : 'rostered'} />
                  <span className="ps-go" aria-hidden="true">
                    Open ↵
                  </span>
                </li>
              )
            })}
            {typing && filtered.length > SHOWN && (
              <li className="ps-more" role="presentation">
                {filtered.length - SHOWN} more. Keep typing to narrow it down.
              </li>
            )}
          </ul>
          {typing && !!searchable && hits.length > 0 && filtered.length === 0 && (
            <p className="ps-empty">No one in this filter. Try All.</p>
          )}
          {typing && !searchable && (
            <p className="ps-empty">
              {index.isError ? (
                <>
                  Couldn&apos;t load the players.{' '}
                  <button type="button" className="ps-clearall" onClick={() => void index.refetch()}>
                    Try again
                  </button>
                </>
              ) : (
                'Loading every NBA player…'
              )}
            </p>
          )}
          {noResults && (
            <div className="ps-none">
              <span className="ps-none-i" aria-hidden="true">
                <MagnifyingGlass size={18} />
              </span>
              <div>
                <strong>No one called “{q.trim()}”</strong>
                <p>
                  Searched all {(index.data?.players.length ?? 0).toLocaleString('en-US')} NBA players this season. Try
                  a last name, or initials like sga.
                </p>
              </div>
            </div>
          )}
          <p className="ps-hint" id={`${ids}-hint`}>
            Type a first name, last name or initials, like <b>sga</b> or <b>kat</b>.
          </p>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </div>
  )
}
