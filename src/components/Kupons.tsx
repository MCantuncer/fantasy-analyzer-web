import { Check, Clock, Lightning, LinkSimple, ShieldCheck, Ticket, User, X } from '@phosphor-icons/react'
import { Fragment, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { WHY_NOT, couponsOf, fmtOdds, legWhy, whyNot } from '../lib/coupons'
import type { Coupon, CouponKind, CouponSlot, CouponSpec, Leg } from '../lib/coupons'
import { STAT_NAME, STAT_UNIT, betFace, clock, nightLabel } from '../lib/iddaaCompare'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import { teamLight } from '../lib/nbaTeams'
import { usePlayerCard } from '../lib/playerCard'
import { useMediaQuery } from '../lib/useMediaQuery'
import { Chance } from './EstimateBits'
import { KuponStack } from './KuponStack'
import { PlayerLink } from './PlayerCard'
import { PlayerHead, TeamLogo } from './PlayerHead'
import './Kupons.css'

/** Tonight's Kupons (The Slip Rail, Can 2026-11-23): iddaa's bet slips at the top of Our Estimates,
 *  built from iddaa's own odds and our chance for each pick (lib/coupons). From 900px they sit side by
 *  side in a fixed order; under it they stack (KuponStack). "Kupon" is iddaa's own word, kept in Turkish and always set in italics.
 *  Comparison only: nothing here feeds the model. */
/** Opens a game's match card on its Form view, on the side the pick backs. */
export type OpenMatch = (gameId: number, side: 'away' | 'home') => void

/** Under this the rail turns into the stack: three slips in a row are too narrow below 900px. */
const STACK = '(max-width: 899px)'

export function Kupons({ data, lines, onMatch }: { data: BookCompare; lines: Line[]; onMatch?: OpenMatch }) {
  const phone = useMediaQuery(STACK)
  const slots = useMemo(() => couponsOf(lines), [lines])
  const shots = useMemo(() => whyNot(lines), [lines])
  // While Matches Only has the same picks as Highest Confidence, one slip holds both (Can 2026-11-22),
  // so the rail drops to three and Surprise still ends it.
  const twin = slots.find((s) => s.spec.kind === 'matches' && s.same === 'safe') ?? null
  const shown = twin ? slots.filter((s) => s !== twin) : slots
  if (!slots.some((s) => s.coupon)) return null

  const latest = data.day === data.days[data.days.length - 1]
  const final = data.games.length > 0 && data.games.every((g) => g.status === 'final')
  const waiting = slots.some((s) => s.why === 'waiting')
  const left = data.games.filter((g) => g.status !== 'final').length
  const slip = (s: CouponSlot, hidden: boolean): ReactNode =>
    s.coupon ? (
      <KuponSlip
        key={s.spec.kind}
        slot={s}
        coupon={s.coupon}
        waiting={waiting}
        also={s.spec.kind === 'safe' && twin ? twin.spec : null}
        sameAs={s.same ? slots.find((o) => o.spec.kind === s.same)!.spec.title : null}
        onMatch={onMatch}
        hidden={hidden}
      />
    ) : (
      <QuietSlip key={s.spec.kind} slot={s} left={latest && !final ? left : null} hidden={hidden} />
    )
  return (
    <section className="ic-ku" aria-labelledby="ic-ku-h">
      <div className="ic-ku-head">
        <h2 id="ic-ku-h">
          <Ticket size={22} aria-hidden="true" />
          <span>
            {latest ? (final ? "Last night's " : "Tonight's ") : null}
            <i>Kupons</i>
            {latest ? null : ` for ${nightLabel(data.date)}`}
          </span>
        </h2>
        <span className="ic-ku-hint">iddaa's bet slips</span>
      </div>
      {phone ? (
        <KuponStack slots={shown} twin={twin} slip={slip} icon={(k) => <Ico k={k} />} />
      ) : (
        <ol className={`ic-ku-rail${twin ? ' three' : ''}`}>{shown.map((s) => slip(s, false))}</ol>
      )}
      {shots.length > 0 && <WhyNot legs={shots} onMatch={onMatch} />}
    </section>
  )
}

/** The slip's mark: Phosphor regular at 20px; Matches Only keeps its two circles. */
function Ico({ k }: { k: CouponKind }) {
  if (k === 'safe') return <ShieldCheck className="ic-ku-ico" size={20} aria-hidden="true" />
  if (k === 'players') return <User className="ic-ku-ico" size={20} aria-hidden="true" />
  if (k === 'surprise') return <Lightning className="ic-ku-ico" size={20} aria-hidden="true" />
  return (
    <svg className="ic-ku-ico ic-ku-two" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="7.4" cy="10" r="4.6" />
      <circle cx="12.6" cy="10" r="4.6" />
    </svg>
  )
}

const MARKET: Record<string, string> = { WIN: 'Match result', MAR: 'Handicap', TOT: 'Total points' }
const pctOf = (v: number) => Math.round(v * 100)
const lastName = (name: string) => name.split(' ').slice(1).join(' ') || name

const whoOf = (l: Leg) => ({ id: l.line.playerId ?? 0, name: l.line.name })

/** "Brunson 22+", "BOS −8.5", "Under 231.5": a leg named short. A player's name opens his card. */
function ShortOf({ leg: l }: { leg: Leg }) {
  if (l.kind !== 'player') return <>{l.bet}</>
  return (
    <>
      <PlayerLink player={whoOf(l)}>{lastName(l.line.name)}</PlayerLink> {l.bet}
    </>
  )
}

/** What the game gave the leg: "Got 19", "Final 108–115". */
function gotOf(l: Leg): string {
  const g = l.line.game
  if (l.kind === 'game' && l.stat !== 'TOT') return `Final ${g.away_score ?? ''}–${g.home_score ?? ''}`
  return l.line.actual == null ? '' : `Got ${Math.round(l.line.actual * 10) / 10}`
}

/** The odds a leg counts at: a void leg (the player sat out) pays 1.00. */
const oddOf = (l: Leg) => (l.result === 'void' ? 1 : l.odd)

function KuponSlip({
  slot,
  coupon: c,
  waiting,
  also = null,
  sameAs,
  onMatch,
  hidden = false,
}: {
  slot: CouponSlot
  coupon: Coupon
  waiting: boolean
  /** A second Kupon with exactly these picks, shown in the same slip (Matches Only while the same). */
  also?: CouponSpec | null
  sameAs: string | null
  onMatch?: OpenMatch
  /** Tucked behind the front slip in the phone stack. */
  hidden?: boolean
}) {
  const { spec } = slot
  const n = c.legs.length
  const done = c.result != null
  const won = c.result === 'won'
  const gameOnly = waiting && !also && c.legs.every((l) => l.kind === 'game') && spec.only !== 'game'
  // "Until player bets come in" only while they are still to come; once they are in, it's tonight.
  const same = waiting ? 'Same picks until player bets come in' : 'Same picks tonight'
  return (
    <li
      className={`ic-ku-slip${won ? ' won' : ''}${c.result === 'lost' ? ' lost' : ''}`}
      id={`ic-ku-${spec.kind}`}
      hidden={hidden}
    >
      <div className="ic-ku-sh">
        {also ? (
          <h3 className="ic-ku-names">
            <span>
              <Ico k={spec.kind} />
              {spec.title}
            </span>
            <span className="sr-only"> and </span>
            <span>
              <Ico k={also.kind} />
              {also.title}
            </span>
          </h3>
        ) : (
          <h3>
            <span>
              <Ico k={spec.kind} />
              {spec.title}
            </span>
          </h3>
        )}
        {also && !done && (
          <p className="ic-ku-same">
            <LinkSimple size={14} aria-hidden="true" />
            {same}
          </p>
        )}
        <span className="ic-ku-n">
          <span className="num">{n}</span> {n === 1 ? 'pick' : 'picks'}
        </span>
      </div>
      <div className="ic-ku-tot">
        <div>
          <span className="lab">Total odds</span>
          <b className="big num">{fmtOdds(won ? c.odds : c.listed)}</b>
          <span className="prod num">{c.legs.map((l) => fmtOdds(won ? oddOf(l) : l.odd)).join(' × ')}</span>
        </div>
        <div className="r">
          {done ? (
            <>
              <span className="lab">Result</span>
              {won ? (
                <b className="out ok">
                  <Check size={16} weight="bold" aria-hidden="true" />
                  Won
                </b>
              ) : (
                <b className="out no">
                  {c.broke.length === 1 ? (
                    // one span, so the flex row keeps the words together as one line of text
                    <span>
                      Lost on <ShortOf leg={c.broke[0]} />
                    </span>
                  ) : (
                    `Lost on ${c.broke.length} picks`
                  )}
                </b>
              )}
              <span className="was">
                Probability was <span className="num">~{pctOf(c.chance)}%</span>
              </span>
            </>
          ) : (
            <>
              <span className="lab">Probability</span>
              <b className="big num">
                <span className="tl">~</span>
                {pctOf(c.chance)}%
              </b>
            </>
          )}
        </div>
      </div>
      {c.voided.length > 0 && (
        <p className="ic-ku-note">
          <span>
            {c.voided.map((v, i) => (
              <Fragment key={v.id}>
                {i > 0 && ', '}
                <PlayerLink player={whoOf(v)}>{lastName(v.line.name)}</PlayerLink>
              </Fragment>
            ))}{' '}
            sat out, so iddaa counts that pick at <span className="num">1.00</span>.
          </span>
        </p>
      )}
      {gameOnly && !done && (
        <p className="ic-ku-note">
          <Clock size={14} aria-hidden="true" />
          Game lines only for now. May change when player bets come in.
        </p>
      )}
      {sameAs ? (
        <p className="ic-ku-note">
          {waiting ? `Same ${n} picks as ${sameAs} until player bets come in.` : `Same ${n} picks as ${sameAs} tonight.`}
        </p>
      ) : (
        <>
          <div className="ic-ku-seam" aria-hidden="true" />
          <div className="ic-ku-cols" aria-hidden="true">
            <span>Bet</span>
            <span>Odds</span>
            <span>Our chance</span>
          </div>
          <ol className="ic-ku-legs" aria-label={`${spec.title} picks`}>
            {c.legs.map((l, i) => (
              <li key={l.id} style={{ '--i': i } as CSSProperties} data-leg={l.line.id}>
                <KuponLeg leg={l} onMatch={onMatch} />
              </li>
            ))}
          </ol>
        </>
      )}
    </li>
  )
}

/** A Kupon the night can't fill: a quiet slip with the reason. */
function QuietSlip({ slot, left, hidden = false }: { slot: CouponSlot; left: number | null; hidden?: boolean }) {
  const { spec } = slot
  const wait = slot.why === 'waiting'
  // "Needs 3 games, one pick each" only when that is the reason: too few games still to come.
  const few = !wait && spec.perGame == null && left != null && left < spec.min
  return (
    <li className="ic-ku-slip quiet" id={`ic-ku-${spec.kind}`} hidden={hidden}>
      <div className="ic-ku-sh">
        <h3>
          <span>
            <Ico k={spec.kind} />
            {spec.title}
          </span>
        </h3>
        <span className="ic-ku-n">
          {wait ? (
            <>
              At <span className="num">19:00</span>
            </>
          ) : (
            'Not tonight'
          )}
        </span>
      </div>
      <p className="ic-ku-qp">
        {wait ? (
          <>
            Player bets usually come in after <span className="num">19:00</span>
          </>
        ) : few ? (
          <>
            Needs <span className="num">{spec.min}</span> games, one pick each.{' '}
            <span className="nw">
              <span className="num">{left}</span> {left === 1 ? 'is' : 'are'} left tonight.
            </span>
          </>
        ) : (
          <>
            The picks can't reach total odds of about <span className="num">{fmtOdds(spec.target)}</span>.
          </>
        )}
      </p>
    </li>
  )
}

/** The mark: a 36px face with a 16px club badge, or the two clubs as 24px discs. */
function Mark({ leg: l }: { leg: Leg }) {
  const g = l.line.game
  if (l.kind === 'player')
    return (
      <span className="ic-ku-mk face" aria-hidden="true">
        <PlayerHead player={{ id: l.line.playerId ?? 0, name: l.line.name }} team={l.line.team} size={36} />
        {l.line.team && <Disc team={l.line.team} size={16} />}
      </span>
    )
  return (
    <span className="ic-ku-mk pair" aria-hidden="true">
      <Disc team={g.away} size={24} />
      <Disc team={g.home} size={24} />
    </span>
  )
}

/** A club logo on a disc, lit by the club's colour (the one place club colour shows). */
function Disc({ team, size }: { team: string; size: number }) {
  return (
    <span className="ic-ku-disc" style={{ '--tc': teamLight(team) ?? 'transparent', '--s': `${size}px` } as CSSProperties}>
      <TeamLogo abbrev={team} size={size} fallback />
    </span>
  )
}

/** One leg: a single 64px button. A player's leg opens his player card, a game's leg the match card. */
function KuponLeg({ leg: l, onMatch }: { leg: Leg; onMatch?: OpenMatch }) {
  const card = usePlayerCard()
  const g = l.line.game
  const player = l.kind === 'player'
  const p = pctOf(l.chance)
  const res = l.result
  const got = gotOf(l)
  const why = legWhy(l)
  const side = player ? l.line.team : (betFace(l.line)?.dot ?? l.line.team)
  const sideOf: 'away' | 'home' = side === g.home ? 'home' : 'away'
  const who = whoOf(l)
  const open = player
    ? card && who.id > 0
      ? () => card.open(who)
      : null
    : onMatch
      ? () => onMatch(g.game_id, sideOf)
      : null
  const when = res === 'void' ? 'Sat out' : res ? got : clock(g.tip)
  const sub = player ? [STAT_NAME[l.stat], `${g.away} @ ${g.home}`, when] : [MARKET[l.stat], when]
  const words = [
    player ? `${l.line.name}, ${l.bet} ${STAT_UNIT[l.stat]}` : `${g.away} @ ${g.home}, ${MARKET[l.stat]} ${l.bet}`,
    res ? null : clock(g.tip),
    `odds ${oddOf(l).toFixed(2)}`,
    `our chance ${p}%`,
    res === 'won' ? `won, ${got.toLowerCase()}` : res === 'lost' ? `lost, ${got.toLowerCase()}` : null,
    res === 'void' ? 'sat out, counted at 1.00' : null,
    why,
  ]
    .filter(Boolean)
    .join(', ')
  const cls = `ic-ku-leg${res ? ` ${res}` : ''}`
  const body = (
    <span className="ic-ku-in" aria-hidden={open ? undefined : true}>
      <Mark leg={l} />
      <span className="who">
        <b>
          {res === 'won' && <Check className="rs" size={12} weight="bold" aria-hidden="true" />}
          {res === 'lost' && <X className="rs" size={12} weight="bold" aria-hidden="true" />}
          {player ? l.line.name : `${g.away} @ ${g.home}`}
        </b>
        <span>{sub.filter(Boolean).join(' · ')}</span>
      </span>
      <b className="bet num">
        {l.bet}
        {player && <small> {STAT_UNIT[l.stat]}</small>}
      </b>
      <b className="odd num">{oddOf(l).toFixed(2)}</b>
      <Chance value={l.chance} className="ch" />
      {why && <span className="why">{why}</span>}
    </span>
  )
  if (!open)
    return (
      <div className={cls}>
        <span className="sr-only">{words}</span>
        {body}
      </div>
    )
  return (
    <button
      type="button"
      className={cls}
      aria-haspopup="dialog"
      aria-label={`${words}. Opens the ${player ? 'player' : 'match'} card`}
      onPointerEnter={(e) => player && card && e.pointerType === 'mouse' && card.prefetch(who)}
      onPointerDown={() => player && card?.prefetch(who)}
      onClick={open}
    >
      {body}
    </button>
  )
}

/** Why not (Can 2026-11-22): single long shots where our chance beats what the odds need, each on its
 *  own slip like a one-pick Kupon. */
function WhyNot({ legs, onMatch }: { legs: Leg[]; onMatch?: OpenMatch }) {
  return (
    <section className="ic-ku-wn" aria-labelledby="ic-ku-wn-h">
      <div className="ic-ku-head">
        <h3 id="ic-ku-wn-h">Why not</h3>
        <span className="ic-ku-hint">
          Single bets at <span className="num">{fmtOdds(WHY_NOT.minOdd)}</span>+ where our chance is clearly above what
          the odds need
        </span>
      </div>
      <ol className="ic-ku-rail">
        {legs.map((l) => {
          const done = l.result != null && l.result !== 'void'
          return (
            <li key={l.id} className="ic-ku-slip wn">
              <ol className="ic-ku-legs" aria-label="Why not pick">
                <li data-leg={l.line.id}>
                  <KuponLeg leg={l} onMatch={onMatch} />
                </li>
              </ol>
              <p className="ic-ku-need">
                The odds need <b className="num">{pctOf(1 / l.odd)}%</b> · {done ? 'ours was' : 'ours'}{' '}
                <b className="num">{pctOf(l.chance)}%</b>
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
