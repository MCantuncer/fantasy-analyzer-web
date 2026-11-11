import {
  ArrowLeft,
  ArrowsLeftRight,
  CaretDown,
  Check,
  Diamond,
  Lock,
  Plus,
  Scales,
  Warning,
} from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { fetchOfferCheck, type AnalysisReport, type PlayerRef } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { injuryShort } from '../lib/injury'
import { teamColours } from '../lib/league'
import {
  MAX_SIDE,
  canCheck,
  cutsNeeded,
  decodeDeal,
  encodeDeal,
  EMPTY_DEAL,
  togglePlayer,
  type CheckDeal,
  type CheckMode,
  CHECK_PARAM,
  surname,
} from '../lib/tradeCheck'
import { useMediaQuery } from '../lib/useMediaQuery'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import { TradeCheckResult } from './TradeCheckResult'
import './TradeCheck.css'

const MODES: { id: CheckMode; label: string }[] = [
  { id: 'received', label: 'They Offered Me' },
  { id: 'sending', label: "I'm Sending It" },
]

const PARTNER_KEY = 'check-partner'

/**
 * The deal to open on: a shared link's deal, minus players who have since moved (`moved` counts
 * them), or else the last team checked against.
 */
function initialDeal(mine: PlayerRef[], others: AnalysisReport['league_rosters']): { deal: CheckDeal; moved: number } {
  const fromUrl = decodeDeal(new URLSearchParams(window.location.search).get(CHECK_PARAM))
  const partner = others.find((t) => t.team_id === fromUrl?.partner)
  if (fromUrl && partner) {
    const give = fromUrl.give.filter((id) => mine.some((p) => p.id === id))
    const get = fromUrl.get.filter((id) => partner.players.some((t) => t.player.id === id))
    const cut = mine.some((p) => p.id === fromUrl.cut) ? fromUrl.cut : null
    const moved = fromUrl.give.length - give.length + fromUrl.get.length - get.length
    return { deal: { ...fromUrl, give, get, cut: moved ? null : cut }, moved }
  }
  try {
    const last = Number(localStorage.getItem(PARTNER_KEY))
    if (others.some((t) => t.team_id === last)) return { deal: { ...EMPTY_DEAL, partner: last }, moved: 0 }
  } catch {
    // storage blocked: start with no team
  }
  return { deal: EMPTY_DEAL, moved: 0 }
}

const movedNote = (n: number) =>
  `${n === 1 ? 'A player' : `${n} players`} from this link ${n === 1 ? 'has' : 'have'} moved since, so ${
    n === 1 ? "he's" : "they're"
  } off the deal. Check it again.`

function writeDeal(d: CheckDeal) {
  const q = new URLSearchParams(window.location.search)
  const value = encodeDeal(d)
  if (value) q.set(CHECK_PARAM, value)
  else q.delete(CHECK_PARAM)
  window.history.replaceState(null, '', `?${q.toString()}`)
}

function Marks({ p, kept }: { p: PlayerRef; kept: boolean }) {
  const keystone = p.badges?.find((b) => b.kind === 'keystone')
  return (
    <>
      {p.injury_status !== 'ACTIVE' && <span className="tck-inj">{injuryShort(p.injury_status)}</span>}
      {kept && <Lock className="tck-mark" size={12} weight="fill" aria-label="You keep him" />}
      {keystone && <Diamond className="tck-mark" size={12} aria-label={`Keystone: ${keystone.category ?? ''}`} />}
    </>
  )
}

function Bench({
  side,
  players,
  picked,
  keep,
  full,
  wide,
  onToggle,
}: {
  side: 'give' | 'get'
  players: PlayerRef[]
  picked: number[]
  keep: number[]
  full: boolean
  wide: boolean
  onToggle: (id: number) => void
}) {
  return (
    <ul className={`tck-bench tck-bench-${side}`}>
      {players.map((p) => {
        const on = picked.includes(p.id)
        const kept = side === 'give' && keep.includes(p.id)
        const label = `${p.name}, ${p.positions.join('/')} ${p.pro_team}${
          p.injury_status !== 'ACTIVE' ? `, ${injuryShort(p.injury_status)}` : ''
        }${kept ? ', you keep him' : ''}`
        return (
          <li key={p.id}>
            <button
              type="button"
              className={`tck-row${on ? ' on' : ''}${!on && full ? ' full' : ''}`}
              aria-pressed={on}
              aria-label={label}
              onClick={() => onToggle(p.id)}
            >
              <span className="tck-face">
                <PlayerHead player={p} size={34} team={p.pro_team} />
                {on && (
                  <span className="tck-tick" aria-hidden="true">
                    <Check size={11} weight="bold" />
                  </span>
                )}
              </span>
              <span className="tck-who">
                <span className="tck-name">{wide ? p.name : surname(p.name)}</span>
                <span className="tck-meta">
                  {p.positions.join('/')} · {p.pro_team || 'FA'} <Marks p={p} kept={kept} />
                </span>
              </span>
              {wide && (
                <span className="tck-add" aria-hidden="true">
                  {on ? <Check size={16} weight="bold" /> : <Plus size={16} />}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Slots({
  players,
  side,
  onRemove,
}: {
  players: PlayerRef[]
  side: 'give' | 'get'
  onRemove: (id: number) => void
}) {
  return (
    <div className={`tck-slots tck-slots-${side}`}>
      {Array.from({ length: MAX_SIDE }, (_, i) => {
        const p = players[i]
        return p ? (
          <button
            key={p.id}
            type="button"
            className="tck-slot full"
            aria-label={`Remove ${p.name}`}
            onClick={() => onRemove(p.id)}
          >
            <PlayerHead player={p} size={40} team={p.pro_team} />
          </button>
        ) : (
          <span key={`empty-${i}`} className="tck-slot" aria-hidden="true">
            <Plus size={16} />
          </span>
        )
      })}
    </div>
  )
}

/** The tray: who goes each way, the cut warning, and the one primary button. */
function Tray({
  give,
  get,
  onRemove,
  onCheck,
  checkable,
}: {
  give: PlayerRef[]
  get: PlayerRef[]
  onRemove: (side: 'give' | 'get', id: number) => void
  onCheck?: () => void
  checkable: boolean
}) {
  const cuts = cutsNeeded({ give: give.map((p) => p.id), get: get.map((p) => p.id) })
  const shape = give.length && get.length ? `${give.length} for ${get.length}` : ''
  return (
    <div className="tck-tray" aria-live="polite">
      <div className="tck-tray-head">
        <span>You send</span>
        <span className="tck-shape num">{shape}</span>
        <span>You get</span>
      </div>
      <div className="tck-tray-row">
        <Slots players={give} side="give" onRemove={(id) => onRemove('give', id)} />
        <ArrowsLeftRight className="tck-swap" size={18} aria-hidden="true" />
        <Slots players={get} side="get" onRemove={(id) => onRemove('get', id)} />
      </div>
      <div className="tck-tray-names">
        <span>{give.map((p) => surname(p.name)).join(' · ')}</span>
        <span>{get.map((p) => surname(p.name)).join(' · ')}</span>
      </div>
      {cuts > 0 && (
        <p className="tck-cut-note">
          <Warning size={18} aria-hidden="true" />
          <span>
            <b>+{cuts} cut.</b> You get {get.length} and send {give.length}, so {cuts === 1 ? 'one' : cuts} of yours{' '}
            {cuts === 1 ? 'leaves' : 'leave'}. The check picks who; you can change it after.
          </span>
        </p>
      )}
      {onCheck && (
        <>
          <button type="button" className="tck-go" disabled={!checkable} onClick={onCheck}>
            <Scales size={20} aria-hidden="true" /> Check the Deal
          </button>
          {!checkable && <p className="tck-hint">Pick at least 1 a side.</p>}
        </>
      )}
    </div>
  )
}

interface Props {
  report: AnalysisReport
  keep: number[]
  creds: Credentials | null
}

/**
 * Check a Trade (Two-Way): build any trade with one team and see what it does to both teams.
 * Phones pick on both rosters side by side, then check; wider screens keep the rosters beside
 * the result and re-check as picks change.
 */
export function TradeCheck({ report, keep, creds }: Props) {
  const wide = useMediaQuery('(min-width: 1080px)')
  const others = useMemo(() => report.league_rosters.filter((t) => t.team_id !== report.team_id), [report])
  const colours = teamColours(
    report.season.map((r) => r.team_id),
    report.team_id,
  )
  const [opening] = useState(() => initialDeal(report.roster, others))
  const [deal, setDeal] = useState<CheckDeal>(opening.deal)
  // The deal last sent to the engine. Phones send it with the button; wide screens as picks settle.
  // A link whose players have moved waits for a look before it checks.
  const [checked, setChecked] = useState<CheckDeal | null>(() =>
    canCheck(opening.deal) && !opening.moved ? opening.deal : null,
  )
  const [limit, setLimit] = useState<'give' | 'get' | null>(null)

  useEffect(() => writeDeal(deal), [deal])
  // Leaving the check (Find Deals, another tab) takes the deal out of the URL.
  useEffect(() => () => writeDeal(EMPTY_DEAL), [])
  useEffect(() => {
    if (!wide || (opening.moved && deal === opening.deal)) return
    const t = window.setTimeout(() => setChecked(canCheck(deal) ? deal : null), 400)
    return () => window.clearTimeout(t)
  }, [deal, wide, opening])

  const partner = others.find((t) => t.team_id === deal.partner) ?? null
  const mine = report.roster
  const theirs = useMemo(() => partner?.players.map((t) => t.player) ?? [], [partner])
  const pick = (ids: number[], pool: PlayerRef[]) =>
    ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is PlayerRef => !!p)
  const give = pick(deal.give, mine)
  const get = pick(deal.get, theirs)

  const ref = { leagueId: report.league.id, season: report.league.season, teamId: report.team_id }
  const query = useQuery({
    queryKey: [
      'offer-check',
      ref.leagueId,
      ref.season,
      ref.teamId,
      checked && encodeDeal(checked),
      keep,
      creds?.swid ?? null,
    ],
    queryFn: () => fetchOfferCheck(ref, { ...checked!, partner: checked!.partner! }, keep, creds),
    enabled: !!checked && canCheck(checked),
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: wide ? keepPreviousData : undefined,
  })

  const update = (next: CheckDeal) => {
    setDeal(next)
    // Mode and cut don't change who moves, so the result follows them at once.
    if (checked && next.give === deal.give && next.get === deal.get && next.partner === deal.partner) setChecked(next)
  }
  const toggle = (side: 'give' | 'get', id: number) => {
    const next = togglePlayer(deal, side, id)
    setLimit(next === deal && !deal[side].includes(id) ? side : null)
    update(next)
  }
  const choosePartner = (id: number) => {
    try {
      localStorage.setItem(PARTNER_KEY, String(id))
    } catch {
      // storage blocked: the choice still holds for this visit
    }
    setChecked(null)
    setDeal({ ...EMPTY_DEAL, mode: deal.mode, partner: id })
  }

  const showResult = wide || (checked != null && canCheck(checked))
  const head = (
    <div className="tck-head">
      <div className="segmented tck-modes" role="group" aria-label="How the trade came about">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={deal.mode === m.id}
            onClick={() => update({ ...deal, mode: m.id })}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="tck-teams">
        <span className="tck-you">
          <TeamCrest name={report.team_name} colour="var(--gold)" size={26} />
          You
        </span>
        <ArrowsLeftRight size={16} className="tck-swap" aria-hidden="true" />
        <label className="tck-partner">
          {partner && <TeamCrest name={partner.team_name} colour={colours.get(partner.team_id)} size={26} />}
          <span className="tck-partner-name">{partner?.team_name ?? "Who's the trade with?"}</span>
          <CaretDown size={14} aria-hidden="true" />
          <select
            aria-label="Team you're trading with"
            value={deal.partner ?? ''}
            onChange={(e) => choosePartner(Number(e.target.value))}
          >
            {!partner && <option value="">Pick a team</option>}
            {others.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.team_name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )

  const benches = partner ? (
    <>
      <p className="tck-hint" aria-live="polite">
        {limit
          ? `${MAX_SIDE} a side is the limit.`
          : opening.moved && deal === opening.deal
            ? movedNote(opening.moved)
            : `Tap who moves, up to ${MAX_SIDE} a side.`}
      </p>
      <div className="tck-benches">
        <section aria-label="Your roster: who you send">
          {wide && <h3 className="tck-col-title">Your roster</h3>}
          <Bench
            side="give"
            players={mine}
            picked={deal.give}
            keep={keep}
            full={deal.give.length >= MAX_SIDE}
            wide={wide}
            onToggle={(id) => toggle('give', id)}
          />
        </section>
        <section aria-label={`${partner.team_name}: who you get`}>
          {wide && <h3 className="tck-col-title">Their roster</h3>}
          <Bench
            side="get"
            players={theirs}
            picked={deal.get}
            keep={[]}
            full={deal.get.length >= MAX_SIDE}
            wide={wide}
            onToggle={(id) => toggle('get', id)}
          />
        </section>
      </div>
    </>
  ) : (
    <p className="tck-empty">Pick the team the trade is with to see both rosters.</p>
  )

  const result =
    checked && partner ? (
      <TradeCheckResult
        query={query}
        deal={checked}
        give={pick(checked.give, mine)}
        get={pick(checked.get, theirs)}
        myName={report.team_name}
        partnerName={partner.team_name}
        partnerColour={colours.get(partner.team_id)}
        espn={{ leagueId: report.league.id, season: report.league.season, myTeamId: report.team_id }}
        teams={report.season.length}
        roster={mine}
        keep={keep}
        onCut={(cut) => update({ ...deal, cut })}
      />
    ) : null

  if (wide) {
    return (
      <div className="tck tck-wide">
        {head}
        <div className="tck-grid">
          {partner ? (
            <>
              <section className="card tck-col" aria-label="Your roster">
                <div className="tck-col-head">
                  <span>
                    <b>Your roster</b>
                    <small>Pick who you send</small>
                  </span>
                  <small className="num">
                    {deal.give.length} of {MAX_SIDE}
                  </small>
                </div>
                <Bench
                  side="give"
                  players={mine}
                  picked={deal.give}
                  keep={keep}
                  full={deal.give.length >= MAX_SIDE}
                  wide
                  onToggle={(id) => toggle('give', id)}
                />
              </section>
              <div className="tck-mid">
                {result ?? (
                  <>
                    <Tray give={give} get={get} checkable={false} onRemove={(s, id) => toggle(s, id)} />
                    <p className="tck-empty">
                      {limit
                        ? `${MAX_SIDE} a side is the limit.`
                        : 'Pick at least 1 a side. The check runs as you pick.'}
                    </p>
                  </>
                )}
              </div>
              <section className="card tck-col" aria-label={`${partner.team_name}'s roster`}>
                <div className="tck-col-head them">
                  <small className="num">
                    {deal.get.length} of {MAX_SIDE}
                  </small>
                  <span>
                    <b>Their roster</b>
                    <small>Pick who you get</small>
                  </span>
                </div>
                <Bench
                  side="get"
                  players={theirs}
                  picked={deal.get}
                  keep={[]}
                  full={deal.get.length >= MAX_SIDE}
                  wide
                  onToggle={(id) => toggle('get', id)}
                />
              </section>
            </>
          ) : (
            <p className="tck-empty">Pick the team the trade is with to see both rosters.</p>
          )}
        </div>
      </div>
    )
  }

  if (showResult && result) {
    return (
      <div className="tck">
        <div className="tck-bar">
          <button type="button" className="tck-back" onClick={() => setChecked(null)}>
            <ArrowLeft size={18} aria-hidden="true" /> Edit Deal
          </button>
          <span className="tck-chip">{MODES.find((m) => m.id === checked!.mode)!.label}</span>
        </div>
        {result}
      </div>
    )
  }

  return (
    <div className="tck">
      {head}
      {benches}
      {partner && (
        <Tray
          give={give}
          get={get}
          checkable={canCheck(deal)}
          onRemove={(s, id) => toggle(s, id)}
          onCheck={() => {
            setChecked(deal)
            window.scrollTo({ top: 0 })
          }}
        />
      )}
    </div>
  )
}
