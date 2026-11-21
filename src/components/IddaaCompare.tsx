import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { fetchBookCompare } from '../api/client'
import {
  FULL_AT,
  GAME_STATS,
  PLAYER_STATS,
  STAT_NAME,
  STAT_UNIT,
  clock,
  linesOf,
  median,
  nightLabel,
  nightTab,
  num,
  ranked,
  signed,
  tallyOf,
} from '../lib/iddaaCompare'
import type { BookCompare, Line, Stat } from '../lib/iddaaCompare'
import './IddaaCompare.css'

interface Props {
  onBack: () => void
  onHealth: () => void
}

const PAGE = 12

/** Admins only: "Seambook". iddaa's lines beside ours, night by night, the biggest gaps above iddaa
 *  first, and once the games are final each side judged against what happened. Comparison only:
 *  iddaa never feeds our model. */
export function IddaaCompare({ onBack, onHealth }: Props) {
  const [day, setDay] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['admin-book-compare', day],
    queryFn: () => fetchBookCompare(day),
    refetchInterval: (query) => (isTonight(query.state.data) ? 5 * 60_000 : false),
  })
  const data = q.data
  return (
    <div className="ic stack">
      <div className="ic-head">
        <div>
          <h1 className="page-title">iddaa vs Ours</h1>
          <p className="ic-note">
            iddaa's lines at the last look before each tip-off, set against ours.{' '}
            <span className="ic-hide-s">For comparison only: iddaa never feeds our model.</span>
          </p>
        </div>
        <div className="ic-head-btns">
          <button type="button" className="secondary" onClick={onHealth}>
            Site health
          </button>
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
            <Status data={data} lines={lines} settled={settled} />
            {settled && <NightTally lines={lines} />}
            <GapList
              lines={lines}
              data={data}
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
              onGame={(g) => {
                setGame(g)
                setOpen(null)
              }}
              onShowAll={() => setShowAll(true)}
              onFold={() => setFold((f) => !f)}
              onOpen={(id) => setOpen((o) => (o === id ? null : id))}
            />
            <HowDivided lines={lines} settled={settled} group={group} game={game} />
            <GameBoxes data={data} lines={lines} settled={settled} />
            <p className="ic-bands">
              Bands: points ±{data.bands.pts}, rebounds and assists ±{data.bands.reb}, 3PM, steals and blocks ±
              {data.bands.stl}, team points ±{data.bands.team_pts}, game total ±{data.bands.total}, margin ±
              {data.bands.margin}. Winner: right when the pick won. Closer is level within 0.1. iddaa's lines have
              its margin removed. Last read of iddaa{' '}
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

function Status({ data, lines, settled }: { data: BookCompare; lines: Line[]; settled: boolean }) {
  const looks = data.games.map((g) => g.checked).sort()
  const tipped = data.games.filter((g) => g.status !== 'scheduled').length
  const t = tallyOf(lines)
  return (
    <div className="ic-status">
      <span className="ic-date">{nightLabel(data.date)}</span>
      <span>
        <span className="num">{data.games.length}</span> games{' '}
        {settled ? 'settled' : tipped ? `· ${tipped} tipped off` : ''}
      </span>
      {!settled && (
        <span className="ic-opt">
          <span className="num">{t.n}</span> lines · <span className="num">{t.above}</span> Ours above
        </span>
      )}
      <span>
        {!settled && <span className="ic-live" />}
        {settled ? 'Last looks ' : 'Last look '}
        <span className="num">
          {settled && looks.length > 1
            ? `${clock(looks[0])}–${clock(looks[looks.length - 1])}`
            : clock(looks[looks.length - 1] ?? '')}
        </span>
      </span>
    </div>
  )
}

function NightTally({ lines }: { lines: Line[] }) {
  const all = tallyOf(lines)
  const players = tallyOf(lines.filter((l) => l.kind === 'player'))
  const wide = typeof window !== 'undefined' && window.innerWidth >= 720
  const row = (s: Stat) => {
    const ls = lines.filter((l) => l.stat === s)
    const t = tallyOf(ls)
    if (!t.judged) return null
    return (
      <li key={s}>
        <span className="ic-st">{STAT_NAME[s]}:</span>
        <span className="ic-tx">
          Ours <b>{`${t.ours}/${t.judged}`}</b> · iddaa <b>{`${t.book}/${t.judged}`}</b> · Closer: Ours{' '}
          <b>{t.oursCloser}</b>, iddaa <b>{t.bookCloser}</b>
          {t.level ? (
            <>
              , level <b>{t.level}</b>
            </>
          ) : null}
        </span>
        <span className="ic-mm">
          {s === 'WIN' ? (
            <>
              Our pick won <span className="num">{t.ours}</span> of <span className="num">{t.judged}</span>
            </>
          ) : t.oursMiss != null && t.bookMiss != null ? (
            <>
              Mean miss <span className="num">{t.oursMiss.toFixed(1)}</span> ·{' '}
              <span className="num">{t.bookMiss.toFixed(1)}</span>
            </>
          ) : null}
        </span>
      </li>
    )
  }
  return (
    <section className="ic-sec" aria-labelledby="ic-h-tally">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-tally">Night tally</h2>
          <p className="ic-sub">
            Matched against the actual result. Ours ✓ when the result lands within the band of our number; iddaa
            judged the same way on its own line.
          </p>
        </div>
      </div>
      <div className="ic-tally-top">
        <div className="ic-fig">
          <span className="ic-lab">Ours within band</span>
          <span className="ic-big">
            {all.ours}
            <small>/{all.judged}</small>
          </span>
        </div>
        <div className="ic-fig">
          <span className="ic-lab">iddaa within band</span>
          <span className="ic-big i">
            {all.book}
            <small>/{all.judged}</small>
          </span>
        </div>
        <div className="ic-fig">
          <span className="ic-lab">Closer to the result</span>
          <div className="ic-split" aria-hidden="true">
            <span className="o" style={{ flex: all.oursCloser }} />
            <span className="lv" style={{ flex: all.level }} />
            <span className="i" style={{ flex: all.bookCloser }} />
          </div>
          <span className="ic-split-lab">
            <ShapeOurs /> Ours <span className="num">{all.oursCloser}</span> · level{' '}
            <span className="num">{all.level}</span> · <ShapeBook /> iddaa <span className="num">{all.bookCloser}</span>
          </span>
        </div>
        {players.oursMiss != null && players.bookMiss != null && (
          <div className="ic-fig">
            <span className="ic-lab">Mean miss, players</span>
            <span className="ic-split-lab ic-mean">
              Ours <span className="num">{players.oursMiss.toFixed(2)}</span> · iddaa{' '}
              <span className="num">{players.bookMiss.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>
      <details className="ic-det" open={wide}>
        <summary>
          <Chevron />
          Per stat
        </summary>
        <div className="ic-t-group">Players</div>
        <ul className="ic-t-list">{PLAYER_STATS.map(row)}</ul>
        <div className="ic-t-group">Games</div>
        <ul className="ic-t-list">{GAME_STATS.map(row)}</ul>
        <p className="ic-t-note">
          Steals, blocks and 3PM bands (±1) are loose on lines near 1, so read those rows by Closer.
        </p>
      </details>
    </section>
  )
}

interface ListProps {
  lines: Line[]
  data: BookCompare
  settled: boolean
  group: 'players' | 'games'
  stat: Stat | 'ALL'
  game: number | null
  showAll: boolean
  fold: boolean
  open: string | null
  onGroup: (g: 'players' | 'games') => void
  onStat: (s: Stat | 'ALL') => void
  onGame: (g: number | null) => void
  onShowAll: () => void
  onFold: () => void
  onOpen: (id: string) => void
}

function GapList(p: ListProps) {
  const { lines, data, settled, group, stat, game } = p
  const stats = group === 'players' ? PLAYER_STATS : GAME_STATS
  const inGame = (l: Line) => game == null || l.game.game_id === game
  const pool = lines.filter((l) => stats.includes(l.stat) && inGame(l) && l.gap != null)
  const shown = pool.filter((l) => stat === 'ALL' || l.stat === stat)
  const { above, rest } = ranked(shown, stat === 'ALL')
  const pending = settled ? above : above.filter((l) => !l.tipped)
  const tipped = settled ? [] : above.filter((l) => l.tipped)
  const limit = p.showAll ? Infinity : PAGE
  const count = (g: 'players' | 'games') =>
    lines.filter((l) => (g === 'players' ? l.kind === 'player' : l.kind === 'game') && inGame(l) && l.gap != null)
      .length
  const hidden = Math.max(0, pending.length - limit) + Math.max(0, tipped.length - (p.showAll ? Infinity : 4))
  const most = rest[0]
  return (
    <section className="ic-sec" aria-labelledby="ic-h-list">
      <div className="ic-sec-h">
        <div>
          <h2 id="ic-h-list">Biggest gaps above iddaa</h2>
          <p className="ic-sub">
            Gap = Ours − iddaa. Largest first.
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
          <div className="ic-games" role="group" aria-label="Game">
            <button type="button" className="ic-chip" aria-pressed={game == null} onClick={() => p.onGame(null)}>
              All games
            </button>
            {data.games.map((g) => (
              <button
                key={g.game_id}
                type="button"
                className="ic-chip"
                aria-pressed={game === g.game_id}
                onClick={() => p.onGame(g.game_id)}
              >
                {g.away} @ {g.home}
                <span className="t">
                  {g.status === 'final' ? `${g.away_score}–${g.home_score}` : clock(g.tip)}
                </span>
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
      <p className="ic-explain">
        {stat === 'ALL' ? (
          <>
            All ranks by gap in bands
            <span className="ic-hide-s">
              , so a +0.5 steal and a +2.5 point gap compare fairly
            </span>
            .
          </>
        ) : (
          `${STAT_NAME[stat]}: ranked by raw gap.`
        )}{' '}
        {above.length} of {shown.length} have Ours above.
      </p>
      <ColHead settled={settled} />
      {above.length === 0 ? (
        <p className="ic-none">
          No line had Ours above iddaa{stat === 'ALL' ? '' : ` in ${STAT_NAME[stat]}`}.{' '}
          {most && most.book != null && most.ours != null && (
            <>
              Biggest the other way: <b>{`${most.kind === 'player' ? most.name : most.gameLabel} ${STAT_NAME[most.stat]}`}</b>,
              iddaa {value(most, 'book')} vs Ours {value(most, 'ours')}.
            </>
          )}
        </p>
      ) : (
        <ol className={`ic-rows${p.open ? ' has-open' : ''}`}>
          {pending.slice(0, limit).map((l, i) => (
            <Row key={l.id} line={l} i={i} rank={i + 1} settled={settled} open={p.open === l.id} onOpen={p.onOpen} />
          ))}
        </ol>
      )}
      {tipped.length > 0 && (
        <>
          <div className="ic-divider">
            <ClockIcon />
            Tipped off · kept as read at the last look
          </div>
          <ol className={`ic-rows no-house${p.open ? ' has-open' : ''}`}>
            {tipped.slice(0, p.showAll ? undefined : 4).map((l, i) => (
              <Row key={l.id} line={l} i={i} rank={0} settled={false} open={p.open === l.id} onOpen={p.onOpen} />
            ))}
          </ol>
        </>
      )}
      <div className="ic-list-foot">
        {hidden > 0 && (
          <button type="button" className="secondary" onClick={p.onShowAll}>
            Show all {above.length} above iddaa
          </button>
        )}
        {rest.length > 0 && (
          <button type="button" className="ic-fold-btn" aria-expanded={p.fold} onClick={p.onFold}>
            <Chevron />
            Ours level with or below iddaa <span className="num">{rest.length}</span>
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

function ColHead({ settled }: { settled: boolean }) {
  return (
    <div className={`ic-colhead ${settled ? 'ic-grid-s' : 'ic-grid-t'}`} aria-hidden="true">
      <span />
      <span />
      <span>Line</span>
      <div className="ic-lane">
        <span className="l">iddaa</span>
        <span className="c">Gap</span>
        <span className="r">Ours</span>
      </div>
      {settled ? (
        <>
          <span className="ic-ch-ruler">Band around the result</span>
          <span className="ic-ch-res">Result</span>
          <span className="ic-ch-marks">Ours iddaa</span>
          <span className="ic-ch-closer">Closer</span>
        </>
      ) : (
        <span className="ic-ch-meta">Tip · last look</span>
      )}
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
  const judged = l.oursHit != null || l.bookHit != null
  return (
    <li className={`ic-row${open ? ' is-open' : ''}${l.tipped && !settled ? ' tipped' : ''}`}>
      <button
        type="button"
        className={`ic-row-main ${settled ? 'ic-grid-s' : 'ic-grid-t'}`}
        aria-expanded={open}
        onClick={() => onOpen(l.id)}
      >
        <span className="ic-rk">{rank || ''}</span>
        <Face line={l} />
        <Who line={l} />
        <Lane line={l} i={i} />
        {settled ? (
          <>
            <div className="ic-ruler">
              {l.stat === 'WIN' ? (
                <div className="ic-final">
                  Final {l.game.away} <span className="num">{l.game.away_score}</span>–
                  <span className="num">{l.game.home_score}</span> {l.game.home}
                </div>
              ) : (
                judged && <Ruler line={l} />
              )}
            </div>
            <div className="ic-res">{resultValue(l)}</div>
            <div className="ic-marks">
              {judged && (
                <>
              <span className="ic-mk-w">
                <span className="ic-mk-l">Ours</span>
                <Mark line={l} side="ours" i={i} />
              </span>
              <span className="ic-mk-w">
                <span className="ic-mk-l">iddaa</span>
                <Mark line={l} side="book" i={i} />
              </span>
                </>
              )}
            </div>
            <CloserCell line={l} />
          </>
        ) : (
          <div className="ic-meta">
            {l.tipped ? (
              <span className="ic-clock">
                <ClockIcon />
                Tipped off <span className="num">{clock(l.game.tip)}</span>
              </span>
            ) : (
              <>
                Tip <span className="num">{clock(l.game.tip)}</span>
              </>
            )}
            <div className="ic-lk">
              {l.tipped ? 'kept at' : 'read'} <span className="num">{clock(l.game.checked)}</span>
            </div>
          </div>
        )}
      </button>
      {open && <RowOpen line={l} settled={settled} />}
    </li>
  )
}

function Face({ line: l }: { line: Line }) {
  if (l.kind === 'player') {
    return (
      <span className="ic-face" aria-hidden="true">
        {l.initials}
      </span>
    )
  }
  return (
    <span className="ic-face pair" aria-hidden="true">
      <i>{l.game.away}</i>
      <i>{l.game.home}</i>
    </span>
  )
}

function Who({ line: l }: { line: Line }) {
  if (l.kind === 'player') {
    return (
      <div className="ic-who">
        <div className="ic-nm">{l.name}</div>
        <div className="ic-sub">
          <b>{STAT_NAME[l.stat]}</b> · {l.gameLabel}
          {l.ours == null && ' · no line of ours'}
        </div>
      </div>
    )
  }
  let extra = ''
  if (l.stat === 'WIN' && l.bookTeam && l.bookTeam !== l.team && l.book != null)
    extra = ` · iddaa favours ${l.bookTeam} ${Math.round((1 - l.book) * 100)}%`
  if (l.stat === 'MAR' && l.book != null && l.book < 0) extra = ` · iddaa has ${l.other}`
  return (
    <div className="ic-who">
      <div className="ic-nm">{l.gameLabel}</div>
      <div className="ic-sub">
        <b>{l.stat === 'TEAM' ? `${l.team} points` : STAT_NAME[l.stat]}</b>
        {extra}
      </div>
    </div>
  )
}

function Lane({ line: l, i }: { line: Line; i: number }) {
  const gap = l.gap ?? 0
  const share = Math.abs(l.score) / FULL_AT
  const style = { '--w': Math.min(share, 1).toFixed(3), '--i': i } as CSSProperties
  const clamp = share > 1 ? ' clamp' : ''
  return (
    <div className="ic-lane">
      <div className="l">
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
      </div>
    </div>
  )
}

function Mark({ line: l, side, i }: { line: Line; side: 'ours' | 'book'; i: number }) {
  const ok = side === 'ours' ? l.oursHit : l.bookHit
  if (ok == null) return <span className="ic-mk none" aria-label="No result" />
  const who = side === 'ours' ? 'Ours' : 'iddaa'
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

function CloserCell({ line: l }: { line: Line }) {
  if (!l.closer) return <div className="ic-closer" />
  if (l.closer === 'tie')
    return (
      <div className="ic-closer">
        <span>Level</span>
      </div>
    )
  const by = l.by == null ? '' : l.stat === 'WIN' ? `${Math.round(l.by * 100)}pp` : num(l.by)
  return (
    <div className="ic-closer">
      {l.closer === 'ours' ? <ShapeOurs /> : <ShapeBook />}
      <span>
        <b>{l.closer === 'ours' ? 'Ours' : 'iddaa'}</b> by <span className="num">{by}</span>
      </span>
    </div>
  )
}

/** A ruler centred on the result with the band shaded: Ours an open ▽ above, iddaa a solid ▲ below. */
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
  }, iddaa ${num(l.book)} ${l.bookHit ? 'inside' : 'outside'}.`
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
          <span className="lab">iddaa</span>
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
            {l.won} won. Ours gave {l.team} <b>{big(l.ours)}</b>, iddaa gave {l.team} <b>{big(l.book)}</b>.{' '}
            {l.closer === 'tie' ? 'Level.' : l.closer ? <><b>{l.closer === 'ours' ? 'Ours' : 'iddaa'}</b> was closer.</> : null}
          </p>
        )}
        {settled && l.stat !== 'WIN' && l.actual != null && (
          <>
            <p>
              {l.closer === 'tie' ? 'Level' : <b>{l.closer === 'ours' ? 'Ours' : 'iddaa'} was closer</b>}
              {l.by != null && l.closer !== 'tie' ? `, by ${num(l.by)}` : ''}. Off by {offO} (Ours) and {offB} (iddaa). A
              line counts when it lands within ±{num(l.band)} {unit} of the result.
            </p>
            <div className="ic-ruler-big">
              <Ruler line={l} big />
            </div>
          </>
        )}
        {!settled && l.gap != null && (
          <p>
            {l.gap > 0 ? 'Ours is above iddaa' : l.gap < 0 ? 'Ours is below iddaa' : 'Level with iddaa'}
            {l.stat === 'WIN' ? ` on ${l.team}'s chance` : `, by ${num(Math.abs(l.gap))} ${unit}`}. That is{' '}
            <b>{Math.abs(l.score).toFixed(2)}</b> of a band.
          </p>
        )}
        {l.ladder.length > 0 && l.book != null && (
          <>
            <div className="ic-ladder-cap">
              iddaa's N+ ladder with its margin removed. It crosses 50% at {l.book.toFixed(1)}, its line.
            </div>
            <div className="ic-ladder" aria-label="iddaa ladder">
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
            bands).
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
          <span>iddaa higher</span>
          <span>Seam: iddaa's line</span>
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
            <Field lines={ls} />
            <div className="notes">
              {settled && t.judged ? (
                <>
                  Ours <b>{`${t.ours}/${t.judged}`}</b> · iddaa <b>{`${t.book}/${t.judged}`}</b>
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

/** One stat's lines as marks along the seam (a beeswarm); view only, the list is the readable one. */
function Field({ lines }: { lines: Line[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
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
  return (
    <div
      ref={ref}
      className={`ic-fld${placed.dense ? ' dense' : ''}`}
      style={{ height: placed.height }}
      aria-hidden="true"
    >
      {width > 0 && <span className="med" style={{ left: placed.median }} />}
      {width > 0 &&
        placed.marks.map(({ line, x, y }) =>
          line.oursHit != null ? (
            <span key={line.id} className={`m ${line.oursHit ? 'ok' : 'no'}`} style={{ left: x, top: y }}>
              {line.oursHit ? <CheckIcon /> : <XIcon />}
            </span>
          ) : (
            <span key={line.id} className={`m ring${line.tipped ? ' dim' : ''}`} style={{ left: x, top: y }} />
          ),
        )}
    </div>
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
                <span className="ic-face pair" aria-hidden="true">
                  <i>{g.away}</i>
                  <i>{g.home}</i>
                </span>
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
              <table className="ic-gt">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Market</span>
                    </th>
                    <th scope="col">iddaa</th>
                    <th scope="col">Ours</th>
                    {final ? (
                      <>
                        <th scope="col">Result</th>
                        <th scope="col">Ours</th>
                        <th scope="col">iddaa</th>
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
                      <td>{label}</td>
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
                      Player lines: Ours <b>{`${pl.ours}/${pl.judged}`}</b> · iddaa <b>{`${pl.book}/${pl.judged}`}</b>
                    </span>
                    <span>
                      Closer: Ours <b>{pl.oursCloser}</b>, iddaa <b>{pl.bookCloser}</b>
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
        <h2>{data.day == null ? 'No iddaa lines saved yet' : "iddaa wasn't saved before this night's games"}</h2>
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

function ClockIcon() {
  return (
    <svg className="ic-i" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
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

function ShapeOurs() {
  return (
    <svg className="ic-shape so" viewBox="0 0 10 9" aria-hidden="true">
      <path d="M1 1h8L5 8z" />
    </svg>
  )
}

function ShapeBook() {
  return (
    <svg className="ic-shape si" viewBox="0 0 10 9" aria-hidden="true">
      <path d="M5 1l4 7H1z" />
    </svg>
  )
}
