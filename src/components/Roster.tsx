import { Lock, LockOpen, Users } from '@phosphor-icons/react'
import type { PlayerRef } from '../api/client'
import { injuryShort } from '../lib/injury'
import { shortValue, useRoundValues } from '../lib/tradeValue'
import { shortNames } from '../lib/todayMatchup'
import { PlayerBadges } from './PlayerBadges'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import './Roster.css'

interface Props {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
  onShop?: (id: number) => void
}

/** Signed with a real minus (U+2212), one decimal. */
function catValue(v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`
}

function catTone(v: number): string {
  return v > 0 ? ' ro-pos' : v < 0 ? ' ro-neg' : ''
}

/** Out (or close to it): a coral tag, and the name recedes. */
const OUT = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION', 'DOUBTFUL'])
/** A doubt, not an absence: an amber tag. */
const DOUBT = new Set(['DAY_TO_DAY', 'QUESTIONABLE'])
/** The default states say nothing. */
const QUIET = new Set(['ACTIVE', 'NORMAL', 'PROBABLE', ''])
const TAG_WORD: Record<string, string> = { QUESTIONABLE: 'Q', DOUBTFUL: 'D' }

function StatusTag({ status }: { status: string }) {
  if (QUIET.has(status)) return null
  const tone = OUT.has(status) ? ' ro-tag-out' : DOUBT.has(status) ? ' ro-tag-q' : ''
  return (
    <span className={`ro-tag${tone}`} title={status.replace(/_/g, ' ').toLowerCase()}>
      {TAG_WORD[status] ?? injuryShort(status)}
    </span>
  )
}

/**
 * One player: lock · face and name (one target that opens his card) · trade value · cat value · Shop.
 * Status shows only when it isn't the default: the injury tag, and "Droppable" on line 2.
 */
function RosterRow({
  p,
  short,
  kept,
  rounds,
  onToggleKeep,
  onShop,
}: {
  p: PlayerRef
  /** The phone name: his last name, unique within your roster ("Giannis" when the last is too long). */
  short: string
  kept: boolean
  rounds: ReturnType<typeof useRoundValues>
  onToggleKeep: (id: number) => void
  onShop?: (id: number) => void
}) {
  const out = OUT.has(p.injury_status)
  const drop = p.tier === 'droppable'
  const cv = catValue(p.value)
  const badges = p.badges?.length ? <PlayerBadges badges={p.badges} /> : null
  return (
    <li className={`ro-row${out || drop ? ' ro-recede' : ''}`}>
      <button
        type="button"
        className="ro-lock"
        aria-pressed={kept}
        onClick={() => onToggleKeep(p.id)}
        title={kept ? `Kept: ${p.name} stays out of trades and drops` : `Keep ${p.name} out of trades and drops`}
      >
        {kept ? <Lock size={18} weight="fill" aria-hidden="true" /> : <LockOpen size={18} aria-hidden="true" />}
        <span className="sr-only">Keep {p.name}</span>
      </button>
      <div className="ro-who">
        {/* The badges (Jewel, Hot, …) sit on the face's corner, on the player they mark. */}
        <span className="ro-face">
          <PlayerHead player={p} size={30} team={p.pro_team} />
          {badges && <span className="pb-quiet ro-face-bdg">{badges}</span>}
        </span>
        <span className="ro-txt">
          <span className="ro-l1">
            <PlayerLink player={p} className="ro-nm">
              <span className="ro-full">{p.name}</span>
              <span className="ro-short">{short}</span>
            </PlayerLink>
            <StatusTag status={p.injury_status} />
          </span>
          <span className="ro-l2">
            <span className="ro-l2-txt">
              {p.positions.join('/')}
              {drop && (
                <b title="Lightly owned and replaceable from free agency: the only players ever suggested as drops">
                  {' '}
                  · Droppable
                </b>
              )}
            </span>
          </span>
        </span>
      </div>
      <span className="ro-fig">
        <span className="ro-tv num">
          <span className="sr-only">, trade value </span>
          {shortValue(p.perceived_value, rounds)}
        </span>
        <span className={`ro-cv num${catTone(p.value)}`} aria-hidden="true">
          {cv} <em>cat</em>
        </span>
      </span>
      <span className={`ro-cvd num${catTone(p.value)}`}>
        <span className="sr-only">, category value </span>
        {cv}
      </span>
      {onShop && (
        <button
          type="button"
          className="ro-shop"
          onClick={() => onShop(p.id)}
          aria-label={`Shop ${p.name}`}
          title={`Find the best deals for ${p.name} in Trade Park`}
        >
          Shop
        </button>
      )}
    </li>
  )
}

/**
 * My Team > Your roster (Quiet Field): one row grammar at every width, no table rules, no boxes. The
 * Kept group shows only when someone is kept.
 */
export function Roster({ roster, keep, onToggleKeep, onShop }: Props) {
  const rounds = useRoundValues()
  const kept = roster.filter((p) => keep.includes(p.id))
  const rest = roster.filter((p) => !keep.includes(p.id))
  const names = shortNames(roster.map((p) => p.name))
  const rows = (ps: PlayerRef[], on: boolean, label: string) => (
    <ul className="ro-rows" aria-label={label}>
      {ps.map((p) => (
        <RosterRow
          key={p.id}
          p={p}
          short={names.get(p.name) ?? p.name}
          kept={on}
          rounds={rounds}
          onToggleKeep={onToggleKeep}
          onShop={onShop}
        />
      ))}
    </ul>
  )
  return (
    <section className={`ro${onShop ? '' : ' ro-noshop'}`} aria-labelledby="roster-title">
      <h2 id="roster-title" className="ro-title">
        <Users size={22} aria-hidden="true" />
        Your roster
      </h2>
      <div className="ro-ch" aria-hidden="true">
        <span className="ro-ch-keep">Keep</span>
        <span>Player</span>
        <span
          className="ro-ch-tv"
          title={`Trade value ${rounds ? 'as a draft round' : 'in auction dollars'}: draft-day rankings and prices fading into % owned, rest-of-season value in your categories and this season's production`}
        >
          Trade value
        </span>
        <span className="ro-ch-cv" title="Category value: z-scores summed over the league's categories">
          Cat value
        </span>
      </div>
      {kept.length > 0 ? (
        <>
          <h3 className="ro-sub">
            Kept
          </h3>
          {rows(kept, true, 'Kept')}
          {rest.length > 0 && (
            <>
              <h3 className="ro-sub">Everyone else</h3>
              {rows(rest, false, 'Everyone else')}
            </>
          )}
        </>
      ) : (
        rows(rest, false, 'Your players')
      )}
    </section>
  )
}
