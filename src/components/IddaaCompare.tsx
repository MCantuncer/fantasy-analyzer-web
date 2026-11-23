import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpenText,
  CaretRight,
  Check,
  Clock,
  Prohibit,
  Pulse,
  Target,
  Ticket,
  X,
} from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { fetchBookCompare } from '../api/client'
import {
  FULL_AT,
  GAME_STATS,
  PLAYER_STATS,
  STAT_NAME,
  STAT_UNIT,
  clock,
  gameStory,
  linesOf,
  median,
  nightLabel,
  nightTab,
  num,
  odds,
  plain,
  ranked,
  signed,
  gameCall,
  gotLine,
  picksNight,
  sureOf,
  tallyOf,
  lostWhy,
  marketPair,
  MIN_ODD,
} from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, Line, Stat, Tally } from '../lib/iddaaCompare'
import { useEscapeLayer } from '../lib/escapeStack'
import { teamLight } from '../lib/nbaTeams'
import { usePlayerCard } from '../lib/playerCard'
import { MatchCard } from './MatchCard'
import { ProMark } from './Pro'
import { ProInside } from './ProInside'
import { upgradeRequired } from '../lib/plans'
import { useFeature } from '../lib/pro'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { RungLadder, RungNote } from './RungTrack'
import { RecordRibbon, RungRecord } from './RungRecord'
import { Kupons } from './Kupons'
import { RungScorecard } from './RungScorecard'
import { ValueRungs } from './ValueRungs'
import { HowToRead } from './HowToRead'
import { Chance, KuponTag, useKuponPicks } from './EstimateBits'
import { kuponKey } from '../lib/coupons'
import './IddaaCompare.css'

interface Props {
  onBack: () => void
  /** Admins: a way over to Site health. */
  onHealth?: () => void
}

const PAGE = 12
/** Phones show fewer rows before "Show all": ranks 4 to 11. */
const PAGE_PHONE = 8
const PHONE = '(max-width: 719px)'

/** True at phone widths, following the window as it resizes. */
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

/** "Seambook": the sportsbook's lines (iddaa, read through nesine) beside ours, night by night, the biggest gaps above the book
 *  first, and once the games are final each side judged against what happened. Comparison only:
 *  the book never feeds our model. */
export function IddaaCompare({ onBack, onHealth }: Props) {
  const allowed = useFeature('estimates')
  const qc = useQueryClient()
  const [day, setDay] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['book-compare', day],
    queryFn: () => fetchBookCompare(day),
    enabled: allowed,
    retry: (n, err) => !upgradeRequired(err) && n < 3,
    refetchInterval: (query) => (isTonight(query.state.data) ? 5 * 60_000 : false),
  })
  // Pro ran out while the page was open: the plan is read again once, and the page locks.
  const ended = !!upgradeRequired(q.error)
  useEffect(() => {
    if (ended) qc.invalidateQueries({ queryKey: ['me'] })
  }, [ended, qc])
  const data = q.data
  const [how, setHow] = useState(false)
  if (!allowed || ended) return <ProInside ended={ended} onBack={onBack} />
  const howButton = (where: 'wide' | 'phone') => (
    <button
      type="button"
      className={`ic-how-btn ic-how-${where}`}
      aria-haspopup="dialog"
      aria-expanded={how}
      onClick={() => setHow(true)}
    >
      <BookOpenText size={18} aria-hidden="true" />
      How to read
    </button>
  )
  return (
    <div className="ic stack">
      <div className="ic-head">
        <div className="ic-head-r1">
          <button type="button" className="ic-ib ic-back" aria-label="Back" title="Back" onClick={onBack}>
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="page-title">Our Estimates</h1>
          <div className="ic-head-btns">
            {howButton('wide')}
            {onHealth && (
              <button type="button" className="ic-ib" aria-label="Site health" title="Site health" onClick={onHealth}>
                <Pulse size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="ic-head-r2">
          {data && <NightTabs data={data} onDay={setDay} />}
          {howButton('phone')}
          {data && <NightMeta data={data} />}
        </div>
      </div>
      {how && <HowToRead bands={data?.bands ?? null} onClose={() => setHow(false)} />}
      <RecordRibbon nights={data?.nights} />
      {q.isPending && <Skeleton />}
      {q.error && (
        <section className="card error stack" role="alert">
          <p>{q.error instanceof Error ? q.error.message : "Couldn't load the comparison."}</p>
        </section>
      )}
      {data ? (
        <Night data={data} onDay={setDay} key={data.day ?? 0} />
      ) : (
        // Without a night the running record still shows (it reads its own record).
        <RungRecord />
      )}
      {data && <LookLine data={data} />}
    </div>
  )
}

/** The way in from My leagues: tonight's biggest gap above the book, or last night's tally once
 *  it is settled, on a card that opens the page. */
export function EstimatesTeaser({ onOpen }: { onOpen: () => void }) {
  const allowed = useFeature('estimates')
  const q = useQuery({
    queryKey: ['book-compare', null],
    queryFn: () => fetchBookCompare(null),
    retry: false,
    enabled: allowed,
  })
  const data = q.data
  const lines = useMemo(() => (data ? linesOf(data, new Date()) : []), [data])
  const settled = !!data && data.games.length > 0 && data.games.every((g) => g.status === 'final')
  const top = ranked(lines.filter((l) => !l.tipped || settled), true).above[0]
  const t = tallyOf(lines)
  if (!allowed)
    return (
      <button type="button" className="ic-teaser" aria-label="Our Estimates, Pro feature. Picks and Sportsbook vs" onClick={onOpen}>
        <span className="ic-teaser-h">
          <span className="ic-teaser-t pro-teaser-t">
            <Ticket size={18} aria-hidden="true" />
            Our Estimates
            <ProMark label={false} />
          </span>
          <span className="ic-teaser-go">
            <svg className="ic-i" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </span>
        <span className="ic-teaser-sub">Picks and Sportsbook vs</span>
      </button>
    )
  return (
    <button type="button" className="ic-teaser" onClick={onOpen}>
      <span className="ic-teaser-h">
        <span className="ic-teaser-t">
          {data && !settled && data.games.length > 0 && <span className="ic-live" aria-hidden="true" />}
          Our Estimates vs the Sportsbook
        </span>
        <span className="ic-teaser-go">
          See all
          <svg className="ic-i" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </span>
      <span className="ic-teaser-sub">
        {settled
          ? `${nightLabel(data.date)}: we won ${t.oursCloser} of ${t.judged} · Book won ${t.bookCloser}`
          : 'Every player and game, our number beside the book’s, judged against the result once the games end.'}
      </span>
      {top && !settled && (
        <span className="ic-teaser-row">
          <span className="ic-teaser-who">
            <b>{top.kind === 'player' ? top.name : top.gameLabel}</b>
            <span>
              Biggest gap tonight · {top.stat === 'TEAM' ? `${top.team} points` : STAT_NAME[top.stat]}
            </span>
          </span>
          <Lane line={top} i={0} />
        </span>
      )}
    </button>
  )
}

function isTonight(data: BookCompare | undefined): boolean {
  return !!data && data.games.some((g) => g.status !== 'final')
}

function Night({ data, onDay }: { data: BookCompare; onDay: (d: number) => void }) {
  const [group, setGroup] = useState<'players' | 'games'>('players')
  const [stat, setStat] = useState<Stat | 'ALL'>('ALL')
  const [game, setGame] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [fold, setFold] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [motion, setMotion] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  // The open match card: Our Estimates from a match chip or a game's score; Form from a Kupon pick.
  const [card, setCardState] = useState<{ id: number; view: 'form' | 'estimates'; side: 'away' | 'home' } | null>(
    null,
  )
  const setCard = (id: number | null) => setCardState(id == null ? null : { id, view: 'estimates', side: 'away' })
  const openForm = (id: number, side: 'away' | 'home') => setCardState({ id, view: 'form', side })
  const first = useRef(true)
  useEffect(() => {
    if (first.current) first.current = false
    else setMotion(true) // the bands tug and the marks draw on a change, never on load
  }, [group, stat, game])

  const lines = useMemo(() => linesOf(data, new Date()), [data])
  const settled = data.games.length > 0 && data.games.every((g) => g.status === 'final')
  const stage = useMemo(() => stageOf(lines, group, stat, game), [lines, group, stat, game])
  const cardGame = card == null ? null : (data.games.find((g) => g.game_id === card.id) ?? null)

  /** "See in game" on a mark card: filter to that game, bring the line forward and ring it. */
  const see = (l: Line) => {
    const pool = lines.filter((x) => x.kind === l.kind && x.game.game_id === l.game.game_id && x.gap != null)
    const at = ranked(pool, true).above.findIndex((x) => x.id === l.id)
    setGroup(l.kind === 'player' ? 'players' : 'games')
    setStat('ALL')
    setGame(l.game.game_id)
    setOpen(null)
    if (at < 0) setFold(true)
    if (at < 0 || at >= 3 + PAGE_PHONE) setShowAll(true)
    setFlash(l.id)
  }
  useEffect(() => {
    if (!flash) return
    const raf = requestAnimationFrame(() => {
      const el = [...document.querySelectorAll<HTMLElement>('[data-line]')].find((e) => e.dataset.line === flash)
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' })
    })
    const t = window.setTimeout(() => setFlash(null), 1800)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [flash])

  // The page's order, set once for the redesign (The Slip Rail): Kupons, game picks, where we and the
  // book disagree, our record, then the tools.
  return (
    <>
      <Kupons data={data} lines={lines} onMatch={openForm} />
      <GamePicks data={data} lines={lines} onCard={setCard} />
      {data.games.length === 0 ? (
        <div className="ic-sheet">
          <Empty data={data} onDay={onDay} />
        </div>
      ) : (
        <div className={`ic-sheet${motion ? ' motion' : ''}`}>
            <NightCard
              data={data}
              lines={lines}
              settled={settled}
              game={game}
              onGame={(g) => {
                setGame(g)
                setOpen(null)
                setCard(g) // Can 2026-11-22: a match opens its card of player lines
              }}
            />
            <GapList
              lines={lines}
              settled={settled}
              group={group}
              stat={stat}
              game={game}
              showAll={showAll}
              fold={fold}
              open={open}
              flash={flash}
              onGroup={(g) => {
                setGroup(g)
                setStat('ALL')
                setOpen(null)
              }}
              onStat={(s) => {
                setStat(s)
                setOpen(null)
              }}
              onShowAll={() => setShowAll(true)}
              onFold={() => setFold((f) => !f)}
              onOpen={(id) => setOpen((o) => (o === id ? null : id))}
            />
            <StatCloser lines={lines} game={game} />
            <RungScorecard data={data} lines={lines} settled={settled} />
        </div>
      )}
      <RungRecord nights={data.nights} day={data.day} />
      {data.games.length > 0 && (
        <div className={`ic-sheet${motion ? ' motion' : ''}`}>
          <ValueRungs data={data} lines={lines} settled={settled} />
          <HowDivided lines={lines} group={group} game={game} stage={stage} onSee={see} />
          <GameBoxes data={data} lines={lines} settled={settled} />
        </div>
      )}
      {cardGame && card && (
        <MatchCard
          key={`${card.id}-${card.view}-${card.side}`}
          game={cardGame}
          initialView={card.view}
          initialSide={card.side}
          onClose={() => setCard(null)}
        />
      )}
    </>
  )
}

/** The nights, in the head's second row. */
function NightTabs({ data, onDay }: { data: BookCompare; onDay: (d: number) => void }) {
  const latest = data.days[data.days.length - 1]
  const settled = data.games.length > 0 && data.games.every((g) => g.status === 'final')
  // Oldest on the left, tonight on the right, like a calendar (Can 2026-11-22: past days read
  // as "after today" when they sat to the right). A long row starts scrolled to the open night.
  const nights = data.nights
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = row.current
    const on = el?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (el && on) el.scrollLeft = Math.max(0, on.offsetLeft + on.offsetWidth - el.clientWidth + 16)
  }, [data.day])
  return (
    <div className="ic-nights" role="tablist" aria-label="Night" ref={row}>
      {nights.map((n) => {
        const live = n.day === latest && !(n.day === data.day && settled)
        return (
          <button
            key={n.day}
            type="button"
            role="tab"
            className="ic-night"
            aria-selected={n.day === data.day}
            onClick={() => onDay(n.day)}
          >
            <b>
              {live ? 'Tonight' : nightTab(n.date) || `Day ${n.day}`}
              {live && <span className="ic-live" aria-label="reading lines" />}
            </b>
            {live && n.date && <span className="num">{nightLabel(n.date).split(' ').slice(1).join(' ')}</span>}
            {!live && <span className="sr-only">{`, ${n.games} games`}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** One meta line beside the night tabs: "2 of 7 games to come · First tip 01:00 · Last look 00:33". */
function NightMeta({ data }: { data: BookCompare }) {
  const n = data.games.length
  if (n === 0) return null
  const toCome = data.games.filter((g) => g.status !== 'final').length
  const next = data.games
    .filter((g) => g.status === 'scheduled')
    .map((g) => g.tip)
    .sort()[0]
  return (
    <p className="ic-meta">
      {toCome > 0 ? (
        <span>
          <b className="num">{toCome}</b> of <b className="num">{n}</b> games to come
        </span>
      ) : (
        <span>
          <b className="num">{n}</b> {n === 1 ? 'game' : 'games'}, all final
        </span>
      )}
      {next && clock(next) && (
        <span className="ic-meta-tip">
          First tip <b className="num">{clock(next)}</b>
        </span>
      )}
      {data.look.checked && clock(data.look.checked) && (
        <span>
          Last look <b className="num">{clock(data.look.checked)}</b>
        </span>
      )}
    </p>
  )
}

/** The foot: one line on the last look at iddaa (the bands moved to How to read). */
function LookLine({ data }: { data: BookCompare }) {
  const { look } = data
  return (
    <p className="ic-foot">
      {look.checked ? (
        <>
          Last look at iddaa <span className="num">{clock(look.checked)}</span>{' '}
          {look.ok === false ? (
            `failed${look.error ? `: ${look.error}` : ''}`
          ) : (
            <>
              worked · <span className="num">{look.matched}</span> of <span className="num">{look.games}</span>{' '}
              {look.games === 1 ? 'game' : 'games'} matched
            </>
          )}
        </>
      ) : (
        'No look at iddaa yet since the server started'
      )}
    </p>
  )
}

const ORDER = { final: 0, live: 1, scheduled: 2 } as const

/** The night in one card: where the games stand, how the judged lines have gone so far, and the
 *  games themselves as the page's game filter (final first, then live, then still to come). */
function NightCard({
  data,
  lines,
  settled,
  game,
  onGame,
}: {
  data: BookCompare
  lines: Line[]
  settled: boolean
  game: number | null
  onGame: (g: number | null) => void
}) {
  const looks = data.games.map((g) => g.checked).sort()
  const count = (st: CompareGame['status']) => data.games.filter((g) => g.status === st).length
  const where = [
    count('final') && `${count('final')} final`,
    count('live') && `${count('live')} live`,
    count('scheduled') && `${count('scheduled')} to come`,
  ].filter(Boolean)
  const t = tallyOf(lines)
  const games = [...data.games].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.tip.localeCompare(b.tip))
  return (
    <div className="ic-nc">
      <div className="ic-status">
        <span className="ic-date">{nightLabel(data.date)}</span>
        <span>{settled ? `${data.games.length} games, all final` : where.join(' · ')}</span>
        <span className="ic-opt">
          <span className="num">{t.n}</span> lines · <span className="num">{t.above}</span> Ours above
        </span>
        <span className="ic-look">
          {!settled && <span className="ic-live" />}
          {settled ? 'Last looks ' : 'Last look '}
          <span className="num">
            {settled && looks.length > 1
              ? `${clock(looks[0])}–${clock(looks[looks.length - 1])}`
              : clock(looks[looks.length - 1] ?? '')}
          </span>
        </span>
      </div>
      {t.judged > 0 && (
        <div className="ic-tally-line">
          <span className="ic-tl-say">
            {settled ? '' : 'So far: '}We won <b className="g">{t.oursCloser}</b> of <b>{t.judged}</b> · Book won{' '}
            <b>{t.bookCloser}</b>
            {t.level > 0 && (
              <>
                {' '}
                · Level <b>{t.level}</b>
              </>
            )}
          </span>
          <Split t={t} />
          <span className="ic-tl-band">Each line settled on one book line, win or lose</span>
        </div>
      )}
      <div className="ic-games" role="group" aria-label="Game">
        <button type="button" className="ic-chip ic-chip-all" aria-pressed={game == null} onClick={() => onGame(null)}>
          All Games
        </button>
        {games.map((g) => {
          const gt = tallyOf(lines.filter((l) => l.game.game_id === g.game_id))
          const score = g.away_score != null && g.home_score != null ? `${g.away_score}–${g.home_score}` : ''
          return (
            <button
              key={g.game_id}
              type="button"
              className="ic-chip ic-chip-g"
              aria-pressed={game === g.game_id}
              onClick={() => onGame(game === g.game_id ? null : g.game_id)}
            >
              <span className="ic-chip-h">
                <TeamLogo abbrev={g.away} size={18} />
                {g.away} @ {g.home}
                <TeamLogo abbrev={g.home} size={18} />
              </span>
              <span className="ic-chip-s">
                {g.status === 'final' ? (
                  <>
                    Final <span className="num">{score}</span>
                  </>
                ) : g.status === 'live' ? (
                  <>
                    <span className="ic-live" aria-hidden="true" />
                    Live <span className="num">{score}</span>
                  </>
                ) : (
                  <>
                    Tip <span className="num">{clock(g.tip)}</span>
                  </>
                )}
              </span>
              <span className="ic-chip-f">
                {g.status === 'final' && gt.judged ? (
                  <>
                    Won: Ours <span className="num">{gt.oursCloser}</span>, Book{' '}
                    <span className="num">{gt.bookCloser}</span>
                  </>
                ) : (
                  <>
                    {g.status === 'scheduled' ? 'Read at' : 'Kept as read at'}{' '}
                    <span className="num">{clock(g.checked)}</span>
                  </>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Who was nearer, as a bar: green for us, the track for level, muted for the book. */
function Split({ t }: { t: Tally }) {
  return (
    <span className="ic-split" aria-hidden="true">
      {t.oursCloser > 0 && <span className="o" style={{ flex: t.oursCloser }} />}
      {t.level > 0 && <span className="lv" style={{ flex: t.level }} />}
      {t.bookCloser > 0 && <span className="i" style={{ flex: t.bookCloser }} />}
    </span>
  )
}

/** Who was closer, stat by stat: under the list, once any line is judged. */
function StatCloser({ lines, game }: { lines: Line[]; game: number | null }) {
  const mine = lines.filter((l) => game == null || l.game.game_id === game)
  if (!tallyOf(mine).judged) return null
  const row = (s: Stat) => {
    const t = tallyOf(mine.filter((l) => l.stat === s))
    if (!t.n) return null
    return (
      <li key={s}>
        <span className="ic-st">{STAT_NAME[s]}</span>
        {t.judged ? (
          <>
            <Split t={t} />
            <span className="ic-tx">
              We won <b className="g">{t.oursCloser}</b> · Book won <b>{t.bookCloser}</b>
            </span>
            <span className="ic-mm">
              {s === 'WIN' ? (
                <>
                  Our pick won <span className="num">{t.ours}</span> of <span className="num">{t.judged}</span>
                </>
              ) : (
                t.oursMiss != null &&
                t.bookMiss != null && (
                  <>
                    Off on average: Ours <span className="num">{num(t.oursMiss)}</span> · Book{' '}
                    <span className="num">{num(t.bookMiss)}</span>
                  </>
                )
              )}
            </span>
          </>
        ) : (
          <span className="ic-tx ic-none-yet">No results yet</span>
        )}
      </li>
    )
  }
  return (
    <section className="ic-sec" aria-labelledby="ic-h-closer">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-closer">Who won, stat by stat</h2>
          <p className="ic-sub">
            Each line is settled on one of the book's lines: our number takes the over or the under, and the result decides
            who won. Never both, never level.
          </p>
        </div>
      </div>
      <div className="ic-t-group">Players</div>
      <ul className="ic-t-list">{PLAYER_STATS.map(row)}</ul>
      <div className="ic-t-group">Games</div>
      <ul className="ic-t-list">{GAME_STATS.map(row)}</ul>
    </section>
  )
}

interface ListProps {
  lines: Line[]
  settled: boolean
  group: 'players' | 'games'
  stat: Stat | 'ALL'
  game: number | null
  showAll: boolean
  fold: boolean
  open: string | null
  onGroup: (g: 'players' | 'games') => void
  onStat: (s: Stat | 'ALL') => void
  onShowAll: () => void
  onFold: () => void
  onOpen: (id: string) => void
  flash: string | null
}

function GapList(p: ListProps) {
  const { lines, settled, group, stat, game } = p
  const stats = group === 'players' ? PLAYER_STATS : GAME_STATS
  const inGame = (l: Line) => game == null || l.game.game_id === game
  const pool = lines.filter((l) => stats.includes(l.stat) && inGame(l) && l.gap != null)
  const shown = pool.filter((l) => stat === 'ALL' || l.stat === stat)
  const { above, rest } = ranked(shown, stat === 'ALL')
  const page = usePhone() ? PAGE_PHONE : PAGE
  const limit = p.showAll ? Infinity : page
  const count = (g: 'players' | 'games') =>
    lines.filter((l) => (g === 'players' ? l.kind === 'player' : l.kind === 'game') && inGame(l) && l.gap != null)
      .length
  const top = above.slice(0, 3)
  const list = above.slice(3)
  const hidden = Math.max(0, list.length - limit)
  const most = rest[0]
  const waiting = group === 'players' && pool.length === 0 && !settled
  return (
    <section className={`ic-sec${waiting ? ' ic-waiting' : ''}`} aria-labelledby="ic-h-list">
      <div className="ic-controls">
        <div className="ic-ctrl-top">
          <div className="ic-seg" role="group" aria-label="Lines">
            {(['players', 'games'] as const).map((g) => (
              <button key={g} type="button" aria-pressed={group === g} onClick={() => p.onGroup(g)}>
                {g === 'players' ? 'Players' : 'Games'}
                <span className="num">{count(g)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ic-tabs" role="tablist" aria-label="Stat">
          <button type="button" role="tab" className="ic-tab" aria-selected={stat === 'ALL'} onClick={() => p.onStat('ALL')}>
            All<span className="num">{pool.length}</span>
          </button>
          {stats.map((s) => {
            const c = pool.filter((l) => l.stat === s).length
            return (
              <button
                key={s}
                type="button"
                role="tab"
                className="ic-tab"
                aria-selected={stat === s}
                disabled={!c}
                onClick={() => p.onStat(s)}
              >
                {STAT_NAME[s]}
                <span className="num">{c}</span>
              </button>
            )
          })}
        </div>
        <label className="ic-stat-sel">
          <span className="sr-only">Stat</span>
          <select value={stat} onChange={(e) => p.onStat(e.target.value as Stat | 'ALL')}>
            <option value="ALL">{`All Stats · ${pool.length}`}</option>
            {stats.map((s) => {
              const c = pool.filter((l) => l.stat === s).length
              return (
                <option key={s} value={s} disabled={!c}>
                  {`${STAT_NAME[s]} · ${c}`}
                </option>
              )
            })}
          </select>
          <Chevron />
        </label>
      </div>
      <div className="ic-sec-h ic-stage-h">
        <div>
          <h2 id="ic-h-list">{settled ? 'The biggest gaps, and how they landed' : 'Where we and the book disagree most'}</h2>
        </div>
      </div>
      <div className="ic-explain">
        <p>
          {stat === 'ALL'
            ? 'Ranked by gap in bands, so a +0.5 steal and a +2.5 point gap compare fairly.'
            : `${STAT_NAME[stat]}: ranked by the raw gap.`}{' '}
          <span className="num">{above.length}</span> of <span className="num">{shown.length}</span> have Ours above.
        </p>
        <Key judged={lines.some((l) => l.oursHit != null)} />
      </div>
      {waiting && (
        <p className="ic-none">
          No player bets from iddaa yet. Once it prices a player, he gets one bet here: the line, its own odds and how
          sure we are.
        </p>
      )}
      {top.length > 0 && <DuelStage lines={top} flash={p.flash} />}
      {list.length > 0 && (
        <>
          <h3 className="ic-rest-h">The rest of the gaps</h3>
          <ColHead />
        </>
      )}
      {above.length === 0 ? (
        pool.length > 0 && <p className="ic-none">
          No line had Ours above the book{stat === 'ALL' ? '' : ` in ${STAT_NAME[stat]}`}.{' '}
          {most && most.book != null && most.ours != null && (
            <>
              Biggest the other way: <b>{`${most.kind === 'player' ? most.name : most.gameLabel} ${STAT_NAME[most.stat]}`}</b>,
              Book {value(most, 'book')} vs Ours {value(most, 'ours')}.
            </>
          )}
        </p>
      ) : (
        list.length > 0 && (
          <ol className={`ic-rows${p.open ? ' has-open' : ''}`}>
            {list.slice(0, limit).map((l, i) => (
              <Row
                key={l.id}
                line={l}
                i={i}
                rank={i + 4}
                settled={settled}
                open={p.open === l.id}
                flash={p.flash === l.id}
                onOpen={p.onOpen}
              />
            ))}
          </ol>
        )
      )}
      <div className="ic-list-foot">
        {hidden > 0 && (
          <button type="button" className="secondary" onClick={p.onShowAll}>
            Show all {above.length} above the book
          </button>
        )}
        {rest.length > 0 && (
          <button type="button" className="ic-fold-btn" aria-expanded={p.fold} onClick={p.onFold}>
            <Chevron />
            Ours level with or below the book <span className="num">{rest.length}</span>
          </button>
        )}
        {p.fold && (
          <ol className={`ic-rows${p.open ? ' has-open' : ''}`}>
            {rest.slice(0, p.showAll ? undefined : page).map((l, i) => (
              <Row
                key={l.id}
                line={l}
                i={i}
                rank={0}
                settled={settled}
                open={p.open === l.id}
                flash={p.flash === l.id}
                onOpen={p.onOpen}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

/** How to read a line, once, instead of a paragraph. */
function Key({ judged }: { judged: boolean }) {
  return (
    <span className="ic-key" aria-label="How to read a line: the book's number, the gap, our number">
      <span>
        <span className="kb">5.3</span>Book
      </span>
      <span>
        <span className="kg">+2.3</span>Gap
      </span>
      <span>
        <span className="ko">7.6</span>Ours
      </span>
      <span>
        <span className="kp">1.95</span>the book's odds
      </span>
      {judged && (
        <span>
          <span className="ic-key-ok">
            <CheckIcon />
          </span>
          won on the book's line
        </span>
      )}
    </span>
  )
}

function ColHead() {
  return (
    <div className="ic-colhead ic-grid" aria-hidden="true">
      <span />
      <span />
      <span>Line</span>
      <div className="ic-lane">
        <span className="l">Book</span>
        <span className="c">Gap</span>
        <span className="r">Ours</span>
      </div>
      <span className="ic-ch-slot">Result</span>
    </div>
  )
}

/** A line's number as the row shows it: "18.5", "PHI 85%", "PHI by 11.5", "MIL 108.5". */
function value(l: Line, which: 'ours' | 'book') {
  const v = l[which]
  if (v == null) return '–'
  switch (l.stat) {
    case 'WIN':
      return (
        <>
          <small>{l.team}</small>
          {Math.round(v * 100)}
          <span className="pct">%</span>
        </>
      )
    case 'MAR':
      return v >= 0 ? (
        <>
          <small>
            {l.team}
            <span className="by"> by</span>
          </small>
          {num(v)}
        </>
      ) : (
        <>
          <small>
            {l.other}
            <span className="by"> by</span>
          </small>
          {num(-v)}
        </>
      )
    case 'TEAM':
      return (
        <>
          <small>{l.team}</small>
          {num(v)}
        </>
      )
    case 'TOT':
      return num(v)
    default:
      return v.toFixed(1)
  }
}

function resultValue(l: Line) {
  if (l.stat === 'WIN') {
    return l.won ? (
      <>
        <small>won</small>
        {l.won}
      </>
    ) : null
  }
  if (l.actual == null) return l.played === false ? <small>DNP</small> : null
  if (l.stat === 'MAR') {
    return l.actual >= 0 ? (
      <>
        <small>{l.team} by</small>
        {num(l.actual)}
      </>
    ) : (
      <>
        <small>{l.other} by</small>
        {num(-l.actual)}
      </>
    )
  }
  return num(l.actual)
}

/** The duel stage's shared scale, in bands: wide enough for every card's gap and result. */
function stageScale(lines: Line[]) {
  let lo = -0.25
  let hi = 0.5
  for (const l of lines) {
    hi = Math.max(hi, l.score + 0.25)
    lo = Math.min(lo, l.score - 0.25)
    if (l.actual != null && l.book != null && l.stat !== 'WIN') {
      const r = (l.actual - l.book) / l.band
      hi = Math.max(hi, r + 0.25)
      lo = Math.min(lo, r - 0.25)
    }
  }
  return { lo: Math.max(-2, lo), hi: Math.min(2.6, hi) }
}

/** The top three gaps as duel cards: the book's number facing ours across the gap, on one ruler. */
function DuelStage({ lines, flash }: { lines: Line[]; flash: string | null }) {
  const scale = stageScale(lines)
  return (
    <div className="ic-stage">
      {lines.map((l, i) => (
        <DuelCard key={l.id} line={l} rank={i + 1} scale={scale} flash={flash === l.id} />
      ))}
    </div>
  )
}

function DuelCard({
  line: l,
  rank,
  scale,
  flash,
}: {
  line: Line
  rank: number
  scale: { lo: number; hi: number }
  flash: boolean
}) {
  const g = l.game
  const final = g.status === 'final' && l.closer != null
  const unit = STAT_UNIT[l.stat]
  const cap1 =
    l.stat === 'WIN'
      ? 'Each tick: 20 points of chance'
      : `Each tick: one band, ${num(l.band)} ${l.band === 1 ? unit.replace(/s$/, '') : unit}`
  return (
    <article
      className={`ic-duel${final ? ' has-res' : ''}${flash ? ' ic-flash' : ''}`}
      data-line={l.id}
      aria-label={`Number ${rank}: ${l.kind === 'player' ? l.name : l.gameLabel}, ${STAT_NAME[l.stat]}`}
    >
      <header>
        <span className="ic-rkd" aria-hidden="true">
          {rank}
        </span>
        <Face line={l} />
        <div className="ic-dw">
          <b>{l.kind === 'player' ? <NameLink line={l} /> : l.gameLabel}</b>
          <span>
            <em>{l.stat === 'TEAM' ? `${l.team} points` : STAT_NAME[l.stat]}</em>
            {l.kind === 'player' && <> · {l.gameLabel}</>}
          </span>
        </div>
        <span className="ic-when">
          {g.status === 'final' ? (
            'Final'
          ) : g.status === 'live' || l.tipped ? (
            <>
              <span className="ic-live" aria-hidden="true" />
              Live
            </>
          ) : (
            <>
              Tip <span className="num">{clock(g.tip)}</span>
            </>
          )}
        </span>
      </header>
      <div className="ic-faceoff">
        <span className="lab bk">
          Book
          {l.price && (
            <>
              {' · '}
              <Px line={l} long />
            </>
          )}
        </span>
        <span className="lab ou">Ours</span>
        <span className="v bk">{value(l, 'book')}</span>
        <span className="wire" aria-hidden="true">
          <span className="gap">{signed(l.gap ?? 0, l.stat)}</span>
        </span>
        <span className="v ou">{value(l, 'ours')}</span>
        {final && (
          <>
            <HitWord line={l} side="book" />
            <HitWord line={l} side="ours" />
          </>
        )}
      </div>
      <StageRuler line={l} scale={scale} />
      <div className="ic-duel-cap">{cap1}</div>
      <DuelSlot line={l} />
    </article>
  )
}

/** The settled duel in a few words: "11+ won", "Under 11 lost", "Book won"; a winner pick stays right or wrong. */
function callWord(l: Line, side: 'ours' | 'book', ok: boolean): string {
  if (l.stat === 'WIN') return ok ? 'right' : 'wrong'
  if (side === 'book') return ok ? 'Book won' : 'Book lost'
  return `${l.barem?.label ?? 'Ours'} ${ok ? 'won' : 'lost'}`
}

/** "✓ Over won" or "✗ Over lost" under ours, "✓ Book won" / "✗ Book lost" under the book's: how a bet settled. */
function HitWord({ line: l, side }: { line: Line; side: 'ours' | 'book' }) {
  const ok = side === 'ours' ? l.oursHit : l.bookHit
  if (ok == null) return <span className={`hw ${side === 'ours' ? 'ou' : 'bk'}`} />
  return (
    <span className={`hw ${side === 'ours' ? 'ou' : 'bk'} ${ok ? 'ok' : 'no'}`}>
      {ok ? <CheckIcon /> : <XIcon />}
      {callWord(l, side, ok)}
    </span>
  )
}

/** One duel's ruler on the stage's shared scale: the book's tick, the warm bar to ours, the result pin. */
function StageRuler({ line: l, scale }: { line: Line; scale: { lo: number; hi: number } }) {
  const x = (b: number) => ((Math.max(scale.lo, Math.min(scale.hi, b)) - scale.lo) / (scale.hi - scale.lo)) * 100
  const b0 = x(0)
  const o = x(l.score)
  const ticks: number[] = []
  for (let k = Math.ceil(scale.lo); k <= Math.floor(scale.hi); k++) if (k !== 0) ticks.push(k)
  const res = l.actual != null && l.book != null && l.stat !== 'WIN' ? x((l.actual - l.book) / l.band) : null
  const label = `The book's line, then ours ${signed(l.gap ?? 0, l.stat)} away${
    l.actual != null && l.stat !== 'WIN' ? `, and the result ${num(l.actual)}` : ''
  }.`
  return (
    <div className="ic-sruler" role="img" aria-label={label}>
      <i className="ax" />
      {ticks.map((k) => (
        <i key={k} className="tk" style={{ left: `${x(k)}%` }} />
      ))}
      <i className={`bar${(l.gap ?? 0) < 0 ? ' dn' : ''}`} style={{ left: `${Math.min(b0, o)}%`, width: `${Math.abs(o - b0)}%` }} />
      <i className="bk" style={{ left: `${b0}%` }} />
      {res != null && <i className="pin" style={{ left: `${res}%` }} />}
      {(res == null || Math.abs(res - b0) >= 16) && (
        <span className="lbl" style={{ left: `${Math.max(6, b0)}%` }}>
          Book
        </span>
      )}
      {res != null && (
        <span className="lbl r" style={{ left: `${Math.max(8, Math.min(92, res))}%` }}>
          Result {num(l.actual ?? 0)}
        </span>
      )}
    </div>
  )
}

/** The duel's footer: the plain sentence before the game, Playing during it, then who was nearer. */
function DuelSlot({ line: l }: { line: Line }) {
  const g = l.game
  if (g.status === 'final' && (l.closer || l.actual != null)) {
    const say =
      l.kind === 'player' && l.actual != null ? (
        <>
          Finished with <b>{num(l.actual)}</b> {l.actual === 1 ? STAT_UNIT[l.stat].replace(/s$/, '') : STAT_UNIT[l.stat]}.
        </>
      ) : (
        <>{cap(plain(l, true))}.</>
      )
    return (
      <div className={`ic-dslot${l.closer === 'ours' ? ' ours' : ''}`}>
        <span>{say}</span>
        <Verdict line={l} />
      </div>
    )
  }
  if (l.tipped)
    return (
      <div className="ic-dslot live">
        <span>
          <span className="ic-live" aria-hidden="true" />
          Playing now
        </span>
        <span className="sub">
          {l.barem ? (
            <>
              on <span className="num">{l.barem.label}</span>
              {l.barem.odd != null && (
                <>
                  {' at '}
                  <span className="num">{odds(l.barem.odd)}</span>
                </>
              )}
            </>
          ) : (
            <>
              kept as read at <span className="num">{clock(g.checked)}</span>
            </>
          )}
        </span>
      </div>
    )
  if (l.barem) {
    const sure = sureOf(l.barem)
    return (
      <div className="ic-dslot pre bet">
        <span>
          Our bet <b>{l.barem.label}</b>
          {l.barem.odd != null && (
            <>
              {' at '}
              <b>{odds(l.barem.odd)}</b>
            </>
          )}
        </span>
        {sure && (
          <span className="sub">
            <span className="num">{sure}</span> sure
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="ic-dslot pre">
      <span>{cap(plain(l, false))}.</span>
    </div>
  )
}

function Row({
  line: l,
  i,
  rank,
  settled,
  open,
  flash,
  onOpen,
}: {
  line: Line
  i: number
  rank: number
  settled: boolean
  open: boolean
  flash: boolean
  onOpen: (id: string) => void
}) {
  return (
    <li className={`ic-row${open ? ' is-open' : ''}${flash ? ' ic-flash' : ''}`} data-line={l.id}>
      <button type="button" className="ic-row-main ic-grid" aria-expanded={open} onClick={() => onOpen(l.id)}>
        <span className="ic-rk">{rank || ''}</span>
        <Face line={l} />
        <Who line={l} />
        <Lane line={l} i={i} />
        <ResultSlot line={l} />
      </button>
      {lostWhy(l) && (
        <p className="ic-row-why">
          <b>Why</b> {lostWhy(l)}
        </p>
      )}
      {open && <RowOpen line={l} settled={settled} />}
    </li>
  )
}

/** Where the result lands: a quiet well until tip-off, "Playing" during the game, then the result
 *  and who was nearer. A soft green light marks the slot (never the row) when we were closer. */
function ResultSlot({ line: l }: { line: Line }) {
  const g = l.game
  if (g.status === 'final') {
    return (
      <div className={`ic-slot fin${l.closer === 'ours' ? ' ours' : ''}`}>
        <span className="ic-slot-res">
          <span className="lab">Result</span>
          <b>{resultValue(l) ?? '–'}</b>
        </span>
        <Verdict line={l} />
      </div>
    )
  }
  if (l.tipped)
    return (
      <div className="ic-slot live">
        <span className="ic-live" aria-hidden="true" />
        Playing
        <span className="sub">
          {l.barem ? (
            <>
              on <span className="num">{l.barem.label}</span>
              {l.barem.odd != null && (
                <>
                  {' · '}
                  <span className="num">{odds(l.barem.odd)}</span>
                </>
              )}
            </>
          ) : (
            <>
              kept at <span className="num">{clock(g.checked)}</span>
            </>
          )}
        </span>
      </div>
    )
  if (l.barem) return <BetSlot line={l} />
  if (l.kind === 'player' && l.book != null)
    return (
      <div className="ic-slot wait bet none">
        <span className="ic-slot-vd none">
          <b>No bet</b>
          <span>odds 1.33 or less</span>
        </span>
      </div>
    )
  return (
    <div className="ic-slot wait">
      <span className="sub">
        Tip <span className="num">{clock(g.tip)}</span>
      </span>
    </div>
  )
}

/** Before tip-off, the one bet we take on the line (Can 2026-11-22): the barem, its own odds and our
 *  confidence that it wins. */
function BetSlot({ line: l }: { line: Line }) {
  const b = l.barem
  if (!b) return null
  const sure = sureOf(b)
  return (
    <div
      className="ic-slot wait bet"
      title={`Our bet: ${b.label}${b.odd != null ? ` at ${odds(b.odd)}` : ''}${sure ? `, ${sure} sure` : ''}. Tip ${clock(l.game.tip)}`}
    >
      <span className="ic-slot-res">
        <span className="lab">Bet</span>
        <b>{b.label}</b>
      </span>
      <span className="ic-slot-vd">
        {b.odd != null && <b className="num">{odds(b.odd)}</b>}
        {sure && (
          <span>
            <span className="num">{sure}</span> sure
          </span>
        )}
      </span>
    </div>
  )
}

/** Who won the row's duel, in words: green for us, calm for the book; under it the barem it was
 *  settled on and the book's odds there ("on 11+ · 1.85"). */
function Verdict({ line: l }: { line: Line }) {
  if (!l.closer) {
    // a final line with no duel: a player whose rungs under ours are all priced 1.33 or less
    if (l.game.status !== 'final' || l.actual == null || l.barem || l.stat === 'WIN') return null
    return (
      <span className="ic-slot-vd none">
        <b>No call</b>
        <span>odds 1.33 or less</span>
      </span>
    )
  }
  const by = l.stat === 'WIN' && l.by != null && l.closer !== 'tie' ? `${Math.round(l.by * 100)}pp` : null
  return (
    <span className={`ic-slot-vd ${l.closer}`}>
      <b>{l.closer === 'ours' ? 'We won' : l.closer === 'book' ? 'Book won' : 'Level with the book'}</b>
      {by && (
        <span>
          by <span className="num">{by}</span>
        </span>
      )}
      {l.barem && (
        <span>
          on <span className="num">{l.barem.label}</span>
          {l.barem.odd != null && (
            <>
              {' · '}
              <span className="num">{odds(l.barem.odd)}</span>
            </>
          )}
          {sureOf(l.barem) && (
            <>
              {' · '}
              <span className="num">{sureOf(l.barem)}</span>
            </>
          )}
        </span>
      )}
    </span>
  )
}

/** ✓ or ✗ beside a number: how a bet on it settled (our call over or under the book's number). */
function Hit({ line: l, side }: { line: Line; side: 'ours' | 'book' }) {
  const ok = side === 'ours' ? l.oursHit : l.bookHit
  if (ok == null || l.game.status !== 'final') return null
  const who = side === 'ours' ? 'Ours' : 'Book'
  const label =
    l.stat === 'WIN'
      ? `${who} ${ok ? 'right' : 'wrong'}`
      : `${callWord(l, side, ok)}${l.actual != null && l.barem ? `, result ${num(l.actual)} on ${l.barem.label}` : ''}`
  return (
    <span className={`ic-hit ${ok ? 'ok' : 'no'}`} role="img" aria-label={label}>
      {ok ? <CheckIcon /> : <XIcon />}
    </span>
  )
}

function Face({ line: l }: { line: Line }) {
  if (l.kind === 'player') {
    return (
      <span className="ic-face head" aria-hidden="true">
        <PlayerHead player={{ id: l.playerId ?? 0, name: l.name }} team={l.team} size={38} />
        <span className="ic-face-team">
          <TeamLogo abbrev={l.team} size={16} />
        </span>
      </span>
    )
  }
  return <Pair away={l.game.away} home={l.game.home} />
}

/** The two teams' logos, away over home, overlapping. */
function Pair({ away, home, size = 24 }: { away: string; home: string; size?: number }) {
  return (
    <span className="ic-face logos" aria-hidden="true" style={{ '--lg': `${size}px` } as CSSProperties}>
      <TeamLogo abbrev={away} size={size} fallback />
      <TeamLogo abbrev={home} size={size} fallback />
    </span>
  )
}

function Who({ line: l }: { line: Line }) {
  if (l.kind === 'player') {
    return (
      <div className="ic-who">
        <div className="ic-nm">
          <NameLink line={l} />
        </div>
        <div className="ic-sub ic-sub-l">
          <b>{STAT_NAME[l.stat]}</b> · {plain(l, settledOf(l))}
        </div>
        <div className="ic-sub ic-sub-s">
          <b>{STAT_NAME[l.stat]}</b> · {l.gameLabel}
        </div>
      </div>
    )
  }
  return (
    <div className="ic-who">
      <div className="ic-nm">
        {l.gameLabel} <span className="ic-nm-st">{l.stat === 'TEAM' ? `${l.team} points` : STAT_NAME[l.stat]}</span>
      </div>
      <div className="ic-sub ic-sub-l">{cap(plain(l, settledOf(l)))}</div>
    </div>
  )
}

/** His name opens his player card. It sits inside the row's open/close button, so it is a tap
 * target only; keyboard users get the "Player details" button in the opened row. */
function NameLink({ line: l }: { line: Line }) {
  const card = usePlayerCard()
  const id = l.playerId ?? 0
  if (!card || id <= 0) return <>{l.name}</>
  const who = { id, name: l.name }
  return (
    <span
      className="ic-nm-link"
      title={`${l.name}: player details`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && card.prefetch(who)}
      onPointerDown={() => card.prefetch(who)}
      onClick={(e) => {
        e.stopPropagation()
        card.open(who)
      }}
    >
      {l.name}
    </span>
  )
}

function DetailsButton({ line: l }: { line: Line }) {
  const card = usePlayerCard()
  const id = l.playerId ?? 0
  if (l.kind !== 'player' || !card || id <= 0) return null
  const who = { id, name: l.name }
  return (
    <button
      type="button"
      className="secondary ic-card-btn"
      aria-haspopup="dialog"
      onPointerEnter={(e) => e.pointerType === 'mouse' && card.prefetch(who)}
      onClick={() => card.open(who)}
    >
      Player details
    </button>
  )
}

const settledOf = (l: Line) => l.game.status === 'final'
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function Lane({ line: l, i }: { line: Line; i: number }) {
  const gap = l.gap ?? 0
  const share = Math.abs(l.score) / FULL_AT
  const style = { '--w': Math.min(share, 1).toFixed(3), '--i': i } as CSSProperties
  const clamp = share > 1 ? ' clamp' : ''
  const res = l.game.status === 'final' ? resultValue(l) : null
  return (
    <div className={`ic-lane${gap < 0 ? ' dn' : gap > 0 ? ' up' : ''}`} style={style}>
      <span className="pg pg-l" aria-hidden="true">
        Book
      </span>
      <div className="l">
        <Hit line={l} side="book" />
        <span className="ic-bk">
          <span className="ic-v ic-v-i">{value(l, 'book')}</span>
          <Px line={l} />
        </span>
        {gap < 0 && <span className={`ic-band bl${clamp}`} style={style} />}
      </div>
      <span className={`ic-pill${gap === 0 ? ' zero' : ''}${res != null ? ' has-r' : ''}`}>
        <span className="g">
          <span className="t">Gap</span>
          <span className="v">{signed(gap, l.stat)}</span>
        </span>
        {res != null && (
          <span className="r">
            <span className="t">Result</span>
            <span className="v">{res}</span>
          </span>
        )}
      </span>
      <div className="r">
        {gap > 0 && <span className={`ic-band br${clamp}`} style={style} />}
        <span className="ic-v ic-v-o">
          {value(l, 'ours')}
          <Caret />
        </span>
        <Hit line={l} side="ours" />
      </div>
      <span className="pg pg-r" aria-hidden="true">
        Ours
      </span>
    </div>
  )
}

/** The book's odds under its number: "20+ · 1.95", "Over · 1.93", or "Top 8+ · 2.10" when our
 *  number is past the highest rung the book prices. */
function Px({ line: l, long = false }: { line: Line; long?: boolean }) {
  const p = l.price
  if (!p) return null
  const say = `${p.top ? (long ? 'top line ' : 'Top ') : ''}${p.label}`
  return (
    <span
      className={`ic-px${p.top ? ' top' : ''}`}
      title={
        p.top
          ? `The book's highest line is ${p.label} at ${odds(p.odd)}; our number is past it`
          : `The book's odds: ${p.label} at ${odds(p.odd)}`
      }
    >
      {say}
      {long ? ' at ' : ' · '}
      <span className="num">{odds(p.odd)}</span>
    </span>
  )
}

/** A ruler centred on the result with the band shaded: Ours an open ▽ above, the book a solid ▲ below. */
function Ruler({ line: l, big = false }: { line: Line; big?: boolean }) {
  if (l.actual == null || l.ours == null || l.book == null) return null
  const W = big ? 420 : 220
  const H = big ? 46 : 34
  const c = W / 2
  const pad = big ? 14 : 12
  const band = l.band
  const span = band * 2.2
  const s = (c - pad) / span
  const y = big ? 20 : 17
  const at = (v: number) => {
    const d = v - (l.actual ?? 0)
    return { x: c + Math.max(-span, Math.min(span, d)) * s, out: Math.abs(d) > span }
  }
  const o = at(l.ours)
  const b = at(l.book)
  const bw = band * s
  const k = big ? 1 : 1.2
  const edge = (p: { x: number; out: boolean }, top: boolean) =>
    p.out ? (
      <path
        className="r-edge"
        d={`M${p.x + (p.x > c ? 4 : -4)} ${top ? y - 13 : y + 6} l${p.x > c ? 3 : -3} 3.5 l${p.x > c ? -3 : 3} 3.5`}
      />
    ) : null
  const label = `Result ${num(l.actual)}. Band ${num(l.actual - band)} to ${num(l.actual + band)}. Ours ${num(l.ours)}, book ${num(
    l.book,
  )}${l.oursHit == null ? '' : l.oursHit ? ': our call won' : ': the book won'}.`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line className="r-axis" x1={pad - 6} y1={y} x2={W - pad + 6} y2={y} />
      <rect className="r-shade" x={c - bw} y={y - 7} width={bw * 2} height={14} rx={4} />
      <line className="r-res" x1={c} y1={y - 9} x2={c} y2={y + 9} />
      <path className="r-iddaa" d={`M${b.x} ${y + 3} l${4.5 * k} ${7.5 * k} h${-9 * k}z`} />
      {edge(b, false)}
      <path className="r-ours" d={`M${o.x - 5 * k} ${y - 3.5 - 8.5 * k} h${10 * k} l${-5 * k} ${8.5 * k}z`} />
      {edge(o, true)}
      {big && (
        <>
          <text className="c" x={c} y={H - 1} textAnchor="middle">
            {num(l.actual)}
          </text>
          <text x={c - bw} y={H - 1} textAnchor="middle">
            {num(l.actual - band)}
          </text>
          <text x={c + bw} y={H - 1} textAnchor="middle">
            {num(l.actual + band)}
          </text>
        </>
      )}
    </svg>
  )
}

function RowOpen({ line: l, settled }: { line: Line; settled: boolean }) {
  const unit = STAT_UNIT[l.stat]
  const big = (v: number | null) =>
    v == null ? '–' : l.stat === 'WIN' ? `${Math.round(v * 100)}%` : l.kind === 'player' ? v.toFixed(1) : num(v)
  const offO = l.actual != null && l.ours != null ? num(Math.abs(l.actual - l.ours)) : null
  const offB = l.actual != null && l.book != null ? num(Math.abs(l.actual - l.book)) : null
  return (
    <div className="ic-row-open">
      <div className="ic-ledger">
        <div className="cell">
          <span className="lab">Book</span>
          <span className="big i">{big(l.book)}</span>
        </div>
        <div className="cell">
          <span className="lab">Ours</span>
          <span className="big o">{big(l.ours)}</span>
        </div>
        <div className="cell">
          <span className="lab">{settled ? 'Result' : 'Gap'}</span>
          <span className="big">
            {settled
              ? l.stat === 'WIN'
                ? l.won || '–'
                : l.actual == null
                  ? l.played === false
                    ? 'DNP'
                    : '–'
                  : num(l.actual)
              : signed(l.gap ?? 0, l.stat)}
          </span>
        </div>
      </div>
      <div className="ic-why">
        {settled && l.stat === 'WIN' && l.won && (
          <p>
            {l.won} won. Ours gave {l.team} <b>{big(l.ours)}</b>, the book gave {l.team} <b>{big(l.book)}</b>.{' '}
            {l.closer === 'tie' ? 'Level.' : l.closer ? <><b>{l.closer === 'ours' ? 'Ours' : 'Book'}</b> was closer.</> : null}
          </p>
        )}
        {settled && l.stat !== 'WIN' && l.actual != null && (
          <>
            <p>
              {l.barem && l.closer ? (
                <>
                  <b>{l.closer === 'ours' ? 'We won' : 'Book won'}</b> on {l.barem.label}
                  {l.barem.odd != null ? ` at ${odds(l.barem.odd)}` : ''}
                  {sureOf(l.barem) ? ` (${sureOf(l.barem)} sure)` : ''}:{' '}
                  {l.kind === 'player'
                    ? `ours ${num(l.ours ?? 0)} backs at least ${l.barem.label.replace('+', '')}, the book's line, and the result was ${num(l.actual)}.`
                    : `ours took the ${l.barem.side} on the book's ${num(l.barem.at)} and the result was ${num(l.actual)}.`}{' '}
                </>
              ) : null}
              Off by {offO} (Ours) and {offB} (Book).
            </p>
            <div className="ic-ruler-big">
              <Ruler line={l} big />
            </div>
          </>
        )}
        {!settled && l.gap != null && (
          <p>
            {l.gap > 0 ? 'Ours is above the book' : l.gap < 0 ? 'Ours is below the book' : 'Level with the book'}
            {l.stat === 'WIN' ? ` on ${l.team}'s chance` : `, by ${num(Math.abs(l.gap))} ${unit}`}. That is{' '}
            <b>{Math.abs(l.score).toFixed(2)}</b> of a band.
          </p>
        )}
        {!settled && l.barem && (
          <p>
            Our bet: <b>{l.barem.label}</b>
            {l.barem.odd != null && (
              <>
                {' '}
                at <b className="num">{odds(l.barem.odd)}</b>, the book's own odds
              </>
            )}
            .
            {sureOf(l.barem) &&
              ` We are ${sureOf(l.barem)} sure he gets ${l.barem.label.replace('+', '')} or more, from how often players with a line like ours did over five seasons.`}
          </p>
        )}
        {l.rungs.length > 0 ? (
          <>
            <div className="ic-ladder-cap">
              The book's rungs at odds over 1.33, its margin removed. Ours is the open bar, the book the ▲, the notch the
              price (1 ÷ odds); ours past the notch is filled: the value.
            </div>
            <RungLadder line={l} />
            <RungNote line={l} />
          </>
        ) : l.ladder.length > 0 && l.book != null && (
          <>
            <div className="ic-ladder-cap">
              The book's N+ ladder: each rung's chance with its margin removed, then its odds. It crosses 50% at{' '}
              {l.book.toFixed(1)}, its line.
            </div>
            <div className="ic-ladder" aria-label="The book's ladder">
              {l.ladder.map(([n, chance]) => (
                <LadderRow key={n} n={n} chance={chance} odd={l.rungs.find((r) => r.n === n)?.odd} />
              ))}
            </div>
          </>
        )}
        <div className="ic-foot">
          Last look <span className="num">{clock(l.game.checked)}</span> · tip{' '}
          <span className="num">{clock(l.game.tip)}</span>
        </div>
        <DetailsButton line={l} />
      </div>
    </div>
  )
}

function LadderRow({ n, chance, odd }: { n: number; chance: number; odd?: number }) {
  return (
    <>
      <span className="n">{n}+</span>
      <span className="bar">
        <span style={{ width: `${(chance * 100).toFixed(1)}%` }} />
      </span>
      <span className="p">{Math.round(chance * 100)}%</span>
      <span className="o">{odd ? odds(odd) : '–'}</span>
    </>
  )
}

/** The top three gaps the list shows right now (the duel stage), as the field's numbered marks. */
function stageOf(lines: Line[], group: 'players' | 'games', stat: Stat | 'ALL', game: number | null) {
  const stats = group === 'players' ? PLAYER_STATS : GAME_STATS
  const shown = lines.filter(
    (l) =>
      stats.includes(l.stat) &&
      (game == null || l.game.game_id === game) &&
      l.gap != null &&
      (stat === 'ALL' || l.stat === stat),
  )
  return new Map(ranked(shown, stat === 'ALL').above.slice(0, 3).map((l, i) => [l.id, i + 1]))
}

/** Lines that belong together across the strips: the same player, or the same game. */
const kinOf = (l: Line) => (l.kind === 'player' ? `p:${l.playerId || l.name}` : `g:${l.game.game_id}`)

/** The mark in focus across every strip: a hover preview, or pinned by a click, Enter or a tap. */
type Active = { id: string; pin: boolean } | null

function HowDivided({
  lines,
  group,
  game,
  stage,
  onSee,
}: {
  lines: Line[]
  group: 'players' | 'games'
  game: number | null
  stage: Map<string, number>
  onSee: (l: Line) => void
}) {
  const stats = group === 'players' ? PLAYER_STATS : GAME_STATS
  const [act, setAct] = useState<Active>(null)
  const phone = usePhone()
  const mine = lines.filter((l) => stats.includes(l.stat) && l.gap != null && (game == null || l.game.game_id === game))
  const activeLine = act ? mine.find((l) => l.id === act.id) ?? null : null
  const kin = activeLine ? kinOf(activeLine) : null
  useEscapeLayer(act != null, () => setAct(null))
  useEffect(() => {
    if (!act) return
    // a press anywhere but a strip or the card puts the card away
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t?.closest?.('.ic-fld, .ic-mc, .ic-mc-scrim')) setAct(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [act])
  useEffect(() => setAct(null), [group, game])

  const has = (f: (l: Line) => boolean) => mine.some(f)
  const fin = (l: Line) => l.game.status === 'final' && l.closer != null
  return (
    <section className="ic-sec" aria-labelledby="ic-h-field">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-field">How divided</h2>
          <p className="ic-sub">
            Every line is one mark at its gap, measured in bands (the edges are 0.6 of a band, the same scale as the row
            bands). <span className="ic-hover-hint">Hover a mark to see whose line it is, click to keep the card open.</span>
            <span className="ic-tap-hint">Tap a mark to see whose line it is.</span>
          </p>
        </div>
        <div className="ic-legend">
          {stage.size > 0 && (
            <span>
              <i className="lg n">1</i>
              Top gaps above
            </span>
          )}
          {has((l) => fin(l) && l.closer === 'ours') && (
            <span>
              <i className="lg win" />
              We won
            </span>
          )}
          {has((l) => fin(l) && l.closer === 'book') && (
            <span>
              <i className="lg bk" />
              Book won
            </span>
          )}
          {has((l) => fin(l) && l.closer === 'tie') && (
            <span>
              <i className="lg lv" />
              Level
            </span>
          )}
          {has((l) => !fin(l) && l.tipped) && (
            <span>
              <i className="lg play" />
              Playing
            </span>
          )}
          {has((l) => !fin(l) && !l.tipped) && (
            <span>
              <i className="lg ring" />
              To come
            </span>
          )}
          <span>
            <span className="med-key" />
            Median
          </span>
        </div>
      </div>
      <div className="ic-field-head">
        <span className="lab-h">Stat</span>
        <div className="ax">
          <span>Book higher</span>
          <span>Seam: the book's line</span>
          <span>Ours higher</span>
        </div>
        <span className="notes-h">Ours above · closer</span>
      </div>
      {stats.map((s) => {
        const ls = mine.filter((l) => l.stat === s)
        if (!ls.length) return null
        const t = tallyOf(ls)
        const med = median(ls.map((l) => l.gap ?? 0))
        const best = [...ls].sort((a, b) => b.score - a.score)[0]
        return (
          <div className="ic-strip" key={s}>
            <div className="lab">
              <b>{STAT_NAME[s]}</b>
              <span>{ls.length} lines</span>
            </div>
            <Field
              lines={ls}
              stat={s}
              act={act}
              kin={kin}
              stage={stage}
              phone={phone}
              onAct={setAct}
              onSee={(l) => {
                setAct(null)
                onSee(l)
              }}
            />
            <div className="notes">
              <b>{t.above}</b> of {t.n} above · median {signed(med, s)}
              <br />
              {t.judged ? (
                <>
                  <i className="lg win" aria-hidden="true" />
                  We won <b className="g">{t.oursCloser}</b> of {t.judged}
                </>
              ) : (
                <>
                  biggest {signed(best.gap ?? 0, s)}{' '}
                  {best.kind === 'player' ? best.name.split(' ').slice(-1)[0] : best.gameLabel}
                </>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

/** One stat's lines as marks along the seam (a beeswarm). Hover a mark for a preview card, click it
 *  (or press Enter on the strip) to keep the card open, tap on phones; the arrow keys step through
 *  the marks. The same player's (or game's) marks in the other strips light up with it. */
function Field({
  lines,
  stat,
  act,
  kin,
  stage,
  phone,
  onAct,
  onSee,
}: {
  lines: Line[]
  stat: Stat
  act: Active
  kin: string | null
  stage: Map<string, number>
  phone: boolean
  onAct: (a: Active) => void
  onSee: (l: Line) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const pointer = useRef('mouse')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  const placed = useMemo(() => swarm(lines, width), [lines, width])
  const on = placed.marks.find((m) => m.line.id === act?.id) ?? null
  const pinned = !!on && !!act?.pin
  /** The card is a portal, but React still bubbles its events through here: answer the strip's own only. */
  const inside = (e: { target: EventTarget }) => !!ref.current?.contains(e.target as Node)

  /** The mark nearest the pointer, if one is within reach. */
  const near = (e: { clientX: number; clientY: number }, reach: number) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return null
    const px = e.clientX - box.left
    const py = e.clientY - box.top
    let best: (typeof placed.marks)[number] | null = null
    let d2 = reach * reach
    for (const m of placed.marks) {
      const d = (m.x - px) ** 2 + (m.y - py) ** 2
      if (d < d2) {
        d2 = d
        best = m
      }
    }
    return best
  }
  const step = (by: number) => {
    const ms = placed.marks // already left to right
    if (!ms.length) return
    const i = ms.findIndex((m) => m.line.id === on?.line.id)
    const next = i < 0 ? (by > 0 ? 0 : ms.length - 1) : Math.max(0, Math.min(ms.length - 1, i + by))
    onAct({ id: ms[next].line.id, pin: !!act?.pin })
  }

  return (
    <div
      ref={ref}
      className={`ic-fld${placed.dense ? ' dense' : ''}${act ? ' has-on' : ''}`}
      style={{ height: placed.height }}
      tabIndex={0}
      role="group"
      aria-label={`${STAT_NAME[stat]}: ${lines.length} lines. Use the arrow keys to step through them and Enter to keep a card open.`}
      onPointerDown={(e) => {
        if (inside(e)) pointer.current = e.pointerType
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || act?.pin || !inside(e)) return
        const m = near(e, 14)
        if (m) onAct({ id: m.line.id, pin: false })
        else if (on) onAct(null)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && on && !act?.pin) onAct(null)
      }}
      onClick={(e) => {
        if (!inside(e)) return
        const m = near(e, pointer.current === 'mouse' ? 14 : 24) // a finger is wider than a mark
        if (m && !(act?.pin && act.id === m.line.id)) onAct({ id: m.line.id, pin: true })
        else if (on || !m) onAct(null)
      }}
      onFocus={(e) => {
        // a keyboard focus opens the biggest gap's card, so the strip says what it holds at once
        if (!inside(e)) return
        let keyed = false
        try {
          keyed = e.currentTarget.matches(':focus-visible')
        } catch {
          keyed = false
        }
        if (keyed && !on && placed.marks.length) onAct({ id: placed.marks[placed.marks.length - 1].line.id, pin: false })
      }}
      onKeyDown={(e) => {
        if (!inside(e)) return
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1)
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1)
        else if (e.key === 'Home') onAct({ id: placed.marks[0]?.line.id ?? '', pin: !!act?.pin })
        else if (e.key === 'End') onAct({ id: placed.marks[placed.marks.length - 1]?.line.id ?? '', pin: !!act?.pin })
        else if ((e.key === 'Enter' || e.key === ' ') && on) onAct({ id: on.line.id, pin: !act?.pin })
        else return
        e.preventDefault()
      }}
      onBlur={(e) => {
        if (!inside(e)) return
        const to = e.relatedTarget as Element | null
        if (on && !act?.pin && !to?.closest?.('.ic-mc')) onAct(null)
      }}
    >
      {width > 0 && <span className="med" style={{ left: placed.median }} aria-hidden="true" />}
      {width > 0 &&
        placed.marks.map(({ line, x, y }) => {
          const n = stage.get(line.id)
          const cls = `${line.id === act?.id ? ' on' : ''}${kin && kinOf(line) === kin && line.id !== act?.id ? ' kin' : ''}`
          return (
            <span
              key={line.id}
              className={`m ${n ? 'n' : shapeOf(line)}${cls}`}
              style={{ left: x, top: y, zIndex: n ? 5 - n : undefined }}
              aria-hidden="true"
            >
              {n}
            </span>
          )
        })}
      {on && ref.current && (
        <MarkCard
          line={on.line}
          field={ref.current}
          x={on.x}
          y={on.y}
          pinned={pinned}
          sheet={phone}
          onClose={() => {
            onAct(null)
            ref.current?.focus({ preventScroll: true })
          }}
          onSee={() => onSee(on.line)}
        />
      )}
    </div>
  )
}

/** A mark's shape says where the line stands, never its colour alone: ○ to come, ◉ playing,
 *  ● we won, ◆ the book won, ⊙ level. */
function shapeOf(l: Line): string {
  if (l.game.status === 'final' && l.closer) return l.closer === 'ours' ? 'win' : l.closer === 'book' ? 'bk' : 'lv'
  if (l.game.status === 'final') return 'ring dim'
  return l.tipped ? 'play' : 'ring'
}

/** Where the game stands, for the card's sub line. */
function gameWhen(l: Line) {
  const g = l.game
  if (g.status === 'final')
    return (
      <>
        Final{' '}
        {g.away_score != null && g.home_score != null && <span className="num">{`${g.away_score}–${g.home_score}`}</span>}
      </>
    )
  if (g.status === 'live' || l.tipped)
    return (
      <>
        <span className="ic-live" aria-hidden="true" />
        Live
      </>
    )
  return (
    <>
      Tip <span className="num">{clock(g.tip)}</span>
    </>
  )
}

/** The card over a mark in How divided: Book, Ours, then the result (the gap before the game), the
 *  plain sentence and a footer well with the gap and who was closer. A preview follows the hover; a
 *  pinned card takes the pointer and has Close and See in game. On phones it is a bottom sheet. */
function MarkCard({
  line: l,
  field,
  x,
  y,
  pinned,
  sheet,
  onClose,
  onSee,
}: {
  line: Line
  field: HTMLElement
  x: number
  y: number
  pinned: boolean
  sheet: boolean
  onClose: () => void
  onSee: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; tip: number } | null>(null)
  useLayoutEffect(() => {
    if (sheet) return
    const place = () => {
      const card = ref.current
      if (!card) return
      const box = field.getBoundingClientRect()
      const ax = box.left + x
      const ay = box.top + y
      const w = card.offsetWidth
      const h = card.offsetHeight
      const vw = document.documentElement.clientWidth
      const left = Math.max(8, Math.min(vw - w - 8, ax - w / 2))
      const below = ay - h - 14 < 72
      const top = below ? ay + 14 : ay - h - 14
      setPos({ left, top, below, tip: Math.max(14, Math.min(w - 14, ax - left)) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [field, x, y, l.id, sheet, pinned])
  const final = settledOf(l)
  const say = plain(l, final)
  const what =
    l.stat === 'TEAM' ? `${l.team} points` : l.stat === 'WIN' ? `${STAT_NAME.WIN} · ${l.team}` : STAT_NAME[l.stat]
  const open = pinned || sheet
  const card = (
    <div
      ref={ref}
      className={`ic-mc${sheet ? ' sheet' : pos?.below ? ' below' : ''}${open ? ' pinned' : ''}`}
      role={open ? 'dialog' : 'status'}
      aria-label={open ? `${l.kind === 'player' ? l.name : l.gameLabel}, ${what}` : undefined}
      style={
        sheet
          ? undefined
          : ({
              left: pos?.left ?? -9999,
              top: pos?.top ?? 0,
              visibility: pos ? 'visible' : 'hidden',
              '--tip': `${pos?.tip ?? 0}px`,
            } as CSSProperties)
      }
    >
      {sheet && <span className="ic-mc-grab" aria-hidden="true" />}
      <div className="ic-mc-h">
        <Face line={l} />
        <div className="ic-mc-who">
          <b>{l.kind === 'player' ? l.name : l.gameLabel}</b>
          <span>
            {what}
            {l.kind === 'player' && <> · {l.gameLabel}</>} · {gameWhen(l)}
          </span>
        </div>
        {open && (
          <button type="button" className="ic-mc-x" aria-label="Close" onClick={onClose}>
            <XIcon />
          </button>
        )}
      </div>
      <div className="ic-mc-nums">
        <div>
          <span className="lab">Book</span>
          <span className="v bk">{value(l, 'book')}</span>
          <McHit line={l} side="book" />
          <Px line={l} />
        </div>
        <div>
          <span className="lab">Ours</span>
          <span className="v ou">{value(l, 'ours')}</span>
          <McHit line={l} side="ours" />
        </div>
        <div>
          <span className="lab">{final ? 'Result' : 'Gap'}</span>
          <span className="v">{final ? (resultValue(l) ?? '–') : signed(l.gap ?? 0, l.stat)}</span>
        </div>
      </div>
      {say && <p className="ic-mc-say">{cap(say)}.</p>}
      <div className={`ic-mc-well${final && l.closer === 'ours' ? ' ours' : ''}`}>
        <span>
          Gap <b className="num">{signed(l.gap ?? 0, l.stat)}</b>
        </span>
        {final ? (
          <Verdict line={l} />
        ) : l.tipped ? (
          <span className="sub">
            <span className="ic-live" aria-hidden="true" />
            Playing now
          </span>
        ) : (
          <span className="sub">Result after the game</span>
        )}
      </div>
      {open && (
        <button type="button" className="secondary ic-mc-see" onClick={onSee}>
          See in game
        </button>
      )}
    </div>
  )
  return createPortal(
    sheet ? (
      <>
        <div className="ic-mc-scrim" aria-hidden="true" onClick={onClose} />
        {card}
      </>
    ) : (
      card
    ),
    document.body,
  )
}

/** "✓ Over won" or "✗ Book lost" under the card's Book and Ours. */
function McHit({ line: l, side }: { line: Line; side: 'ours' | 'book' }) {
  const hit = side === 'ours' ? l.oursHit : l.bookHit
  if (hit == null || l.game.status !== 'final') return null
  return (
    <span className={`ic-mc-hit ${hit ? 'ok' : 'no'}`}>
      {hit ? <CheckIcon /> : <XIcon />}
      {callWord(l, side, hit)}
    </span>
  )
}

function swarm(lines: Line[], width: number) {
  const pad = 8
  const half = (width - pad * 2) / 2
  const pos = (v: number) => width / 2 + Math.max(-1, Math.min(1, v / FULL_AT)) * half
  const pts = lines.map((line) => ({ line, x: pos(line.score), lv: 0 })).sort((a, b) => a.x - b.x)
  const stack = (d: number) => {
    const done: typeof pts = []
    let max = 0
    for (const p of pts) {
      for (let k = 0; k < 60; k++) {
        const lv = k === 0 ? 0 : k % 2 ? (k + 1) / 2 : -k / 2
        if (!done.some((q) => q.lv === lv && Math.abs(q.x - p.x) < d)) {
          p.lv = lv
          break
        }
      }
      done.push(p)
      max = Math.max(max, Math.abs(p.lv))
    }
    return max
  }
  let dense = false
  let max = stack(12)
  if (max > 3) {
    dense = true // busy nights: smaller marks instead of a tall stack
    max = stack(8.5)
  }
  const step = dense ? 8 : 10.5
  const height = Math.max(30, (max * 2 + 1) * step + 10)
  return {
    dense,
    height,
    median: pos(median(lines.map((l) => l.score))),
    marks: pts.map((p) => ({ line: p.line, x: p.x, y: height / 2 + p.lv * step })),
  }
}

/** Market rows in the spec's order: Handicap, Total points, then Match result. Team totals are not a
 *  bet the engine makes, so they stay in Every line. */
const PICK_KINDS: [Stat, string][] = [
  ['MAR', 'Handicap'],
  ['TOT', 'Total points'],
  ['WIN', 'Match result'],
]

/** Game picks (The Slip Rail, Can 2026-11-23): one calm block per game on the bare page. Our score
 *  leads in solid numerals; then one row per iddaa game line with the bet, its odds and our chance,
 *  the same grammar as a Kupon leg. After the game: the final score over our call, each row Won or
 *  Lost. Club colour only as light around the logos. */
function GamePicks({ data, lines, onCard }: { data: BookCompare; lines: Line[]; onCard: (game: number) => void }) {
  const kupons = useKuponPicks(lines)
  const of = (g: CompareGame, s: Stat) => lines.find((l) => l.kind === 'game' && l.game.game_id === g.game_id && l.stat === s)
  const shown = data.games.filter((g) => PICK_KINDS.some(([s]) => of(g, s)))
  if (!shown.length) return null
  const n = picksNight(shown, lines)
  return (
    <section className="ic-gp" aria-labelledby="ic-h-picks">
      <div className="ic-gp-head">
        <h2 id="ic-h-picks">
          <Target size={22} aria-hidden="true" />
          Game picks
        </h2>
        <span className="ic-gp-sm">
          {n.settled > 0 ? (
            <>
              Won <b className="num">{n.won}</b> of <b className="num">{n.settled}</b> {n.settled === 1 ? 'bet' : 'bets'} ·{' '}
              <b className="num">{signedUnits(n.net)}</b> at 1 a bet
            </>
          ) : (
            <>
              <b className="num">{n.bets}</b> {n.bets === 1 ? 'bet' : 'bets'}
              {n.none > 0 && (
                <>
                  {' '}
                  · <b className="num">{n.none}</b> no bet
                </>
              )}
            </>
          )}
        </span>
      </div>
      <ol className="ic-gp-games">
        {shown.map((g) => (
          <PickGame key={g.game_id} g={g} lines={lines} of={of} kupons={kupons} onCard={onCard} />
        ))}
      </ol>
    </section>
  )
}

const signedUnits = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v < 0 ? `−${Math.abs(v).toFixed(2)}` : '0.00')

/** A club logo on a disc, lit by the club's colour. */
function GpDisc({ team }: { team: string }) {
  return (
    <span className="ic-gp-disc" style={{ '--tc': teamLight(team) ?? 'transparent' } as CSSProperties}>
      <TeamLogo abbrev={team} size={40} fallback />
    </span>
  )
}

function PickGame({
  g,
  lines,
  of,
  kupons,
  onCard,
}: {
  g: CompareGame
  lines: Line[]
  of: (g: CompareGame, s: Stat) => Line | undefined
  kupons: Map<string, string[]>
  onCard: (game: number) => void
}) {
  const call = gameCall(g, lines)
  const final = g.status === 'final' && g.away_score != null && g.home_score != null
  const live = !final && (g.status === 'live' || new Date(g.tip) <= new Date())
  const r = (v: number) => Math.round(v)
  // whole numbers; one decimal when rounding would tie or flip our pick
  const shows = (v: number, other: number) => (r(v) === r(other) ? v.toFixed(1) : String(r(v)))
  const called =
    final && call ? Math.sign(call.home - call.away) === Math.sign((g.home_score ?? 0) - (g.away_score ?? 0)) : null
  const pct = call?.chance != null ? Math.round(call.chance * 100) : null
  const say = call
    ? final
      ? `Final: ${g.away} ${g.away_score}, ${g.home} ${g.home_score}. Our call was ${shows(call.away, call.home)} to ${shows(call.home, call.away)}.`
      : `Our score: ${g.away} ${shows(call.away, call.home)}, ${g.home} ${shows(call.home, call.away)}.${pct != null ? ` We give ${call.pick} a ${pct}% chance to win.` : ''}`
    : final
      ? `Final: ${g.away} ${g.away_score}, ${g.home} ${g.home_score}.`
      : ''
  const score = (away: string, home: string) => (
    <b className="num">
      <small>{g.away}</small> {away}
      <i>–</i>
      {home} <small>{g.home}</small>
    </b>
  )
  return (
    <li className={`ic-gp-game${final ? ' post' : ''}`}>
      <div className="ic-gp-gh">
        <span className="ic-gp-pair" aria-hidden="true">
          <GpDisc team={g.away} />
          <GpDisc team={g.home} />
        </span>
        <span className="ic-gp-gn">
          <b>{`${g.away} @ ${g.home}`}</b>
          <span>
            {final ? (
              'Final'
            ) : live ? (
              <>
                <span className="ic-live" aria-hidden="true" />
                Live
              </>
            ) : (
              <>
                <Clock size={14} aria-hidden="true" />
                Tip <span className="num">{clock(g.tip)}</span>
              </>
            )}
          </span>
        </span>
        {say && <span className="sr-only">{say}</span>}
        {(final || call) && (
          <span className="ic-gp-sc" aria-hidden="true">
            <span className="lab">{final ? 'Final' : 'Our score'}</span>
            {final ? score(String(g.away_score), String(g.home_score)) : score(shows(call!.away, call!.home), shows(call!.home, call!.away))}
            {final ? (
              call && (
                <span className="sub">
                  {called ? (
                    <Check className="ok" size={12} weight="bold" aria-hidden="true" />
                  ) : (
                    <X className="no" size={12} weight="bold" aria-hidden="true" />
                  )}
                  Our call{' '}
                  <span className="num">
                    {shows(call.away, call.home)}–{shows(call.home, call.away)}
                  </span>
                </span>
              )
            ) : (
              <span className="sub">
                {call!.pick} by <span className="num">{num(r(call!.margin))}</span> · Total{' '}
                <span className="num">{num(r(call!.total))}</span>
              </span>
            )}
          </span>
        )}
      </div>
      <ul className="ic-gp-rows" aria-label={`${g.away} @ ${g.home} bets`}>
        {PICK_KINDS.map(([s, kind]) => {
          const l = of(g, s)
          return l ? <PickRow key={kind} line={l} kind={kind} kupons={kupons.get(kuponKey(l)) ?? []} /> : null
        })}
      </ul>
      {(g.estimates?.length ?? 0) > 0 && (
        <button
          type="button"
          className="ic-gp-more"
          aria-haspopup="dialog"
          aria-label={`${g.away} at ${g.home}: player estimates`}
          onClick={() => onCard(g.game_id)}
        >
          Player estimates
          <CaretRight size={14} weight="bold" aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

/** One market: the label, the bet (with the Kupon tag when a slip carries it), Book and Ours under it,
 *  then the odds and our chance. A line with no bet keeps our number and says why. */
function PickRow({ line: l, kind, kupons }: { line: Line; kind: string; kupons: string[] }) {
  const b = l.barem
  const { book, ours } = marketPair(l)
  if (!b) {
    const why =
      l.ours == null
        ? 'No line yet'
        : l.stat === 'WIN' && l.team
          ? `${l.team} odds ${MIN_ODD.toFixed(2)} or less`
          : `Odds ${MIN_ODD.toFixed(2)} or less`
    return (
      <li className="ic-gp-row none">
        <span className="ml">{kind}</span>
        <span className="mb">
          {l.stat === 'WIN' && l.team && <b className="bt">{`${l.team} to win`}</b>}
          {(ours || book) && (
            <span className="bo">
              {l.stat !== 'WIN' && book && (
                <>
                  Book <b className="num">{book}</b> ·{' '}
                </>
              )}
              {ours && (
                <>
                  Ours <b className="num">{ours}</b>
                </>
              )}
            </span>
          )}
        </span>
        <span className="nb">
          <Prohibit size={16} aria-hidden="true" />
          <span>
            <b>No bet</b>
            <span>{why}</span>
          </span>
        </span>
      </li>
    )
  }
  const done = l.game.status === 'final' && l.oursHit != null
  const got = gotLine(l)
  const why = lostWhy(l)
  return (
    <li className={`ic-gp-row${done ? (l.oursHit ? ' won' : ' lost') : ''}`}>
      <span className="ml">{kind}</span>
      <span className="mb">
        <b className={`bt${l.stat === 'WIN' ? '' : ' num'}`}>{b.label}</b>
        <KuponTag kupons={kupons} />
        <span className="bo">
          {done && got ? (
            <>{got} · </>
          ) : (
            book && (
              <>
                Book <b className="num">{book}</b> ·{' '}
              </>
            )
          )}
          {ours && (
            <>
              Ours <b className="num">{ours}</b>
            </>
          )}
        </span>
      </span>
      <span className="od">
        <b className="num">{b.odd != null ? odds(b.odd) : '–'}</b>
        <span>odds</span>
      </span>
      {done ? (
        <span className={`rs ${l.oursHit ? 'ok' : 'no'}`}>
          {l.oursHit ? <Check size={12} weight="bold" aria-hidden="true" /> : <X size={12} weight="bold" aria-hidden="true" />}
          {l.oursHit ? 'Won' : 'Lost'}
        </span>
      ) : b.sure != null ? (
        <Chance value={b.sure} />
      ) : (
        <span />
      )}
      {why && <span className="why">{why}</span>}
    </li>
  )
}

function GameBoxes({ data, lines, settled }: { data: BookCompare; lines: Line[]; settled: boolean }) {
  const phone = usePhone()
  return (
    <section className="ic-sec" aria-labelledby="ic-h-games">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-games">Game by game</h2>
          <p className="ic-sub">Winner, margin, total and team points for each game, with that game's player lines.</p>
        </div>
      </div>
      <div className="ic-gboxes">
        {[...data.games]
          .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.tip.localeCompare(b.tip))
          .map((g) => {
            const ls = lines.filter((l) => l.game.game_id === g.game_id)
            const get = (s: Stat, team?: string) => ls.find((l) => l.stat === s && (!team || l.team === team))
            const rows: [string, Line | undefined][] = [
              ['Winner', get('WIN')],
              ['Margin', get('MAR')],
              ['Total', get('TOT')],
              [`${g.away} pts`, get('TEAM', g.away)],
              [`${g.home} pts`, get('TEAM', g.home)],
            ]
            const final = g.status === 'final'
            const pl = tallyOf(ls.filter((l) => l.kind === 'player'))
            return (
              <div className={`ic-gbox${!settled && g.status !== 'scheduled' ? ' tipped' : ''}`} key={g.game_id}>
                <div className="ic-gb-h">
                  <Pair away={g.away} home={g.home} size={26} />
                  <span className="t">
                    {final ? (
                      <>
                        {g.away} <span className="num">{g.away_score}</span> @ {g.home}{' '}
                        <span className="num">{g.home_score}</span>
                      </>
                    ) : (
                      `${g.away} @ ${g.home}`
                    )}
                  </span>
                  <span className="meta2">
                    {final ? (
                      'Final'
                    ) : (
                      <>
                        Tip <span className="num">{clock(g.tip)}</span>
                        <br />
                        read <span className="num">{clock(g.checked)}</span>
                      </>
                    )}
                  </span>
                </div>
                {gameStory(ls, final) && <p className="ic-gb-say">{gameStory(ls, final)}</p>}
                <details className="ic-gt-fold" open={!phone}>
                  <summary>
                    Winner, margin, total and team points
                    <Chevron />
                  </summary>
                  <table className="ic-gt">
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="sr-only">Market</span>
                        </th>
                        <th scope="col">Book</th>
                        <th scope="col">Ours</th>
                        {final ? (
                          <>
                            <th scope="col">Result</th>
                            <th scope="col">Won</th>
                          </>
                        ) : (
                          <th scope="col" className="hide-xs">
                            Gap
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([label, l]) => (
                        <tr key={label}>
                          <td>
                            {label.endsWith(' pts') && <TeamLogo abbrev={label.slice(0, -4)} size={16} />} {label}
                          </td>
                          <td>
                            {l && <Hit line={l} side="book" />}
                            <span className="num">{l ? value(l, 'book') : '–'}</span>
                            {l?.price && (
                              <small className="ic-gt-px">
                                {l.price.label === l.team ? 'at' : `${l.price.label} ·`}{' '}
                              <span className="num">{odds(l.price.odd)}</span>
                              </small>
                            )}
                          </td>
                          <td className="o">
                            {l && <Hit line={l} side="ours" />}
                            <span className="num">{l ? value(l, 'ours') : '–'}</span>
                          </td>
                          {final ? (
                            <>
                              <td>
                                <span className="num">{l ? resultValue(l) : ''}</span>
                              </td>
                              <td className="cl">{l && <CloserCell line={l} />}</td>
                            </>
                          ) : (
                            <td className="hide-xs">
                              <span className="num">{l && l.gap != null ? signed(l.gap, l.stat) : ''}</span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                <div className="ic-gb-f">
                  {final ? (
                    <>
                      <span>
                        We won <b className="g">{pl.oursCloser}</b> of <b>{pl.judged}</b> player lines · Book won{' '}
                        <b>{pl.bookCloser}</b>
                      </span>
                    </>
                  ) : (
                    <span>
                      Player lines <b>{pl.n}</b> · Ours above <b>{pl.above}</b>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </section>
  )
}

/** Who was nearer in a game table, in words: "Ours · 6pp", "Book · 2" or "Level". */
function CloserCell({ line: l }: { line: Line }) {
  if (!l.closer) return null
  if (l.closer === 'tie') return <span className="ic-cl tie">Level</span>
  const by = l.by == null ? null : l.stat === 'WIN' ? `${Math.round(l.by * 100)}pp` : num(l.by)
  return (
    <span className={`ic-cl ${l.closer}`}>
      {l.closer === 'ours' ? 'Ours' : 'Book'}
      {by && (
        <span className="by">
          {' '}
          · <span className="num">{by}</span>
        </span>
      )}
    </span>
  )
}

function Empty({ data, onDay }: { data: BookCompare; onDay: (d: number) => void }) {
  const nearest = data.days.filter((d) => d !== data.day).slice(-1)[0]
  return (
    <div className="ic-empty">
      <div className="inner">
        <h2>{data.day == null ? 'No sportsbook lines saved yet' : "The sportsbook wasn't saved before this night's games"}</h2>
        <p>
          Lines are read at the last look before each tip-off.
          {data.look.ok === false && ` The last read failed: ${data.look.error ?? 'no answer'}.`}
        </p>
        {nearest != null && (
          <button type="button" className="secondary" onClick={() => onDay(nearest)}>
            Go to the nearest night with lines
          </button>
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="ic-sheet" aria-busy="true">
      <span className="sr-only">Loading the night</span>
      <section className="ic-sec">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="ic-sk-row" key={i}>
            <span className="ic-sk" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            <div>
              <div className="ic-sk" style={{ width: '60%', height: 12 }} />
              <div className="ic-sk" style={{ width: '36%', height: 10, marginTop: 8 }} />
            </div>
            <div className="ic-sk-lane">
              <span className="ic-sk" style={{ width: 44, height: 22 }} />
              <span className="ic-sk" style={{ width: 60, height: 28 }} />
              <span className="ic-sk" style={{ width: 52, height: 22 }} />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 8.6 6.4 11.6 12.8 4.6" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.2 4.2 11.8 11.8" />
      <path d="M11.8 4.2 4.2 11.8" />
    </svg>
  )
}

function Caret() {
  return (
    <svg className="caret" viewBox="0 0 7 10" aria-hidden="true">
      <path d="M6.2 1 1 5l5.2 4z" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg className="ic-i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
