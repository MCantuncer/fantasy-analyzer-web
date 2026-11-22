import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { couponsOf, fmtOdds } from '../lib/coupons'
import type { CouponKind, CouponSlot, CouponSpec, Leg } from '../lib/coupons'
import { useEscapeLayer } from '../lib/escapeStack'
import { STAT_NAME, betFace, clock, nightLabel } from '../lib/iddaaCompare'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import { teamLight } from '../lib/nbaTeams'
import { band } from '../lib/ourCall'
import { PlayerHead, TeamLogo } from './PlayerHead'
import './Kupons.css'

/** Tonight's Kupons (Can 2026-11-22): four ready-made iddaa bet slips at the top of Our Estimates,
 *  safest to boldest, built from iddaa's own odds and our chance for each pick (lib/coupons). "Kupon"
 *  is iddaa's own word, kept in Turkish on purpose and always set in italics with a hint, so it never
 *  reads as a slip in translation. Comparison only: nothing here feeds the model. */
export function Kupons({ data, lines }: { data: BookCompare; lines: Line[] }) {
  const slots = useMemo(() => couponsOf(lines), [lines])
  // Before player bets, Matches Only is the same picks as Highest Confidence: one wide slip holds both
  // (Can 2026-11-22), so Surprise still ends the row.
  const twin = slots.find((s) => s.spec.kind === 'matches' && s.same === 'safe') ?? null
  const shown = twin ? slots.filter((s) => s !== twin) : slots
  const built = slots.filter((s) => s.coupon)
  const [open, setOpen] = useState<CouponKind | null>(() => remembered() ?? built[0]?.spec.kind ?? null)
  const [pop, setPop] = useState<string | null>(null)
  useEscapeLayer(pop != null, () => setPop(null))
  if (!built.length) return null

  const latest = data.day === data.days[data.days.length - 1]
  const final = data.games.length > 0 && data.games.every((g) => g.status === 'final')
  const waiting = slots.some((s) => s.why === 'waiting')
  const settled = built.filter((s) => s.coupon!.result != null)
  const firstTip = data.games
    .filter((g) => g.status === 'scheduled')
    .map((g) => g.tip)
    .sort()[0]
  const checked = data.games
    .map((g) => g.checked)
    .filter(Boolean)
    .sort()
    .pop()
  const date = nightLabel(data.date)
  const toggle = (k: CouponKind) => {
    const next = open === k ? null : k
    setOpen(next)
    try {
      localStorage.setItem('ic-ku-open', next ?? '')
    } catch {
      /* a per-viewer convenience only */
    }
  }
  const won = settled.filter((s) => s.coupon!.result === 'won')
  return (
    <section className="ic-ku ic-ku-sheet" aria-labelledby="ic-ku-h">
      <div className="ic-ku-head">
        <h2 id="ic-ku-h">
          {latest ? (final ? "Last night's " : "Tonight's ") : null}
          <KuponTerm />
          {latest ? null : ` for ${date}`}
        </h2>
        <p>
          {final ? (
            <>
              Four ready-made <K s="Kupons" /> for {date}, safest to boldest. Every pick on a <K /> has to win for it
              to pay.
            </>
          ) : (
            <>
              Four ready-made <K s="Kupons" /> for {latest ? 'tonight' : date}, safest to boldest, from iddaa's own
              odds and our chance for each pick.
            </>
          )}
        </p>
      </div>
      <div className="ic-ku-night">
        {final ? (
          <>
            <span>
              <b>Final</b> · {date}
            </span>
            <span>
              <b className="num">{won.length}</b> of <b className="num">{settled.length}</b> <K s="Kupons" /> won
            </span>
          </>
        ) : (
          <>
            <span>
              {latest && <i className="ic-ku-gold" aria-hidden="true" />}
              <b>{latest ? 'Tonight' : 'Night'}</b> · {date}
            </span>
            <span>
              <b className="num">{built.length}</b> <K s={built.length === 1 ? 'Kupon' : 'Kupons'} />
              {waiting ? ' ready' : ''}
            </span>
            {waiting && (
              <span>
                Players Only after <b className="num">19:00</b>
              </span>
            )}
            {checked && (
              <span>
                Updated <b className="num">{clock(checked)}</b>
              </span>
            )}
            {firstTip && (
              <span className="r">
                First tip <b className="num">{clock(firstTip)}</b>
              </span>
            )}
          </>
        )}
      </div>
      <ol className="ic-ku-rack">
        {shown.map((s) => (
          <KuponSlip
            key={s.spec.kind}
            slot={s}
            waiting={waiting}
            also={s.spec.kind === 'safe' && twin ? twin.spec : null}
            sameAs={s.same ? slots.find((o) => o.spec.kind === s.same)!.spec.title : null}
            open={open === s.spec.kind}
            onToggle={() => toggle(s.spec.kind)}
            pop={pop}
            onPop={setPop}
          />
        ))}
      </ol>
      <Rules />
    </section>
  )
}

function remembered(): CouponKind | null {
  try {
    const v = localStorage.getItem('ic-ku-open')
    return v === 'safe' || v === 'players' || v === 'matches' || v === 'surprise' ? v : null
  } catch {
    return null
  }
}

/** The word in italics, everywhere it appears. */
function K({ s = 'Kupon' }: { s?: string }) {
  return <i className="ku">{s}</i>
}

/** The section title's word: a 44px button that explains it on hover, focus or tap. */
function KuponTerm() {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  useEscapeLayer(open, () => {
    setOpen(false)
    btn.current?.focus()
  })
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.('.ic-ku-term, .ic-ku-hint')) setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="ic-ku-term"
        aria-expanded={open}
        aria-controls="ic-ku-hint"
        aria-describedby="ic-ku-hint"
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <i>Kupons</i>
        <svg className="ic-ku-info" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <circle cx="8" cy="8" r="6.3" />
          <path d="M8 7.3v3.9" />
          <circle cx="8" cy="4.9" r=".5" fill="currentColor" />
        </svg>
      </button>
      <span className="ic-ku-hint" id="ic-ku-hint" role="tooltip" hidden={!open}>
        <K /> is iddaa's word for a bet slip: a few picks whose odds multiply. All of them must win for it to pay.
      </span>
    </>
  )
}

const ICONS: Record<CouponKind | 'clock', string[]> = {
  safe: ['M10 2.6 4 4.8v4.6c0 3.7 2.6 6.4 6 8 3.4-1.6 6-4.3 6-8V4.8z', 'm7.3 9.9 1.9 1.9 3.6-3.7'],
  players: ['M3.8 17c.9-3 3.3-4.6 6.2-4.6s5.3 1.6 6.2 4.6'],
  matches: [],
  surprise: ['M11.2 2.5 4.8 11h4.6l-.8 6.5 6.6-8.6h-4.7z'],
  clock: ['M10 6v4.2l2.8 1.8'],
}

function Ico({ k, size = 18, cls = 'ic-ku-ico' }: { k: CouponKind | 'clock'; size?: number; cls?: string }) {
  return (
    <svg className={cls} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      {k === 'players' && <circle cx="10" cy="7" r="3.3" />}
      {k === 'matches' && (
        <>
          <circle cx="7.4" cy="10" r="4.6" />
          <circle cx="12.6" cy="10" r="4.6" />
        </>
      )}
      {k === 'clock' && <circle cx="10" cy="10" r="7" />}
      {ICONS[k].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

const Tick = ({ size = 12 }: { size?: number }) => (
  <svg className="ic-ku-tick" viewBox="0 0 12 12" width={size} height={size} aria-hidden="true">
    <path d="M2.2 6.4l2.4 2.4 5.2-5.4" />
  </svg>
)
const Cross = ({ size = 10 }: { size?: number }) => (
  <svg className="ic-ku-cross" viewBox="0 0 10 10" width={size} height={size} aria-hidden="true">
    <path d="M1.5 1.5l7 7" />
    <path d="M8.5 1.5l-7 7" />
  </svg>
)
const Link = () => (
  <svg className="ic-ku-link" viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
    <path d="M6 8a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" />
    <path d="M8 6a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />
  </svg>
)
const Chev = () => (
  <svg className="ic-ku-chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
)

const MARKET: Record<string, string> = { WIN: 'Match result', MAR: 'Handicap', TOT: 'Total points' }
const pctOf = (v: number) => Math.round(v * 100)
const lastName = (name: string) => name.split(' ').slice(1).join(' ') || name

/** "Brunson 22+", "BOS −8.5", "Under 231.5": a leg named short, for the stub. */
function shortOf(l: Leg): string {
  return l.kind === 'player' ? `${lastName(l.line.name)} ${l.bet}` : l.bet
}

/** What the game gave the leg: "Got 19", "Final 108–115". */
function gotOf(l: Leg): string {
  const g = l.line.game
  if (l.kind === 'game' && l.stat !== 'TOT') return `Final ${g.away_score ?? ''}–${g.home_score ?? ''}`
  return l.line.actual == null ? '' : `Got ${Math.round(l.line.actual * 10) / 10}`
}

/** A leg in words for screen readers and the ring card's title. */
function wordsOf(l: Leg): string {
  if (l.kind === 'player') return `${l.line.name} ${l.bet} ${STAT_NAME[l.stat].toLowerCase()}`
  return l.bet
}

function KuponSlip({
  slot,
  waiting,
  also = null,
  sameAs,
  open,
  onToggle,
  pop,
  onPop,
}: {
  slot: CouponSlot
  waiting: boolean
  /** A second Kupon with exactly these picks, shown in the same slip (Matches Only before player bets). */
  also?: CouponSpec | null
  sameAs: string | null
  open: boolean
  onToggle: () => void
  pop: string | null
  onPop: (id: string | null) => void
}) {
  const { spec, coupon: c } = slot
  const id = `ic-ku-${spec.kind}`
  const aim = spec.kind === 'surprise' ? '20' : '4.50'
  if (!c) {
    return (
      <li className="ic-ku-slip quiet">
        <div className="ic-ku-stub">
          <div className="ic-ku-name">
            <Ico k={spec.kind} />
            <h3>{spec.title}</h3>
            <span className="ku-tag">
              {slot.why === 'waiting' ? (
                <>
                  At <b className="num">19:00</b>
                </>
              ) : (
                'Not tonight'
              )}
            </span>
          </div>
          <p className="ic-ku-wait">
            {slot.why === 'waiting' && <Ico k="clock" size={20} cls="ic-ku-ico clk" />}
            <span>
              {slot.why === 'waiting' ? (
                <>
                  <b>
                    Player bets come in <span className="nw">usually after 19:00</span>
                  </b>
                  <span className="aim">
                    <span className="nw">
                      Aiming for total odds of about <b className="num">{aim}</b>
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <b>Not enough picks tonight</b>
                  <span className="aim">
                    One pick per game can't reach about <span className="num">{aim}</span>.
                  </span>
                </>
              )}
            </span>
          </p>
        </div>
      </li>
    )
  }
  const n = c.legs.length
  const done = c.result != null
  const wonN = c.legs.filter((l) => l.result === 'won').length
  const gameOnly = waiting && !also && c.legs.every((l) => l.kind === 'game') && spec.only !== 'game'
  const openLabel = done
    ? `${spec.title}${also ? ` and ${also.title}` : ''}: ${c.result}, ${wonN} of ${n} picks won. Show the picks`
    : `${spec.title}${also ? ` and ${also.title}` : ''}: total odds ${fmtOdds(c.listed)}, probability about ${pctOf(c.chance)}%. Show the ${n} picks`
  return (
    <li
      className={`ic-ku-slip${c.result === 'won' ? ' won' : ''}${c.result === 'lost' ? ' lost' : ''}${open ? ' open' : ''}${sameAs ? ' same' : ''}${also ? ' wide' : ''}`}
    >
      <div className="ic-ku-stub">
        <div className="ic-ku-name">
          {also ? (
            <h3 className="ic-ku-pair">
              <span className="ic-ku-also">
                <Ico k={spec.kind} />
                {spec.title}
              </span>
              <span className="sr-only"> and </span>
              <span className="ic-ku-also">
                <Ico k={also.kind} />
                {also.title}
              </span>
            </h3>
          ) : (
            <>
              <Ico k={spec.kind} />
              <h3>{spec.title}</h3>
            </>
          )}
          {c.result === 'won' ? (
            <span className="ku-tag ok">
              <Tick />
              Won
            </span>
          ) : c.result === 'lost' ? (
            <span className="ku-tag no">
              <Cross />
              Lost
            </span>
          ) : also ? (
            <span className="ku-tag merged">
              <Link />
              Merged for now
            </span>
          ) : (
            <span className="ku-tag">
              <b className="num">{n}</b> picks
            </span>
          )}
          {!sameAs && (
            <span className="cnt" aria-hidden="true">
              <span className="num">{n}</span> picks
              <Chev />
            </span>
          )}
        </div>
        {also && !done && (
          <p className="ic-ku-note ic-ku-until">
            <Ico k="clock" size={14} />
            <span>Same picks until player bets come in</span>
          </p>
        )}
        <div className="ic-ku-heroes">
          <div className="tot">
            <span className="lab">Total odds</span>
            <b className="num big">{fmtOdds(c.result === 'won' ? c.odds : c.listed)}</b>
          </div>
          {c.result === 'lost' ? (
            c.broke.length === 1 ? (
              <div className="pay broke">
                <span className="lab">Lost on</span>
                <b className="who1">{shortOf(c.broke[0])}</b>
                <span className="got">
                  {gotOf(c.broke[0])}
                  {c.broke[0].kind === 'player' ? `, needed ${c.broke[0].at}` : ''}
                </span>
              </div>
            ) : (
              <div className="pay broke">
                <span className="lab">
                  Lost on <b className="num">{c.broke.length}</b> picks
                </span>
                {c.broke.slice(0, 2).map((b) => (
                  <b key={b.id} className="who2">
                    {shortOf(b)}
                  </b>
                ))}
                {c.broke.length > 2 && <span className="got">+{c.broke.length - 2}</span>}
              </div>
            )
          ) : (
            <div className="pay chance">
              <span className="lab">{done ? 'Probability was' : 'Probability'}</span>
              <b className="num big">
                <small className="approx">~</small>
                {pctOf(c.chance)}%
              </b>
            </div>
          )}
        </div>
        {c.result === 'lost' && (
          <p className="ic-ku-odds">
            <span>
              Probability was <b className="num">{pctOf(c.chance)}%</b>
            </span>
          </p>
        )}
        {c.voided.length > 0 && (
          <p className="ic-ku-note">
            <span>
              {c.voided.map((v) => lastName(v.line.name)).join(', ')} sat out, so iddaa counts that pick at{' '}
              <b className="num">1.00</b>: total odds <span className="num">{fmtOdds(c.listed)}</span> became{' '}
              <span className="num">{fmtOdds(c.odds)}</span>.
            </span>
          </p>
        )}
        {gameOnly && !done && (
          <p className="ic-ku-note">
            <Ico k="clock" size={14} />
            <span>Game lines only for now · may change when player bets come in</span>
          </p>
        )}
        {sameAs && (
          <p className="ic-ku-note">
            <span>
              Same {n} picks as {sameAs} until player bets come in.
            </span>
          </p>
        )}
        {!sameAs && (
          <button
            type="button"
            className="ic-ku-open"
            aria-expanded={open}
            aria-controls={`${id}-picks`}
            aria-label={openLabel}
            onClick={onToggle}
          />
        )}
      </div>
      {!sameAs && (
        <>
          <ol className="ic-ku-picks" id={`${id}-picks`} aria-label={`${spec.title} picks`}>
            {c.legs.map((l, i) => (
              <KuponPick key={l.id} leg={l} id={`${id}-${i}`} pop={pop} onPop={onPop} />
            ))}
          </ol>
          <p className="ic-ku-foot">
            {done ? (
              <>
                <b className="num">{wonN}</b> of <b className="num">{n}</b> picks won
              </>
            ) : (
              <>
                <b className="num">{n}</b> picks · aimed at about {aim}
              </>
            )}
          </p>
        </>
      )}
    </li>
  )
}

/** The face: the player's head (no under-light here) or the team's logo; both logos for a total. */
function Face({ leg: l }: { leg: Leg }) {
  const g = l.line.game
  if (l.kind === 'player')
    return (
      <span className="ic-ku-face" aria-hidden="true">
        <PlayerHead player={{ id: l.line.playerId ?? 0, name: l.line.name }} team={l.line.team} size={32} />
      </span>
    )
  if (l.stat === 'TOT')
    return (
      <span className="ic-ku-face pair" aria-hidden="true">
        <TeamLogo abbrev={g.away} size={22} fallback />
        <TeamLogo abbrev={g.home} size={22} fallback />
      </span>
    )
  const team = betFace(l.line)?.dot ?? l.line.team
  return (
    <span className="ic-ku-face" aria-hidden="true">
      <TeamLogo abbrev={team || l.line.team} size={32} fallback />
    </span>
  )
}

function KuponPick({
  leg: l,
  id,
  pop,
  onPop,
}: {
  leg: Leg
  id: string
  pop: string | null
  onPop: (id: string | null) => void
}) {
  const g = l.line.game
  const p = pctOf(l.chance)
  const face = l.kind === 'game' ? betFace(l.line) : null
  const side = face?.dot ?? (l.kind === 'player' ? l.line.team : l.line.team)
  const matchup = (
    <>
      {g.away === side ? <b>{g.away}</b> : <span>{g.away}</span>} @{' '}
      {g.home === side ? <b>{g.home}</b> : <span>{g.home}</span>}
    </>
  )
  const isOpen = pop === id
  const res = l.result
  const got = gotOf(l)
  const sr = [
    wordsOf(l),
    `${g.away} at ${g.home}`,
    res ? null : clock(g.tip),
    `odds ${l.odd.toFixed(2)}`,
    `our chance ${p}%`,
    res === 'won' ? `won, ${got.toLowerCase()}` : res === 'lost' ? `lost, ${got.toLowerCase()}` : null,
    res === 'void' ? 'sat out, counted at 1.00' : null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <li className={`ic-ku-pick${res === 'lost' ? ' broke' : res === 'void' ? ' void' : ''}`}>
      <span className="sr-only">{sr}</span>
      <Face leg={l} />
      <span className="who" aria-hidden="true">
        {l.kind === 'player' ? <span className="nm">{l.line.name}</span> : <span className="nm mu">{matchup}</span>}
        {res === 'won' ? (
          <span className="res ok">
            <Tick />
            <span className="nw">{got}</span>
          </span>
        ) : res === 'lost' ? (
          <span className="res no">
            <Cross />
            <b>Lost</b>
            <span>·</span>
            <span className="nw">{got}</span>
          </span>
        ) : res === 'void' ? (
          <span className="res vd">
            <span className="dash">–</span>
            <span>Sat out</span>
          </span>
        ) : (
          <span className="sub">
            {l.kind === 'player' ? matchup : MARKET[l.stat]} · <span className="num">{clock(g.tip)}</span>
          </span>
        )}
      </span>
      <span className="bet" aria-hidden="true">
        <span className="lab">
          {l.kind === 'player' ? (
            STAT_NAME[l.stat]
          ) : l.stat === 'MAR' && face?.dot ? (
            <>
              <i className="dot" style={{ '--tl': teamLight(face.dot) } as CSSProperties} />
              {face.q}
            </>
          ) : (
            face?.q
          )}
        </span>
        <b className={l.stat === 'WIN' ? 'hero txt' : 'hero num'}>{l.kind === 'player' ? l.bet : face?.hero}</b>
      </span>
      <span className="odds" aria-hidden="true">
        <span className="lab">Odds</span>
        <b className="num odd">{res === 'void' ? '1.00' : l.odd.toFixed(2)}</b>
      </span>
      <button
        type="button"
        id={`${id}-ring`}
        className="ic-ku-conf"
        data-band={band(p)}
        aria-expanded={isOpen}
        aria-controls={`${id}-pop`}
        aria-label={`Our chance ${p}%. What this means`}
        onClick={() => onPop(isOpen ? null : id)}
      >
        <Ring pct={p} size={32} stroke={3.5} />
        <span className="pct num">
          {p}
          <small>%</small>
        </span>
      </button>
      {isOpen && <ChancePop leg={l} id={id} onPop={onPop} />}
    </li>
  )
}

function Ring({ pct, size, stroke }: { pct: number; size: number; stroke: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className="ic-ku-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle className="trk" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className="arc"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={`${((c * pct) / 100).toFixed(2)} ${c.toFixed(2)}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

const BAND_WORDS: Record<ReturnType<typeof band>, string> = {
  sure: 'green: a strong call (80% and up)',
  likely: 'soft green: likely (65 to 79%)',
  lean: 'amber: a lean (55 to 64%)',
  flip: 'grey: close to a coin flip (under 55%)',
}

/** What the ring means, in words: a popover on desktop, a bottom sheet on a phone (as Score Slip). */
function ChancePop({ leg: l, id, onPop }: { leg: Leg; id: string; onPop: (id: string | null) => void }) {
  const p = pctOf(l.chance)
  const book = Math.round(100 / l.odd)
  const bd = band(p)
  const g = l.line.game
  const box = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (window.matchMedia?.('(max-width: 719px)').matches) close.current?.focus()
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!box.current?.contains(t) && !t?.closest?.(`#${id}-ring`)) onPop(null)
    }
    document.addEventListener('pointerdown', down)
    const pop = box.current
    return () => {
      document.removeEventListener('pointerdown', down)
      const at = document.activeElement
      if (!at || at === document.body || pop?.contains(at)) document.getElementById(`${id}-ring`)?.focus()
    }
  }, [id, onPop])
  const got = gotOf(l)
  return (
    <>
      <div className="ic-ku-scrim" onClick={() => onPop(null)} aria-hidden="true" />
      <div ref={box} className="ic-ku-pop" id={`${id}-pop`} role="dialog" aria-label={`Our chance: ${wordsOf(l)}`}>
        <div className="ic-ku-pop-h">
          <span className="mk">
            {l.kind === 'player' ? STAT_NAME[l.stat] : `${MARKET[l.stat]} · ${g.away} @ ${g.home}`}
          </span>
          <b>{wordsOf(l)}</b>
          <button ref={close} type="button" className="ic-ku-x" aria-label="Close" onClick={() => onPop(null)}>
            <Cross />
          </button>
        </div>
        <div className="ic-ku-pop-lead" data-band={bd}>
          <Ring pct={p} size={40} stroke={5} />
          <p>
            We give it a <b className="num">{p}%</b> chance.
          </p>
        </div>
        <div className="ic-ku-bars" data-band={bd}>
          <span className="who">Ours</span>
          <span className="bar">
            <i style={{ width: `${p}%` }} />
          </span>
          <span className="num v">{p}%</span>
          <span className="who">iddaa</span>
          <span className="bar book">
            <i style={{ width: `${Math.min(100, book)}%` }} />
          </span>
          <span className="num v">{book}%</span>
        </div>
        <p className="fine">
          iddaa's odds <b className="num">{l.odd.toFixed(2)}</b> imply <b className="num">{book}%</b>.
          {l.kind === 'player' ? ` Our chance is for this rung, ${l.bet}.` : ''}
        </p>
        {l.result === 'won' && (
          <p className="res ok">
            <Tick size={13} />
            <span>
              <b>Won.</b> {got}.
            </span>
          </p>
        )}
        {l.result === 'lost' && (
          <p className="res no">
            <Cross size={11} />
            <span>
              <b>Lost.</b> {got}
              {l.kind === 'player' ? `, needed ${l.at}` : ''}. This pick broke the <K />.
            </span>
          </p>
        )}
        {l.result === 'void' && (
          <p className="res">
            {l.line.name} sat out. iddaa counts the pick at <b className="num">1.00</b>, so the <K /> still pays on the
            others.
          </p>
        )}
        <p className="key">
          <span className="sw" data-band={bd} />
          {p}% is {BAND_WORDS[bd]}.
        </p>
      </div>
    </>
  )
}

/** How we build them: one line, and More for the rules. */
function Rules() {
  const [more, setMore] = useState(false)
  return (
    <div className="ic-ku-rules">
      <p>
        <b>How we build them:</b> only iddaa's own odds, one pick per game.
        <button type="button" className="ic-ku-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? 'Less' : 'More'}
        </button>
      </p>
      {more && (
        <ul>
          <li>
            Only lines iddaa prices itself, and never odds of <span className="num">1.33</span> or under.
          </li>
          <li>At most one pick per game: picks from one game move together.</li>
          <li>
            Total odds are the picks' odds multiplied. Probability is the chances on the picks multiplied: how often we
            think every pick wins.
          </li>
          <li>A player pick can be any rung iddaa prices (18+ instead of our usual 22+), with our chance for that rung.</li>
          <li>
            If a player sits out, iddaa counts that pick at <span className="num">1.00</span>.
          </li>
        </ul>
      )}
    </div>
  )
}

