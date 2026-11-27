import { useQuery } from '@tanstack/react-query'
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretRight,
  Lock,
  MagnifyingGlass,
  PaperPlaneTilt,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useMemo, useRef, useState } from 'react'
import { fetchTarget } from '../api/client'
import type { AnalysisReport, PlayerRef, TargetOffer, TargetReport } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { injuryShort } from '../lib/injury'
import { teamColours } from '../lib/league'
import { ordinal, pct, signed } from '../lib/format'
import type { CheckDeal } from '../lib/tradeCheck'
import { dashRecord, lastName, oddsToday, strongIn, wantedCategories } from '../lib/tradeTable'
import { shortValue, useRoundValues, valueTitle } from '../lib/tradeValue'
import { CatStrip } from './CatStrip'
import { MaybeHandshake } from './MaybeHandshake'
import { DealChips, PlayerLink } from './PlayerCard'
import { PlayerInline } from './PlayerInline'
import { HeadStack, PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'
import { EndLabel, OddsPlate, TheirSide, TradeTable, Wants, type CrestTeam } from './TradeTable'
import { ACCEPTANCE } from './Trades'
import './TradeFor.css'

const FIT = {
  great: { label: 'Great fit', tone: 'good' },
  good: { label: 'Good fit', tone: 'good' },
  small: { label: 'Small upgrade', tone: 'warn' },
  none: { label: "Doesn't help you", tone: 'bad' },
} as const

const ANGLE: Record<TargetOffer['angle'], string> = {
  best: 'Best offer',
  safer: 'Safer',
  cheaper: 'Cheaper',
  alternative: 'Another way',
}

// The default list: the players who would help you most.
const SUGGESTED = 8
// The list while searching.
const FOUND = 30
// "What you can pay with": your most valued players, droppables left out.
const PAY_WITH = 7
// "Also on {team}": his teammates who help you most.
const ALSO = 2
// The API builds at most this many offers.
const MAX_OFFERS = 3
// The sticky top bar and tab row: picking from the foot scrolls the table back under them.
const TOP_OFFSET = 128

interface Candidate {
  player: PlayerRef
  gain: number
  teamId: number
  teamName: string
}

interface Props {
  report: AnalysisReport
  keep: number[]
  creds: Credentials | null
  /** Opens Check a Trade filled in with a deal. */
  onCheck: (deal: CheckDeal) => void
}

function outWord(p: PlayerRef) {
  return p.injury_status !== 'ACTIVE' ? injuryShort(p.injury_status) : null
}

function lastNames(players: { name: string }[]) {
  return players.map((p) => lastName(p.name)).join(' + ')
}

/** Status only when it matters: an injury word, or the keeper lock. */
function Status({ player, kept }: { player: PlayerRef; kept: boolean }) {
  const o = outWord(player)
  return (
    <>
      {o && <span className="tt-tag tt-out">{o}</span>}
      {kept && (
        <span className="tt-status" title="Never goes in an offer">
          <Lock size={14} aria-hidden="true" />
          Keeper
        </span>
      )}
    </>
  )
}

/**
 * Trade For: the trading table seen from their end. The right end holds the search and the best
 * fits for your build, the left end what you can pay with; once a player is picked his card and
 * what he does for you take the right end, and his owner, the offers and your players they'd
 * value take the left.
 */
export function TradeFor({ report, keep, creds, onCheck }: Props) {
  const rounds = useRoundValues()
  const league = report.league
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  // Typing reopens the list over a picked player, until the next pick.
  const [browsing, setBrowsing] = useState(false)
  const [offerIndex, setOfferIndex] = useState(0)
  const tableRef = useRef<HTMLDivElement>(null)

  const colours = useMemo(
    () =>
      teamColours(
        league.teams.map((x) => x.id),
        report.team_id,
      ),
    [league.teams, report.team_id],
  )
  const all = useMemo<Candidate[]>(
    () =>
      report.league_rosters.flatMap((t) =>
        t.players.map((p) => ({ player: p.player, gain: p.my_cats_gain, teamId: t.team_id, teamName: t.team_name })),
      ),
    [report.league_rosters],
  )
  const today = oddsToday(report.season, report.team_id)
  const wants = wantedCategories(report.categories)
  const strong = Object.fromEntries(
    wants.map((w) => [
      w.category,
      strongIn(report.builds, w.category, report.team_id).map<CrestTeam>((b) => ({
        id: b.team_id,
        name: b.team_name,
        colour: colours.get(b.team_id),
      })),
    ]),
  )

  const target = useQuery({
    queryKey: ['target', league.id, league.season, report.team_id, playerId, [...keep].sort(), creds?.swid ?? null],
    queryFn: ({ signal }) => fetchTarget(league.id, report.team_id, league.season, playerId!, keep, creds, signal),
    enabled: playerId !== null,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const pick = (id: number, scroll = false) => {
    setPlayerId(id)
    setBrowsing(false)
    setOfferIndex(0)
    if (scroll && tableRef.current) {
      const top = tableRef.current.getBoundingClientRect().top + window.scrollY - TOP_OFFSET
      if (window.scrollY > top) window.scrollTo({ top })
    }
  }
  const clear = () => {
    setPlayerId(null)
    setQuery('')
    setBrowsing(false)
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? all.filter((c) => c.player.name.toLowerCase().includes(q) || c.teamName.toLowerCase().includes(q)).slice(0, FOUND)
    : [...all].sort((a, b) => b.gain - a.gain).slice(0, SUGGESTED)
  const picked = playerId !== null ? all.find((c) => c.player.id === playerId) : undefined

  const search = (
    <div className="tf-search">
      <MagnifyingGlass size={18} aria-hidden="true" />
      <label htmlFor="target-query" className="sr-only">
        Search players or teams
      </label>
      <input
        id="target-query"
        type="search"
        placeholder="Search players or teams"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setBrowsing(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && playerId !== null) setBrowsing(false)
        }}
        autoComplete="off"
      />
      {q && <span className="tt-label tf-found num">{shown.length} found</span>}
    </div>
  )

  const fitList = (
    <div>
      <div className="tf-colh">
        <span>{q ? 'Rostered players' : 'Best fits for your build'}</span>
        <span className="tf-colh-gain">Cats a week</span>
        <span className="tf-colh-val">Value</span>
      </div>
      {shown.length === 0 ? (
        <p className="tf-none">No rostered player matches “{query}”.</p>
      ) : (
        <ul className="tf-rows">
          {shown.map((c) => (
            <li key={c.player.id}>
              <FitRow
                c={c}
                colour={colours.get(c.teamId) ?? 'var(--muted)'}
                selected={c.player.id === playerId}
                onPick={() => pick(c.player.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  if (!picked) {
    const pay = [...report.roster]
      .filter((p) => p.tier !== 'droppable')
      .sort((a, b) => b.perceived_value - a.perceived_value)
      .slice(0, PAY_WITH)
    return (
      <div className="tf" ref={tableRef}>
        <TradeTable
          label="Trade For"
          lit="get"
          oddsFirst
          odds={today && <OddsPlate label="Your playoff odds" value={today.pct} sub={rankLine(today)} />}
          get={
            <>
              <EndLabel end="get" />
              {search}
              {fitList}
              {wants.length > 0 && (
                <div>
                  <div className="tt-label tf-block-h">What your build wants</div>
                  <Wants wants={wants} strong={strong} />
                </div>
              )}
            </>
          }
          give={
            <>
              <EndLabel end="give">
                <span className="tt-label">What you can pay with</span>
              </EndLabel>
              <ul className="tf-rows">
                {pay.map((p) => (
                  <li key={p.id} className="tf-row tf-pay">
                    <PlayerHead player={p} size={40} team={p.pro_team} />
                    <span className="tf-who">
                      <span className="tf-nm">
                        <PlayerLink player={p} />
                      </span>
                      <span className="tf-mt">
                        {p.positions.join(', ')} · {p.pro_team}
                        <Status player={p} kept={keep.includes(p.id)} />
                      </span>
                    </span>
                    <span className="tf-val num" title={valueTitle(rounds)}>
                      {shortValue(p.perceived_value, rounds)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          }
        />
      </div>
    )
  }

  const data: TargetReport | undefined = target.data?.target.id === picked.player.id ? target.data : undefined
  const offer = data && data.offers.length > 0 ? data.offers[Math.min(offerIndex, data.offers.length - 1)] : undefined
  const him = data?.target ?? picked.player
  const fit = data ? FIT[data.fit.label] : null
  const ownerId = data?.owner.team_id ?? picked.teamId
  const ownerName = data?.owner.team_name ?? picked.teamName
  const ownerRow = report.season.find((r) => r.team_id === ownerId)
  const also = all
    .filter((c) => c.teamId === ownerId && c.player.id !== him.id)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, ALSO)
  const espn = `https://fantasy.espn.com/basketball/team?leagueId=${league.id}&teamId=${ownerId}&seasonId=${league.season}`
  const teams = league.teams.length || undefined
  const check = (give: number[], get: number[], cut: number | null = null) =>
    onCheck({ partner: ownerId, give, get, mode: 'sending', cut })

  let odds = null
  if (offer) {
    odds = (
      <OddsPlate
        label="Your playoff odds"
        value={offer.playoff_pct_after}
        from={offer.playoff_pct_before}
        them={
          offer.partner_playoff_pct_before != null && offer.partner_playoff_pct_after != null
            ? { before: offer.partner_playoff_pct_before, after: offer.partner_playoff_pct_after }
            : null
        }
      />
    )
  } else if (data) {
    odds = (
      <OddsPlate
        label="Your odds with him"
        value={data.fit.playoff_pct_after}
        from={data.fit.playoff_pct_before}
        note={
          <>
            Ceiling: he comes free
            {data.fit.my_drop && (
              <>
                , <PlayerInline player={data.fit.my_drop} /> goes
              </>
            )}
          </>
        }
      />
    )
  } else if (today) {
    odds = (
      <OddsPlate label="Your playoff odds" value={today.pct} sub="today" status={target.isError ? null : 'Building offers'} />
    )
  }

  const announce = data
    ? offer
      ? `${ANGLE[offer.angle]}: ${lastNames(offer.give)} for ${lastNames(offer.get)}, odds ${Math.round(offer.playoff_pct_before * 100)} to ${Math.round(offer.playoff_pct_after * 100)}`
      : `No offer to send for ${him.name}`
    : target.isError
      ? `Couldn't build offers for ${him.name}`
      : `Building offers for ${him.name}`

  return (
    <div className="tf" ref={tableRef}>
      <TradeTable
        label={`Trading for ${him.name}`}
        lit="get"
        busy={target.isFetching}
        announce={announce}
        odds={odds}
        get={
          <>
            <EndLabel end="get">
              <button type="button" className="tf-clear" aria-label={`Clear ${him.name}`} onClick={clear}>
                <X size={18} aria-hidden="true" />
              </button>
            </EndLabel>
            {search}
            {browsing ? (
              fitList
            ) : (
              <div className="tf-card">
                <PlayerHead player={him} size={64} team={him.pro_team} />
                <div className="tf-card-text">
                  <h2 className="tf-card-nm">
                    <PlayerLink player={him} />
                  </h2>
                  <div className="tf-mt">
                    {him.positions.join('/')} · {him.pro_team} · <b className="num">{shortValue(him.perceived_value, rounds)}</b>{' '}
                    trade value
                    <Status player={him} kept={false} />
                  </div>
                  <div className="tf-fitw">
                    {fit && <span className={`tf-fitw-word ${fit.tone}`}>{fit.label}</span>}
                    <span className="num">{signed(data?.fit.my_cats_gain ?? picked.gain)} cats a week</span>
                  </div>
                </div>
              </div>
            )}
          </>
        }
        get2={
          data ? (
            <CatStrip
              changes={data.fit.category_changes}
              categories={league.categories.length ? league.categories : undefined}
              title="What he does for you"
              summary={
                <>
                  <span className={`num tf-sum ${data.fit.my_cats_gain >= 0 ? 'good' : 'bad'}`}>
                    {signed(data.fit.my_cats_gain)}
                  </span>{' '}
                  categories won a week
                </>
              }
            />
          ) : target.isError ? undefined : (
            <span className="tt-skel" style={{ height: 112 }} aria-hidden="true" />
          )
        }
        give={
          <>
            <EndLabel end="give">
              {data && (
                <span className="tt-label num">
                  {data.offers.length} of {MAX_OFFERS} offers
                </span>
              )}
            </EndLabel>
            <div className="tf-owner">
              <span className="tt-label">His owner</span>
              <div className="tf-partner">
                <TeamCrest name={ownerName} colour={colours.get(ownerId)} size={32} />
                <div>
                  <div className="tf-partner-nm">{ownerName}</div>
                  <div className="tf-partner-mt num">
                    {[
                      ownerRow && ownerRow.current_record !== '0-0-0' ? dashRecord(ownerRow.current_record) : null,
                      `${pct(data?.owner.playoff_pct ?? ownerRow?.playoff_pct ?? 0)} playoff odds`,
                      data?.owner.outside_playoffs ? 'outside the playoff spots' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </div>
              {data && <OwnerFacts data={data} />}
              {data?.owner.target_is_star && (
                <p className="tf-note">
                  <PlayerInline player={him} /> is one of their two most valued players, so expect to overpay on paper.
                </p>
              )}
            </div>
            {target.isError ? (
              <div className="tf-block tt-fade">
                <WarningCircle size={20} aria-hidden="true" />
                <b>Couldn't build offers</b>
                <p>{target.error.message}</p>
                <div className="tt-actions">
                  <button type="button" className="tt-btn" onClick={() => target.refetch()}>
                    <ArrowClockwise size={18} aria-hidden="true" />
                    Try Again
                  </button>
                </div>
              </div>
            ) : !data ? (
              <div className="tf-loading" aria-hidden="true">
                <span className="tt-skel" style={{ height: 22, width: '60%' }} />
                <span className="tt-skel" style={{ height: 136 }} />
                <span className="tt-skel" style={{ height: 200 }} />
              </div>
            ) : (
              <div className="tf-offers tt-fade">
                {!offer ? (
                  <div className="tf-block">
                    <PaperPlaneTilt size={20} aria-hidden="true" />
                    <b>No offer to send</b>
                    <p>
                      No package for <PlayerInline player={him} /> helps you and looks like a win for {ownerName}.
                    </p>
                    <div className="tt-actions">
                      <button type="button" className="tt-btn" onClick={() => check([], [him.id])}>
                        <MaybeHandshake size={18} />
                        Check a Trade With Them
                      </button>
                      <a className="tt-btn tt-btn-ghost" href={espn} target="_blank" rel="noreferrer">
                        Propose on ESPN
                        <ArrowSquareOut size={18} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="tf-offer-block">
                    {data.note && <p className="tf-note">{data.note}</p>}
                    <ol className="tf-offer-list">
                      {data.offers.map((o, i) => {
                        const on = o === offer
                        return (
                          <li key={`${o.give.map((p) => p.id).join('.')}-${o.get.map((p) => p.id).join('.')}`}>
                            <OfferRow offer={o} on={on} onPick={() => setOfferIndex(i)} />
                            {on && (
                              <div className="tf-offer-open">
                                <DealChips deal={o} />
                                <TheirSide
                                  partner={ownerName}
                                  pitch={o.pitch}
                                  needs={o.pitch_needs}
                                  teams={teams}
                                  valueGet={o.value_they_get}
                                  valueGive={o.value_they_give}
                                  theirCats={o.their_cats_gain}
                                  rounds={rounds}
                                  actions={
                                    <button
                                      type="button"
                                      className="tt-btn"
                                      onClick={() =>
                                        check(
                                          o.give.map((p) => p.id),
                                          o.get.map((p) => p.id),
                                          o.my_drop?.id ?? null,
                                        )
                                      }
                                    >
                                      <MaybeHandshake size={18} />
                                      Check This Trade
                                    </button>
                                  }
                                />
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                    <a className="tt-btn tt-btn-ghost tf-espn" href={espn} target="_blank" rel="noreferrer">
                      Propose on ESPN
                      <ArrowSquareOut size={18} aria-hidden="true" />
                    </a>
                  </div>
                )}
                {data.owner.would_value.length > 0 && (
                  <div>
                    <div className="tt-list-head">
                      <span className="tt-label">Your players they’d value most</span>
                      <span className="tt-label">Their cats a week</span>
                    </div>
                    <ul className="tf-rows">
                      {data.owner.would_value.map((w) => {
                        const kept = keep.includes(w.player.id)
                        return (
                          <li key={w.player.id} className="tf-row tf-wrow">
                            <PlayerHead player={w.player} size={40} team={w.player.pro_team} />
                            <span className="tf-who">
                              <span className="tf-nm">
                                <PlayerLink player={w.player} />
                              </span>
                              <span className="tf-mt">
                                <Status player={w.player} kept={kept} />
                                {w.helps.length > 0 && <span className="tf-helps">helps their {w.helps.join(', ')}</span>}
                              </span>
                            </span>
                            <span
                              className={`tf-gain num ${w.their_cats_gain > 0 ? 'good' : w.their_cats_gain < 0 ? 'bad' : ''}`}
                            >
                              {signed(w.their_cats_gain)}
                            </span>
                            {kept ? (
                              <span className="tt-label tf-not">Not offered</span>
                            ) : (
                              <button
                                type="button"
                                className="tt-btn tt-btn-ghost tf-check"
                                aria-label={`Check ${lastName(w.player.name)} for ${lastName(him.name)}`}
                                onClick={() => check([w.player.id], [him.id])}
                              >
                                <MaybeHandshake size={18} />
                                Check
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        }
        foot={
          also.length > 0 && (
            <div className="tf-also">
              <div className="tf-also-h">
                <span className="tt-label">Also on {ownerName}</span>
                <span className="tt-label">Cats a week · Value</span>
              </div>
              <ul className="tf-also-l">
                {also.map((c) => (
                  <li key={c.player.id}>
                    <FitRow c={c} onPick={() => pick(c.player.id, true)} />
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      />
    </div>
  )
}

function rankLine(t: { rank: number; teams: number }) {
  return `today · ${ordinal(t.rank)} best of ${t.teams}`
}

/** A player you could trade for: face, name, position and owner (or club), fit and value. */
function FitRow({
  c,
  colour,
  selected = false,
  onPick,
}: {
  c: Candidate
  /** The owner's crest colour. Leave out to show his NBA club instead of the owner (rows of one team). */
  colour?: string
  selected?: boolean
  onPick: () => void
}) {
  const rounds = useRoundValues()
  const o = outWord(c.player)
  return (
    <button type="button" className="tf-row tf-fit" aria-pressed={selected} onClick={onPick}>
      <PlayerHead player={c.player} size={40} team={c.player.pro_team} />
      <span className="tf-who">
        <span className="tf-nm">{c.player.name}</span>
        <span className="tf-mt">
          {c.player.positions.join('/')} ·{' '}
          {colour !== undefined ? (
            <>
              <TeamCrest name={c.teamName} colour={colour} size={16} />
              {c.teamName}
            </>
          ) : (
            c.player.pro_team
          )}
          {o && <span className="tt-tag tt-out">{o}</span>}
        </span>
      </span>
      <span className={`tf-gain num ${c.gain >= 0.05 ? 'good' : c.gain < 0 ? 'bad' : ''}`}>
        <span className="sr-only">, categories won a week </span>
        {signed(c.gain)}
      </span>
      <span className="tf-val num">
        <span className="sr-only">, trade value </span>
        {shortValue(c.player.perceived_value, rounds)}
      </span>
      <CaretRight className="tf-chev" size={16} aria-hidden="true" />
    </button>
  )
}

/** Needs, Strong in and Punts as neutral tags. */
function OwnerFacts({ data }: { data: TargetReport }) {
  const o = data.owner
  const facts: [string, string[]][] = [
    ['Needs', o.needs],
    ['Strong in', o.build.strong],
    ['Punts', o.punts],
  ]
  return (
    <dl className="tf-facts">
      {facts.map(([k, cats]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>
            {cats.length
              ? cats.map((c) => (
                  <span key={c} className="tt-tag">
                    {c}
                  </span>
                ))
              : 'Nothing'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** One offer: the angle, who goes each way, the accept word and your odds. On the table when picked. */
function OfferRow({ offer: o, on, onPick }: { offer: TargetOffer; on: boolean; onPick: () => void }) {
  const acc = ACCEPTANCE[o.acceptance_label]
  return (
    <button type="button" className="tf-offer" aria-current={on || undefined} onClick={onPick}>
      <span className="tf-offer-top">
        <span className="tf-offer-angle">{ANGLE[o.angle]}</span>
        <span className={`tf-offer-acc ${acc.tone}`}>
          <span className="sr-only">, chance they say yes: </span>
          {acc.label}
        </span>
      </span>
      <span className="tf-offer-swap">
        <span className="tf-offer-side">
          <HeadStack players={o.give} size={28} />
          <span className="tf-offer-names">{lastNames(o.give)}</span>
        </span>
        <span className="tf-offer-to" aria-hidden="true">
          →
        </span>
        <span className="sr-only"> for </span>
        <span className="tf-offer-side">
          <HeadStack players={o.get} size={28} />
          <span className="tf-offer-names">{lastNames(o.get)}</span>
        </span>
      </span>
      <span className="tf-offer-odds num">
        <span className="sr-only">, your playoff odds </span>
        {pct(o.playoff_pct_before)} → <b>{pct(o.playoff_pct_after)}</b>
      </span>
    </button>
  )
}
