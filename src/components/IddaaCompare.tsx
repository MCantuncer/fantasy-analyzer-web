import { useQuery } from '@tanstack/react-query'
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
  plain,
  ranked,
  signed,
  tallyOf,
} from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, Line, Stat, Tally } from '../lib/iddaaCompare'
import { useEscapeLayer } from '../lib/escapeStack'
import { usePlayerCard } from '../lib/playerCard'
import { PlayerHead, TeamLogo } from './PlayerHead'
import './IddaaCompare.css'

interface Props {
  onBack: () => void
  /** Admins: a way over to Site health. */
  onHealth?: () => void
}

const PAGE = 12

/** "Seambook": the sportsbook's lines (iddaa, read through nesine) beside ours, night by night, the biggest gaps above the book
 *  first, and once the games are final each side judged against what happened. Comparison only:
 *  the book never feeds our model. */
export function IddaaCompare({ onBack, onHealth }: Props) {
  const [day, setDay] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['book-compare', day],
    queryFn: () => fetchBookCompare(day),
    refetchInterval: (query) => (isTonight(query.state.data) ? 5 * 60_000 : false),
  })
  const data = q.data
  return (
    <div className="ic stack">
      <div className="ic-head">
        <div>
          <h1 className="page-title">Our Estimates</h1>
          <p className="ic-note">
            The sportsbook's lines at the last look before each tip-off, set against ours.{' '}
            <span className="ic-hide-s">For comparison only: the sportsbook never feeds our model.</span>
          </p>
        </div>
        <div className="ic-head-btns">
          {onHealth && (
            <button type="button" className="secondary" onClick={onHealth}>
              Site health
            </button>
          )}
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
      {q.isPending && <Skeleton />}
      {q.error && (
        <section className="card error stack" role="alert">
          <p>{q.error instanceof Error ? q.error.message : "Couldn't load the comparison."}</p>
        </section>
      )}
      {data && <Night data={data} onDay={setDay} key={data.day ?? 0} />}
    </div>
  )
}

/** The way in from My leagues: tonight's biggest gap above the book, or last night's tally once
 *  it is settled, on a card that opens the page. */
export function EstimatesTeaser({ onOpen }: { onOpen: () => void }) {
  const q = useQuery({ queryKey: ['book-compare', null], queryFn: () => fetchBookCompare(null), retry: false })
  const data = q.data
  const lines = useMemo(() => (data ? linesOf(data, new Date()) : []), [data])
  const settled = !!data && data.games.length > 0 && data.games.every((g) => g.status === 'final')
  const top = ranked(lines.filter((l) => !l.tipped || settled), true).above[0]
  const t = tallyOf(lines)
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
          ? `${nightLabel(data.date)}: within band, Ours ${t.ours}/${t.judged} · Book ${t.book}/${t.judged}`
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
  const first = useRef(true)
  useEffect(() => {
    if (first.current) first.current = false
    else setMotion(true) // the bands tug and the marks draw on a change, never on load
  }, [group, stat, game])

  const lines = useMemo(() => linesOf(data, new Date()), [data])
  const settled = data.games.length > 0 && data.games.every((g) => g.status === 'final')
  const latest = data.days[data.days.length - 1]

  return (
    <>
      <NightTabs data={data} onDay={onDay} latest={latest} settled={settled} />
      <div className={`ic-sheet${motion ? ' motion' : ''}`}>
        {data.games.length === 0 ? (
          <Empty data={data} onDay={onDay} />
        ) : (
          <>
            <NightCard
              data={data}
              lines={lines}
              settled={settled}
              game={game}
              onGame={(g) => {
                setGame(g)
                setOpen(null)
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
            <HowDivided lines={lines} settled={settled} group={group} game={game} />
            <GameBoxes data={data} lines={lines} settled={settled} />
            <p className="ic-bands">
              Bands: points ±{data.bands.pts}, rebounds and assists ±{data.bands.reb}, 3PM, steals and blocks ±
              {data.bands.stl}, team points ±{data.bands.team_pts}, game total ±{data.bands.total}, margin ±
              {data.bands.margin}. Winner: right when the pick won. Closer is level within 0.1. The book's lines have
              its margin removed. Last read of the sportsbook{' '}
              {data.look.checked ? (
                <>
                  at <span className="num">{clock(data.look.checked)}</span>{' '}
                  {data.look.ok === false ? `failed: ${data.look.error ?? ''}` : 'worked'}
                </>
              ) : (
                'not yet since the server started'
              )}
              .
            </p>
          </>
        )}
      </div>
    </>
  )
}

function NightTabs({
  data,
  onDay,
  latest,
  settled,
}: {
  data: BookCompare
  onDay: (d: number) => void
  latest: number | undefined
  settled: boolean
}) {
  const nights = [...data.nights].reverse()
  return (
    <div className="ic-nights" role="tablist" aria-label="Night">
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
            <span className="num">
              {live ? `${nightLabel(n.date).split(' ').slice(1).join(' ')} · ` : ''}
              {n.games} games
            </span>
          </button>
        )
      })}
    </div>
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
            {settled ? '' : 'So far: '}We were closer on <b className="g">{t.oursCloser}</b> of <b>{t.judged}</b> · Book{' '}
            <b>{t.bookCloser}</b> · Level <b>{t.level}</b>
          </span>
          <Split t={t} />
          <span className="ic-tl-band">
            Within band: Ours <b>{`${t.ours}/${t.judged}`}</b> · Book <b>{`${t.book}/${t.judged}`}</b>
          </span>
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
                    Closer: Ours <span className="num">{gt.oursCloser}</span>, Book{' '}
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
              We were closer on <b className="g">{t.oursCloser}</b> · Book <b>{t.bookCloser}</b> · Level{' '}
              <b>{t.level}</b>
            </span>
            <span className="ic-mm">
              {s === 'WIN' ? (
                <>
                  Our pick won <span className="num">{t.ours}</span> of <span className="num">{t.judged}</span>
                </>
              ) : (
                <>
                  Within band: Ours <span className="num">{`${t.ours}/${t.judged}`}</span> · Book{' '}
                  <span className="num">{`${t.book}/${t.judged}`}</span>
                </>
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
          <h2 id="ic-h-closer">Who was closer, stat by stat</h2>
          <p className="ic-sub">Each side judged against the actual result: within band when it lands close.</p>
        </div>
      </div>
      <div className="ic-t-group">Players</div>
      <ul className="ic-t-list">{PLAYER_STATS.map(row)}</ul>
      <div className="ic-t-group">Games</div>
      <ul className="ic-t-list">{GAME_STATS.map(row)}</ul>
      <p className="ic-t-note">
        Steals, blocks and 3PM bands (±1) are loose on lines near 1, so read those rows by who was closer.
      </p>
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
}

function GapList(p: ListProps) {
  const { lines, settled, group, stat, game } = p
  const stats = group === 'players' ? PLAYER_STATS : GAME_STATS
  const inGame = (l: Line) => game == null || l.game.game_id === game
  const pool = lines.filter((l) => stats.includes(l.stat) && inGame(l) && l.gap != null)
  const shown = pool.filter((l) => stat === 'ALL' || l.stat === stat)
  const { above, rest } = ranked(shown, stat === 'ALL')
  const limit = p.showAll ? Infinity : PAGE
  const count = (g: 'players' | 'games') =>
    lines.filter((l) => (g === 'players' ? l.kind === 'player' : l.kind === 'game') && inGame(l) && l.gap != null)
      .length
  const hidden = Math.max(0, above.length - limit)
  const most = rest[0]
  return (
    <section className="ic-sec" aria-labelledby="ic-h-list">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-list">Biggest gaps above the book</h2>
          <p className="ic-sub">
            Gap = Ours − Book. Largest first.
            {settled && ' Each line is judged against the result: ✓ when it lands within the band.'}
          </p>
        </div>
      </div>
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
      <ColHead />
      {above.length === 0 ? (
        <p className="ic-none">
          No line had Ours above the book{stat === 'ALL' ? '' : ` in ${STAT_NAME[stat]}`}.{' '}
          {most && most.book != null && most.ours != null && (
            <>
              Biggest the other way: <b>{`${most.kind === 'player' ? most.name : most.gameLabel} ${STAT_NAME[most.stat]}`}</b>,
              Book {value(most, 'book')} vs Ours {value(most, 'ours')}.
            </>
          )}
        </p>
      ) : (
        <ol className={`ic-rows${p.open ? ' has-open' : ''}`}>
          {above.slice(0, limit).map((l, i) => (
            <Row key={l.id} line={l} i={i} rank={i + 1} settled={settled} open={p.open === l.id} onOpen={p.onOpen} />
          ))}
        </ol>
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
            {rest.slice(0, p.showAll ? undefined : PAGE).map((l, i) => (
              <Row key={l.id} line={l} i={i} rank={0} settled={settled} open={p.open === l.id} onOpen={p.onOpen} />
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
      {judged && (
        <span>
          <span className="ic-key-ok">
            <CheckIcon />
          </span>
          within band
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

function Row({
  line: l,
  i,
  rank,
  settled,
  open,
  onOpen,
}: {
  line: Line
  i: number
  rank: number
  settled: boolean
  open: boolean
  onOpen: (id: string) => void
}) {
  return (
    <li className={`ic-row${open ? ' is-open' : ''}`}>
      <button type="button" className="ic-row-main ic-grid" aria-expanded={open} onClick={() => onOpen(l.id)}>
        <span className="ic-rk">{rank || ''}</span>
        <Face line={l} />
        <Who line={l} />
        <Lane line={l} i={i} />
        <ResultSlot line={l} />
      </button>
      {open && <RowOpen line={l} settled={settled} />}
    </li>
  )
}

/** Where the result lands: a quiet well until tip-off, "Playing" during the game, then the result
 *  and who was nearer. A soft green light marks the slot (never the row) when we were closer. */
function ResultSlot({ line: l }: { line: Line }) {
  const g = l.game
  if (g.status === 'final') {
    const by = l.by == null || l.closer === 'tie' ? null : l.stat === 'WIN' ? `${Math.round(l.by * 100)}pp` : num(l.by)
    return (
      <div className={`ic-slot fin${l.closer === 'ours' ? ' ours' : ''}`}>
        <span className="ic-slot-res">
          <span className="lab">Result</span>
          <b>{resultValue(l) ?? '–'}</b>
        </span>
        {l.closer && (
          <span className={`ic-slot-vd ${l.closer}`}>
            <b>{l.closer === 'ours' ? 'We were closer' : l.closer === 'book' ? 'Book was closer' : 'Level with the book'}</b>
            {by && (
              <span>
                by <span className="num">{by}</span>
              </span>
            )}
          </span>
        )}
      </div>
    )
  }
  if (l.tipped)
    return (
      <div className="ic-slot live">
        <span className="ic-live" aria-hidden="true" />
        Playing
        <span className="sub">
          kept at <span className="num">{clock(g.checked)}</span>
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

/** ✓ or ✗ beside a number: did it land within its band of the result. Nothing else. */
function Hit({ line: l, side }: { line: Line; side: 'ours' | 'book' }) {
  const ok = side === 'ours' ? l.oursHit : l.bookHit
  if (ok == null || l.game.status !== 'final') return null
  const who = side === 'ours' ? 'Ours' : 'Book'
  const v = l[side]
  const label =
    l.stat === 'WIN'
      ? `${who} ${ok ? 'right' : 'wrong'}`
      : ok
        ? `${who} within band`
        : `${who} outside the band${v != null && l.actual != null ? `, off by ${num(Math.abs(l.actual - v))}` : ''}`
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
        <div className="ic-sub">
          <b>{STAT_NAME[l.stat]}</b> · {plain(l, settledOf(l))}
        </div>
      </div>
    )
  }
  return (
    <div className="ic-who">
      <div className="ic-nm">
        {l.gameLabel} <span className="ic-nm-st">{l.stat === 'TEAM' ? `${l.team} points` : STAT_NAME[l.stat]}</span>
      </div>
      <div className="ic-sub">{cap(plain(l, settledOf(l)))}</div>
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
  return (
    <div className="ic-lane">
      <div className="l">
        <Hit line={l} side="book" />
        <span className="ic-v ic-v-i">{value(l, 'book')}</span>
        {gap < 0 && <span className={`ic-band bl${clamp}`} style={style} />}
      </div>
      <span className={`ic-pill${gap === 0 ? ' zero' : ''}`}>{signed(gap, l.stat)}</span>
      <div className="r">
        {gap > 0 && <span className={`ic-band br${clamp}`} style={style} />}
        <span className="ic-v ic-v-o">
          {value(l, 'ours')}
          <Caret />
        </span>
        <Hit line={l} side="ours" />
      </div>
    </div>
  )
}

function Mark({ line: l, side, i }: { line: Line; side: 'ours' | 'book'; i: number }) {
  const ok = side === 'ours' ? l.oursHit : l.bookHit
  if (ok == null) return <span className="ic-mk none" aria-label="No result" />
  const who = side === 'ours' ? 'Ours' : 'Book'
  const v = side === 'ours' ? l.ours : l.book
  const label =
    l.stat === 'WIN'
      ? `${who} ${ok ? 'right' : 'wrong'}`
      : `${who} ${ok ? 'within' : 'outside'} ${num(l.band)}, off by ${v != null && l.actual != null ? num(Math.abs(l.actual - v)) : '?'}`
  return (
    <span
      className={`ic-mk ${side === 'ours' ? 'o' : 'd'} ${ok ? 'ok' : 'no'}`}
      role="img"
      aria-label={label}
      style={{ '--i': i } as CSSProperties}
    >
      {ok ? <CheckIcon /> : <XIcon />}
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
  const label = `Result ${num(l.actual)}. Band ${num(l.actual - band)} to ${num(l.actual + band)}. Ours ${num(l.ours)} ${
    l.oursHit ? 'inside' : 'outside'
  }, book ${num(l.book)} ${l.bookHit ? 'inside' : 'outside'}.`
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
              {l.closer === 'tie' ? 'Level' : <b>{l.closer === 'ours' ? 'Ours' : 'Book'} was closer</b>}
              {l.by != null && l.closer !== 'tie' ? `, by ${num(l.by)}` : ''}. Off by {offO} (Ours) and {offB} (Book). A
              line counts when it lands within ±{num(l.band)} {unit} of the result.
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
        {l.ladder.length > 0 && l.book != null && (
          <>
            <div className="ic-ladder-cap">
              The book's N+ ladder with its margin removed. It crosses 50% at {l.book.toFixed(1)}, its line.
            </div>
            <div className="ic-ladder" aria-label="The book's ladder">
              {l.ladder.map(([n, chance]) => (
                <LadderRow key={n} n={n} chance={chance} />
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

function LadderRow({ n, chance }: { n: number; chance: number }) {
  return (
    <>
      <span className="n">{n}+</span>
      <span className="bar">
        <span style={{ width: `${(chance * 100).toFixed(1)}%` }} />
      </span>
      <span className="p">{Math.round(chance * 100)}%</span>
    </>
  )
}

function HowDivided({
  lines,
  settled,
  group,
  game,
}: {
  lines: Line[]
  settled: boolean
  group: 'players' | 'games'
  game: number | null
}) {
  const stats = group === 'players' ? PLAYER_STATS : GAME_STATS
  return (
    <section className="ic-sec" aria-labelledby="ic-h-field">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-field">How divided</h2>
          <p className="ic-sub">
            Every line is one mark at its gap, measured in bands (the edges are 0.6 of a band, the same scale as the row
            bands). <span className="ic-hover-hint">Hover a mark to see whose line it is.</span>
            <span className="ic-tap-hint">Tap a mark to see whose line it is.</span>
          </p>
        </div>
        <div className="ic-legend">
          {settled ? (
            <>
              <span className="ok">
                <CheckIcon />
                Ours within band
              </span>
              <span className="no">
                <XIcon />
                Ours outside
              </span>
            </>
          ) : (
            <span>
              <span className="ring" />
              One line
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
        <span className="notes-h">{settled ? 'Within band' : 'Ours above'}</span>
      </div>
      {stats.map((s) => {
        const ls = lines.filter((l) => l.stat === s && l.gap != null && (game == null || l.game.game_id === game))
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
            <Field lines={ls} stat={s} />
            <div className="notes">
              {settled && t.judged ? (
                <>
                  Ours <b>{`${t.ours}/${t.judged}`}</b> · Book <b>{`${t.book}/${t.judged}`}</b>
                  <br />
                  median gap {signed(med, s)}
                </>
              ) : (
                <>
                  <b>{t.above}</b> of {t.n} above · median {signed(med, s)}
                  <br />
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

/** One stat's lines as marks along the seam (a beeswarm). Hover a mark (tap on phones, or focus the
 *  strip and step with the arrow keys) and a card says whose line it is: the name, our number, the
 *  book's and, once the game is final, what happened. */
function Field({ lines, stat }: { lines: Line[]; stat: Stat }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<string | null>(null)
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
  const on = placed.marks.find((m) => m.line.id === active) ?? null
  useEscapeLayer(on != null, () => setActive(null))
  useEffect(() => {
    if (!on) return
    // a tap anywhere else puts the card away
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [on])

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
    const i = ms.findIndex((m) => m.line.id === active)
    const next = i < 0 ? (by > 0 ? 0 : ms.length - 1) : Math.max(0, Math.min(ms.length - 1, i + by))
    setActive(ms[next].line.id)
  }

  return (
    <div
      ref={ref}
      className={`ic-fld${placed.dense ? ' dense' : ''}${on ? ' has-on' : ''}`}
      style={{ height: placed.height }}
      tabIndex={0}
      role="group"
      aria-label={`${STAT_NAME[stat]}: ${lines.length} lines. Use the arrow keys to step through them.`}
      onPointerDown={(e) => {
        pointer.current = e.pointerType
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        setActive(near(e, 14)?.line.id ?? null)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setActive(null)
      }}
      onClick={(e) => {
        if (pointer.current === 'mouse') return
        const m = near(e, 24) // a finger is wider than a mark
        setActive((a) => (m && m.line.id !== a ? m.line.id : null))
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1)
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1)
        else if (e.key === 'Home') setActive(placed.marks[0]?.line.id ?? null)
        else if (e.key === 'End') setActive(placed.marks[placed.marks.length - 1]?.line.id ?? null)
        else return
        e.preventDefault()
      }}
      onBlur={() => setActive(null)}
    >
      {width > 0 && <span className="med" style={{ left: placed.median }} aria-hidden="true" />}
      {width > 0 &&
        placed.marks.map(({ line, x, y }) => {
          const cls = line.id === active ? ' on' : ''
          return line.oursHit != null ? (
            <span
              key={line.id}
              className={`m ${line.oursHit ? 'ok' : 'no'}${cls}`}
              style={{ left: x, top: y }}
              aria-hidden="true"
            >
              {line.oursHit ? <CheckIcon /> : <XIcon />}
            </span>
          ) : (
            <span
              key={line.id}
              className={`m ring${line.tipped ? ' dim' : ''}${cls}`}
              style={{ left: x, top: y }}
              aria-hidden="true"
            />
          )
        })}
      {on && ref.current && <MarkCard line={on.line} field={ref.current} x={on.x} y={on.y} />}
    </div>
  )
}

/** The card over a mark in How divided. Drawn in a portal so the section's edges never clip it,
 *  placed above the mark (below when there is no room) and kept on screen. */
function MarkCard({ line: l, field, x, y }: { line: Line; field: HTMLElement; x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; tip: number } | null>(null)
  useLayoutEffect(() => {
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
      const below = ay - h - 14 < 8
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
  }, [field, x, y, l.id])
  const final = settledOf(l)
  const say = plain(l, final)
  const what =
    l.stat === 'TEAM' ? `${l.team} points` : l.stat === 'WIN' ? `${STAT_NAME.WIN} · ${l.team}` : STAT_NAME[l.stat]
  const verdict = (side: 'ours' | 'book') => {
    const hit = side === 'ours' ? l.oursHit : l.bookHit
    if (hit == null) return null
    const v = l[side]
    const off = l.stat !== 'WIN' && v != null && l.actual != null ? num(Math.abs(l.actual - v)) : null
    return (
      <span className={`ic-mc-hit ${hit ? 'ok' : 'no'}`}>
        {hit ? <CheckIcon /> : <XIcon />}
        {l.stat === 'WIN' ? (hit ? 'right' : 'wrong') : hit ? 'in band' : `off ${off}`}
      </span>
    )
  }
  return createPortal(
    <div
      ref={ref}
      className={`ic-mc${pos?.below ? ' below' : ''}${l.closer === 'ours' && final ? ' ours-closer' : ''}`}
      role="status"
      style={
        {
          left: pos?.left ?? -9999,
          top: pos?.top ?? 0,
          visibility: pos ? 'visible' : 'hidden',
          '--tip': `${pos?.tip ?? 0}px`,
        } as CSSProperties
      }
    >
      <div className="ic-mc-h">
        <Face line={l} />
        <div className="ic-mc-who">
          <b>{l.kind === 'player' ? l.name : l.gameLabel}</b>
          <span>
            {what}
            {l.kind === 'player' && <> · {l.gameLabel}</>}
          </span>
        </div>
      </div>
      <div className={`ic-mc-nums${final && l.actual != null ? ' three' : ''}`}>
        <div>
          <span className="lab">Ours</span>
          <span className="v">{value(l, 'ours')}</span>
          {verdict('ours')}
        </div>
        <div>
          <span className="lab">Book</span>
          <span className="v">{value(l, 'book')}</span>
          {verdict('book')}
        </div>
        <div>
          <span className="lab">{final ? 'Result' : 'Gap'}</span>
          <span className="v">{final ? (resultValue(l) ?? '–') : signed(l.gap ?? 0, l.stat)}</span>
        </div>
      </div>
      {say && <p className="ic-mc-say">{cap(say)}.</p>}
    </div>,
    document.body,
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

function GameBoxes({ data, lines, settled }: { data: BookCompare; lines: Line[]; settled: boolean }) {
  return (
    <section className="ic-sec" aria-labelledby="ic-h-games">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-games">Game by game</h2>
          <p className="ic-sub">Winner, margin, total and team points for each game, with that game's player lines.</p>
        </div>
      </div>
      <div className="ic-gboxes">
        {data.games.map((g) => {
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
                        <th scope="col">Ours</th>
                        <th scope="col">Book</th>
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
                        <span className="num">{l ? value(l, 'book') : '–'}</span>
                      </td>
                      <td className="o">
                        <span className="num">{l ? value(l, 'ours') : '–'}</span>
                      </td>
                      {final ? (
                        <>
                          <td>
                            <span className="num">{l ? resultValue(l) : ''}</span>
                          </td>
                          <td className="mkc">{l && <Mark line={l} side="ours" i={0} />}</td>
                          <td className="mkc">{l && <Mark line={l} side="book" i={0} />}</td>
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
              <div className="ic-gb-f">
                {final ? (
                  <>
                    <span>
                      Player lines: Ours <b>{`${pl.ours}/${pl.judged}`}</b> · Book <b>{`${pl.book}/${pl.judged}`}</b>
                    </span>
                    <span>
                      Closer: Ours <b>{pl.oursCloser}</b>, Book <b>{pl.bookCloser}</b>
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
