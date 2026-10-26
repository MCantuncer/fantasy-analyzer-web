import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchShop, type AnalysisReport, type ShopDeal, type ShopReport } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { names, pct, ptsDiff, signedInt, tradeKey } from '../lib/format'
import { OddsChange } from './OddsChange'
import { TradeItem } from './Trades'
import { shortValue, useRoundValues, valueTitle } from '../lib/tradeValue'

export const MAX_PICKS = 4

const KIND = {
  win_win: { label: 'Win-win', title: 'Their team gets better in the categories they play for, too' },
  paper_win: { label: 'They win on paper', title: 'They get more trade value; you get the better fit' },
} as const

const TIERS = { core: 'Keeper', tradeable: 'Tradeable', droppable: 'Droppable', injured: 'Injured' } as const

interface Props {
  report: AnalysisReport
  keep: number[]
  creds: Credentials | null
  picks: number[]
  onPicks: (ids: number[]) => void
  searched: number[]
  onSearch: (ids: number[]) => void
}

function lastName(name: string) {
  const parts = name.split(' ')
  return parts.length > 1 && /^(Jr\.?|Sr\.?|II|III|IV)$/.test(parts[parts.length - 1])
    ? parts[parts.length - 2]
    : parts[parts.length - 1]
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

function sameSet(a: number[], b: number[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export function TradePark({ report, keep, creds, picks, onPicks, searched, onSearch }: Props) {
  const rounds = useRoundValues()
  const shop = useQuery({
    queryKey: ['shop', report.league.id, report.league.season, report.team_id, searched, keep, creds?.swid ?? null],
    queryFn: () => fetchShop(report.league.id, report.team_id, report.league.season, searched, keep, creds),
    enabled: searched.length > 0,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const toggle = (id: number) =>
    onPicks(picks.includes(id) ? picks.filter((p) => p !== id) : picks.length < MAX_PICKS ? [...picks, id] : picks)
  const current = searched.length > 0 && sameSet(picks, searched)

  return (
    <div className="park">
      <section className="card flush park-picker" aria-labelledby="park-pick-title">
        <div className="card-head">
          <div>
            <h2 id="park-pick-title">Who are you shopping?</h2>
            <p className="small muted">Pick up to {MAX_PICKS}. Deals send only players you pick.</p>
          </div>
        </div>
        <ul className="pick-list">
          {report.roster.map((p) => {
            const on = picks.includes(p.id)
            const full = !on && picks.length >= MAX_PICKS
            return (
              <li key={p.id}>
                <label className={on ? 'pick on' : full ? 'pick off' : 'pick'}>
                  <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(p.id)} />
                  <span className="pick-name">
                    <strong>{p.name}</strong>
                    <span className="small muted">
                      {p.positions.join(', ')}
                      {p.injury_status !== 'ACTIVE' && ` · ${p.injury_status.replace(/_/g, ' ').toLowerCase()}`}
                    </span>
                  </span>
                  <span className="pick-value num" title={valueTitle(rounds)}>
                    {shortValue(p.perceived_value, rounds)}
                  </span>
                  <span className={`badge tier-${p.tier}`}>{TIERS[p.tier]}</span>
                </label>
              </li>
            )
          })}
        </ul>
        <div className="park-go">
          <button type="button" disabled={!picks.length || (current && !shop.isError)} onClick={() => onSearch(picks)}>
            {picks.length === 0
              ? 'Pick players to shop'
              : current && shop.isFetching
                ? 'Searching…'
                : `Find deals for ${picks.length === 1 ? '1 player' : `${picks.length} players`}`}
          </button>
        </div>
      </section>

      <div className="park-results stack">
        {searched.length === 0 && (
          <section className="card park-empty">
            <span className="eyebrow">Trade Park</span>
            <h2>Shop your players to the whole league</h2>
            <p className="muted">
              Pick the players you want to move. Trade Park checks every other roster for deals the owner has a reason
              to accept, that look even or better for them on paper, and that help you more.
            </p>
          </section>
        )}
        {shop.isPending && searched.length > 0 && (
          <section className="card park-empty" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <h2>Checking every roster…</h2>
            <p className="muted">This takes a few seconds, or up to a minute if the server was asleep.</p>
          </section>
        )}
        {shop.isError && (
          <section className="card error stack">
            <h2>Couldn't search trades</h2>
            <p>{shop.error.message}</p>
            <div className="row">
              <button className="secondary" onClick={() => shop.refetch()}>
                Try again
              </button>
            </div>
          </section>
        )}
        {shop.data && <Results data={shop.data} />}
      </div>
    </div>
  )
}

function Results({ data }: { data: ShopReport }) {
  const [filter, setFilter] = useState<'all' | 'every' | number>('all')
  const deals = data.deals.filter((d) =>
    filter === 'all' ? true : filter === 'every' ? d.uses_all : d.give.some((p) => p.id === filter),
  )
  const [open, setOpen] = useState<string | null>(data.deals[0] ? tradeKey(data.deals[0]) : null)
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
              <span className={`tnum ${best.acceptance_label === 'likely' ? 'good' : 'warn'}`}>
                {pct(best.acceptance)} chance they accept
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
          <div className="card-head">
            <h2 id="park-deals">
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
              <div className="move-cols" aria-hidden="true">
                <span>You give</span>
                <span>You get</span>
                <span>With</span>
                <span>They accept</span>
                <span className="right">Playoff odds</span>
              </div>
              <ol className="move-list">
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
