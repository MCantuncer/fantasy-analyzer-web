import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, CaretUp, Lock, Plus, X } from '@phosphor-icons/react'
import { DealsSkeleton } from './Skeleton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchShop, type AnalysisReport, type ShopDeal, type ShopReport } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { names, ordinal, pct, ptsDiff, signedInt, tradeKey } from '../lib/format'
import { OddsChange } from './OddsChange'
import { injuryShort } from '../lib/injury'
import { PlayerHead } from './PlayerHead'
import { ACCEPTANCE, TradeItem } from './Trades'
import { teamColours } from '../lib/league'
import { useKeepRowInView } from '../lib/useKeepRowInView'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { dashRecord, lastName, oddsToday, teamLows, wantedCategories } from '../lib/tradeTable'
import { PlayerLink } from './PlayerCard'
import { TeamCrest } from './TeamCrest'
import { EndLabel, OddsPlate, TradeTable, Wants } from './TradeTable'
import './TradePark.css'
import { shortValue, useRoundValues, valueTitle } from '../lib/tradeValue'

export const MAX_PICKS = 4

// Picking runs the search once the picks have stayed the same this long.
const SETTLE_MS = 700

const KIND = {
  win_win: { label: 'Win-win', title: 'Their team gets better in the categories they play for, too' },
  paper_win: { label: 'They win on paper', title: 'They get more trade value; you get the better fit' },
} as const

interface Props {
  report: AnalysisReport
  keep: number[]
  creds: Credentials | null
  /** The players picked to shop, in the order picked (kept across tab switches). */
  picks: number[]
  onPicks: (ids: number[]) => void
}

function KindPill({ kind }: { kind: ShopDeal['kind'] }) {
  return (
    <span className={`kind-pill ${kind}`} title={KIND[kind].title}>
      {KIND[kind].label}
    </span>
  )
}

function give(d: ShopDeal) {
  return names(d.give) + (d.faab > 0 ? ` + $${d.faab} FAAB` : '')
}

function byId(ids: number[]) {
  return [...ids].sort((a, b) => a - b)
}

function sameSet(a: number[], b: number[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}

function lastNames(players: { name: string }[]) {
  return players.map((p) => lastName(p.name)).join(' + ')
}

/** "15-21-0" -> 15 wins, for the Every team order. */
function wins(record: string) {
  return Number.parseInt(record, 10) || 0
}

/**
 * Trade Park: the trading table seen from your end. Your whole roster sits in the lit give end,
 * and picking a player runs the search (once the picks settle). Before a pick the get end shows
 * what your build wants back and where every team is low. On phones the roster folds into a rail
 * of picked faces when the first result lands, once; Add opens it again.
 */
export function TradePark({ report, keep, creds, picks, onPicks }: Props) {
  const rounds = useRoundValues()
  const colours = teamColours(
    report.season.map((r) => r.team_id),
    report.team_id,
  )
  // A keeper can't be shopped, even one picked before it was kept.
  const shopping = picks.filter((id) => !keep.includes(id))
  const settled = useDebouncedValue(shopping, SETTLE_MS)
  const ids = useMemo(() => byId(settled), [settled])
  const shop = useQuery({
    queryKey: ['shop', report.league.id, report.league.season, report.team_id, ids, byId(keep), creds?.swid ?? null],
    queryFn: ({ signal }) => fetchShop(report.league.id, report.team_id, report.league.season, ids, keep, creds, signal),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 5 * 60_000,
  })

  // Phones: the roster folds into the rail once, when the first result lands; Add opens it again.
  const [folded, setFolded] = useState(false)
  const [hasFolded, setHasFolded] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const firstResult = shop.data != null && !shop.isPlaceholderData && ids.length > 0
  useEffect(() => {
    if (!firstResult || hasFolded) return
    const toggle = document.activeElement?.closest<HTMLElement>('[data-pick]')
    setHasFolded(true)
    setFolded(true)
    // Focus follows the player from his toggle to his chip, so it never falls to the page.
    if (toggle)
      requestAnimationFrame(() => {
        const rail = railRef.current
        const chip = rail?.querySelector<HTMLElement>(`[data-chip="${toggle.dataset.pick}"]`)
        ;(chip ?? rail?.querySelector<HTMLElement>('.park-add'))?.focus()
      })
  }, [firstResult, hasFolded])

  const toggle = (id: number) =>
    onPicks(
      picks.includes(id) ? picks.filter((p) => p !== id) : shopping.length < MAX_PICKS ? [...shopping, id] : picks,
    )

  const today = oddsToday(report.season, report.team_id)
  const wants = wantedCategories(report.categories)
  const pickedPlayers = shopping
    .map((id) => report.roster.find((p) => p.id === id))
    .filter((p): p is (typeof report.roster)[number] => p != null)
  const full = shopping.length >= MAX_PICKS

  // What the table is doing: nothing picked, waiting for the picks to settle or the first answer,
  // updating a result on screen, or showing one.
  const data = shopping.length > 0 && ids.length > 0 ? shop.data : undefined
  const shown = data ? data.offered.map((p) => p.id) : []
  const current = data != null && sameSet(shown, shopping) && !shop.isPlaceholderData
  const finding = shopping.length > 0 && !data && !shop.isError
  const updating = data != null && !current && !shop.isError
  const status = finding ? 'Finding deals' : updating ? 'Updating' : null
  const who = lastNames(pickedPlayers)

  const teams = report.builds
    .filter((b) => b.team_id !== report.team_id)
    .map((b) => {
      const row = report.season.find((r) => r.team_id === b.team_id)
      return { build: b, record: row?.current_record ?? '', lows: teamLows(b, report.season.length || 10) }
    })
    .sort((a, b) => wins(b.record) - wins(a.record))

  const roster = (
    <div className="park-roster">
      <div className="tt-list-head">
        <span className="tt-label">Your roster · {report.roster.length}</span>
        <span className="tt-label">Trade value</span>
      </div>
      <ul className="park-rows">
        {report.roster.map((p) => {
          const kept = keep.includes(p.id)
          const n = shopping.indexOf(p.id)
          const on = n >= 0
          const off = !on && full
          const out = p.injury_status !== 'ACTIVE' ? injuryShort(p.injury_status) : null
          return (
            <li key={p.id} className={on ? 'park-row park-on' : 'park-row'}>
              <span className={on ? 'park-face park-you' : 'park-face'}>
                <PlayerHead player={p} size={40} team={p.pro_team} />
              </span>
              <span className="park-who">
                <span className="park-nm">
                  <PlayerLink player={p} />
                </span>
                <span className="park-mt">
                  {p.positions.join(', ')} · {p.pro_team}
                  {out && <span className="tt-tag tt-out">{out}</span>}
                  {kept ? (
                    <span className="tt-status">
                      <Lock size={14} aria-hidden="true" />
                      Keeper
                    </span>
                  ) : (
                    p.tier === 'droppable' && (
                      <span className="tt-status">
                        <ArrowDown size={14} aria-hidden="true" />
                        Droppable
                      </span>
                    )
                  )}
                </span>
              </span>
              <span className="park-val num" title={valueTitle(rounds)}>
                {shortValue(p.perceived_value, rounds)}
              </span>
              {kept ? (
                <span className="park-tog park-lock" title="Kept: change in My Team">
                  <Lock size={18} aria-hidden="true" />
                </span>
              ) : (
                <button
                  type="button"
                  className="park-tog"
                  data-pick={p.id}
                  aria-pressed={on}
                  aria-disabled={off || undefined}
                  aria-label={`Shop ${p.name}`}
                  title={off ? `Up to ${MAX_PICKS} players` : undefined}
                  onClick={() => {
                    if (!off) toggle(p.id)
                  }}
                >
                  <span className="park-ring num">{on ? n + 1 : <Plus size={18} aria-hidden="true" />}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  const rail = hasFolded && pickedPlayers.length > 0 && (
    <div className="park-rail" ref={railRef}>
      {pickedPlayers.map((p) => (
        <span key={p.id} className="park-chip">
          <span className="park-face park-you">
            <PlayerHead player={p} size={32} team={p.pro_team} />
          </span>
          {lastName(p.name)}
          <button
            type="button"
            className="park-chip-x"
            data-chip={p.id}
            aria-label={`Stop shopping ${p.name}`}
            onClick={() => toggle(p.id)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button
        type="button"
        className="park-chip park-add"
        aria-expanded={!folded}
        onClick={() => setFolded(!folded)}
      >
        {folded ? <Plus size={16} aria-hidden="true" /> : <CaretUp size={16} aria-hidden="true" />}
        {folded ? 'Add' : 'Done'}
      </button>
    </div>
  )

  const announce = data && current
    ? data.deals[0]
      ? `Best deal: ${lastNames(data.deals[0].give)} for ${lastNames(data.deals[0].get)}, odds ${Math.round(data.deals[0].playoff_pct_before * 100)} to ${Math.round(data.deals[0].playoff_pct_after * 100)}`
      : `No deal for ${lastNames(data.offered)}`
    : undefined

  return (
    <div className={folded ? 'park-page park-folded' : 'park-page'}>
      <TradeTable
        label={shopping.length ? `Shopping ${who}` : 'Trade Park'}
        lit="give"
        oddsFirst={shopping.length === 0}
        busy={updating || finding}
        announce={announce}
        odds={
          today && (
            <OddsPlate
              label="Your playoff odds"
              value={today.pct}
              sub={`today · ${ordinal(today.rank)} best of ${today.teams}`}
              status={status}
            />
          )
        }
        give={
          <>
            <EndLabel end="give">
              <span className="tt-label">
                {shopping.length === 0 ? (
                  `Pick up to ${MAX_PICKS} · deals load as you pick`
                ) : (
                  <>
                    <span className="park-who-label">{who} · </span>
                    {shopping.length} of {MAX_PICKS}
                  </>
                )}
              </span>
            </EndLabel>
            {rail}
            {roster}
          </>
        }
        get={
          <>
            <EndLabel end="get" />
            {wants.length > 0 && (
              <div>
                <div className="tt-label park-block-h">What your build wants back</div>
                <Wants wants={wants} />
              </div>
            )}
            {shopping.length > 0 ? (
              <p className="park-note">
                {finding
                  ? `Checking ${teams.length} rosters for ${who}`
                  : updating
                    ? `Showing ${lastNames(data!.offered)} · updating for ${who}`
                    : shop.isError
                      ? `Couldn't search trades for ${who}`
                      : `Deals for ${who} are below the table`}
              </p>
            ) : (
              <div>
                <div className="tt-list-head">
                  <span className="tt-label">Every team</span>
                  <span className="tt-label">Low in</span>
                </div>
                <ul className="park-teams">
                  {teams.map(({ build, record, lows }) => (
                    <li key={build.team_id} className="park-team">
                      <TeamCrest name={build.team_name} colour={colours.get(build.team_id)} size={32} />
                      <span className="park-who">
                        <span className="park-tn">{build.team_name}</span>
                        {record && record !== '0-0-0' && <span className="park-rec num">{dashRecord(record)}</span>}
                      </span>
                      <span className="park-lows">
                        {lows.map((c) => (
                          <span key={c} className="tt-tag">
                            {c}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      />

      {shopping.length > 0 && (
        <div className="park-results stack">
          {finding && <DealsSkeleton />}
          {shop.isError && (
            <section className="card error stack">
              <h2>Couldn't search trades</h2>
              <p>{shop.error.message}</p>
              <div className="row">
                <button className="secondary" onClick={() => shop.refetch()}>
                  Try Again
                </button>
              </div>
            </section>
          )}
          {data && <Results data={data} colours={colours} />}
        </div>
      )}
    </div>
  )
}

function Results({ data, colours }: { data: ShopReport; colours: Map<number, string> }) {
  const [filter, setFilter] = useState<'all' | 'every' | number>('all')
  const deals = data.deals.filter((d) =>
    filter === 'all' ? true : filter === 'every' ? d.uses_all : d.give.some((p) => p.id === filter),
  )
  const [open, setOpen] = useState<string | null>(data.deals[0] ? tradeKey(data.deals[0]) : null)
  const keepRow = useKeepRowInView(open)
  const best = data.deals[0]
  const many = data.offered.length > 1
  const shopped = data.offered.map((p) => lastName(p.name)).join(' and ')
  const carried = data.targets.filter((t) => t.reason === 'carried').map((t) => t.category)

  return (
    <>
      {best ? (
        <section className="card park-hero" aria-labelledby="park-best">
          <div className="park-hero-main">
            <span className="eyebrow" id="park-best">
              Best deal · {best.partner_team_name}
            </span>
            <p className="park-deal">
              {give(best)} <span className="muted">→</span> {names(best.get)}
            </p>
            <div className="row park-pills">
              <KindPill kind={best.kind} />
              <span className={ACCEPTANCE[best.acceptance_label].tone}>
                Chance they say yes: {ACCEPTANCE[best.acceptance_label].label.toLowerCase()}
              </span>
            </div>
          </div>
          <div className="park-hero-odds">
            <span className="kpi-label">Your playoff odds</span>
            <span className="big-odds-figures num">
              <span className="before">{pct(best.playoff_pct_before)}</span>
              <span className="muted" aria-label="to">
                →
              </span>
              <span className="after">{pct(best.playoff_pct_after)}</span>
              <span className="delta-pill">{signedInt(ptsDiff(best.playoff_pct_before, best.playoff_pct_after))} pts</span>
            </span>
          </div>
        </section>
      ) : (
        <section className="card park-empty">
          <h2>No deal works for both sides</h2>
          <p className="muted">
            No team has a package for {shopped} that they'd likely accept and that helps you more. Try adding another
            player, or check back after a few more games.
          </p>
        </section>
      )}

      <p className="small muted park-targets">
        Aiming at{' '}
        {data.targets.map((t, i) => (
          <span key={t.category}>
            {i > 0 && (i === data.targets.length - 1 ? ' and ' : ', ')}
            <strong>{t.category}</strong> <span className="tnum">({pct(t.win_pct)} weekly win)</span>
          </span>
        ))}
        : the categories you're closest to winning or losing
        {carried.length > 0 && `, plus ${carried.join(', ')}, which ${shopped} supply`}. Your punts are left out.
        {data.faab_cap > 0 &&
          ` Deals can add up to $${data.faab_cap} of your $${data.faab_remaining} FAAB when it clearly helps; it never comes back.`}
      </p>

      {data.deals.length > 0 && (
        <section className="card flush trades-panel" aria-labelledby="park-deals">
          <div className={many ? 'card-head park-deals-head' : 'card-head'}>
            {/* With the filter showing, "All · 6" already gives the count, so the heading is for screen readers only. */}
            <h2 id="park-deals" className={many ? 'sr-only' : undefined}>
              {data.deals.length} {data.deals.length === 1 ? 'deal' : 'deals'}
            </h2>
            {many && (
              <div className="segmented" role="group" aria-label="Show deals with">
                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                  All · {data.deals.length}
                </button>
                <button type="button" aria-pressed={filter === 'every'} onClick={() => setFilter('every')}>
                  {data.offered.length === 2 ? 'Both' : `All ${data.offered.length}`} ·{' '}
                  {data.deals.filter((d) => d.uses_all).length}
                </button>
                {data.offered.map((p) => (
                  <button key={p.id} type="button" aria-pressed={filter === p.id} onClick={() => setFilter(p.id)}>
                    {lastName(p.name)} · {data.deals.filter((d) => d.give.some((g) => g.id === p.id)).length}
                  </button>
                ))}
              </div>
            )}
          </div>
          {deals.length === 0 ? (
            <p className="empty">No deal in this group. Pick another filter.</p>
          ) : (
            <>
              <ol className="move-list" onClickCapture={keepRow}>
                {deals.map((d, i) => {
                  const key = tradeKey(d)
                  const isOpen = open === key
                  return (
                    <TradeItem
                      key={key}
                      trade={d}
                      id={`park-${i}`}
                      open={isOpen}
                      onToggle={() => setOpen(isOpen ? null : key)}
                      why="Why it works"
                      faab={d.faab}
                      tag={<KindPill kind={d.kind} />}
                      feedbackSource="shop"
                      colour={colours.get(d.partner_team_id)}
                      teamCount={colours.size || undefined}
                    />
                  )
                })}
              </ol>
            </>
          )}
        </section>
      )}

      <section className="card flush" aria-labelledby="park-teams">
        <div className="card-head">
          <div>
            <h2 id="park-teams">Every team</h2>
            <p className="small muted">Each team's best deal for {shopped}</p>
          </div>
        </div>
        <ul className="market">
          {data.teams.map((t) => (
            <li key={t.team_id}>
              <span className="market-team">
                <strong>{t.team_name}</strong>
                {t.record !== '0-0-0' && <span className="small muted tnum"> {t.record}</span>}
              </span>
              {t.best ? (
                <>
                  <span className="market-deal">
                    {give(t.best)} <span className="muted">→</span> {names(t.best.get)}
                  </span>
                  <OddsChange before={t.best.playoff_pct_before} after={t.best.playoff_pct_after} />
                </>
              ) : (
                <span className="market-deal muted">
                  {t.deals_found > 0
                    ? `${t.deals_found} ${t.deals_found === 1 ? 'deal passes' : 'deals pass'} the checks, but none raises your playoff odds`
                    : 'No deal that works for both'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
