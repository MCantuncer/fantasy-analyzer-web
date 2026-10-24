import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchTarget } from '../api/client'
import type { AnalysisReport, TargetOffer, TargetReport, TradeTarget } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { names, pct } from '../lib/format'
import { OddsMeter } from './BestMove'
import { ImpactBars } from './ImpactBars'
import { OddsChange } from './OddsChange'
import { ACCEPTANCE, CopyButton } from './Trades'

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

function cats(x: number) {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`
}

function dollars(x: number) {
  return `$${Math.round(x)}`
}

interface Candidate extends TradeTarget {
  teamName: string
}

function Picker({
  report,
  selected,
  onPick,
}: {
  report: AnalysisReport
  selected: number | null
  onPick: (id: number) => void
}) {
  const [query, setQuery] = useState('')
  const all = useMemo<Candidate[]>(
    () => report.league_rosters.flatMap((t) => t.players.map((p) => ({ ...p, teamName: t.team_name }))),
    [report.league_rosters],
  )
  const q = query.trim().toLowerCase()
  const shown = q
    ? all.filter((c) => c.player.name.toLowerCase().includes(q) || c.teamName.toLowerCase().includes(q)).slice(0, 30)
    : [...all].sort((a, b) => b.my_cats_gain - a.my_cats_gain).slice(0, SUGGESTED)

  return (
    <section className="card flush" aria-labelledby="pick-target-title">
      <div className="card-head">
        <h2 id="pick-target-title">Pick a player</h2>
      </div>
      <div className="target-search">
        <label htmlFor="target-query" className="sr-only">
          Search players or teams
        </label>
        <input
          id="target-query"
          type="search"
          placeholder="Search any rostered player or team"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <div className="small muted">{q ? `${shown.length} found` : 'Best fits for your build'}</div>
      </div>
      {shown.length === 0 ? (
        <p className="empty">No rostered player matches “{query}”.</p>
      ) : (
        <ul className="target-list">
          {shown.map((c) => (
            <li key={c.player.id}>
              <button
                type="button"
                className={c.player.id === selected ? 'target-row selected' : 'target-row'}
                aria-pressed={c.player.id === selected}
                onClick={() => onPick(c.player.id)}
              >
                <span className="target-who">
                  <strong>{c.player.name}</strong>
                  <span className="small muted">
                    {c.player.positions.join('/')} · {c.teamName}
                  </span>
                </span>
                <span className="target-nums num">
                  <span title="Trade value in auction dollars">{dollars(c.player.perceived_value)}</span>
                  <span
                    className={c.my_cats_gain >= 0.05 ? 'good' : c.my_cats_gain < 0 ? 'bad' : 'muted'}
                    title="Categories won per week if you added him"
                  >
                    {cats(c.my_cats_gain)}
                  </span>
                </span>
                <svg className="target-cta" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5l4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Fit({ data }: { data: TargetReport }) {
  const fit = FIT[data.fit.label]
  const t = data.target
  return (
    <section className="card best" aria-labelledby="target-title">
      <div className="target-head">
        <div>
          <span className="eyebrow">Trade for</span>
          <h2 id="target-title" className="target-name">
            {t.name}
          </h2>
          <div className="small muted">
            {t.positions.join('/')} · {data.owner.team_name} · trade value {dollars(t.perceived_value)}
          </div>
        </div>
        <span className={`badge fit-${fit.tone}`}>{fit.label}</span>
      </div>
      <OddsMeter before={data.fit.playoff_pct_before} after={data.fit.playoff_pct_after} />
      <p className="small muted" style={{ margin: 0 }}>
        If you added him for nothing{data.fit.my_drop ? ` and dropped ${data.fit.my_drop.name}` : ''}: your ceiling
        for this trade. {cats(data.fit.my_cats_gain)} categories won per week.
      </p>
      <ImpactBars changes={data.fit.category_changes} label="Your weekly win chance per category" />
    </section>
  )
}

function Offer({ offer, open, onToggle, partner }: { offer: TargetOffer; open: boolean; onToggle: () => void; partner: string }) {
  const acc = ACCEPTANCE[offer.acceptance_label]
  const hero = offer.angle === 'best'
  return (
    <li className={`offer${hero ? ' offer-best' : ''}${open ? ' open' : ''}`}>
      <button type="button" className="offer-row" aria-expanded={open} onClick={onToggle}>
        <span className="offer-angle">
          <span className={hero ? 'eyebrow accent' : 'eyebrow'}>{ANGLE[offer.angle]}</span>
          <span className="small muted">{offer.angle_note}</span>
        </span>
        <span className="offer-swap">
          <span>
            <span className="label-sm">Give </span>
            <strong>{names(offer.give)}</strong>
          </span>
          <span>
            <span className="label-sm">Get </span>
            <strong>{names(offer.get)}</strong>
          </span>
        </span>
        <span className="accept">
          <span className={`tnum ${acc.tone}`}>
            {pct(offer.acceptance)} · {acc.label}
          </span>
          <span className="meter" aria-hidden="true">
            <span className={`fill-${acc.tone}`} style={{ width: pct(offer.acceptance) }} />
          </span>
        </span>
        <OddsChange before={offer.playoff_pct_before} after={offer.playoff_pct_after} />
      </button>
      {open && (
        <div className="move-detail">
          <div>
            <div className="detail-label">Your pitch to {partner}</div>
            <p className="pitch">{offer.pitch}</p>
            {offer.reasons.length > 0 && (
              <>
                <div className="detail-label">Why they might say yes</div>
                <ul className="reasons">
                  {offer.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            <ul className="reasons">
              <li>
                They get {dollars(offer.value_they_get)} of value for {dollars(offer.value_they_give)}, as owners price
                players.
              </li>
              <li>
                Categories won per week: you {cats(offer.my_cats_gain)}, they {cats(offer.their_cats_gain)}.
              </li>
              {offer.my_drop && <li>You drop {offer.my_drop.name} to make room.</li>}
              {offer.my_add && <li>Pick up {offer.my_add.name} from free agency for the open spot. The odds include him.</li>}
              {offer.their_drop && <li>They would likely drop {offer.their_drop.name}.</li>}
            </ul>
            <div className="row">
              <CopyButton text={offer.pitch} />
            </div>
          </div>
          <ImpactBars changes={offer.category_changes} label="Your weekly win chance per category" />
        </div>
      )}
    </li>
  )
}

function Offers({ data, leagueId, season }: { data: TargetReport; leagueId: number; season: number }) {
  const [open, setOpen] = useState<number>(0)
  return (
    <section className="card flush" aria-labelledby="offers-title">
      <div className="card-head">
        <h2 id="offers-title">Offers to send</h2>
        <a
          className="small"
          href={`https://fantasy.espn.com/basketball/team?leagueId=${leagueId}&teamId=${data.owner.team_id}&seasonId=${season}`}
          target="_blank"
          rel="noreferrer"
        >
          Propose on ESPN
        </a>
      </div>
      {data.note && <p className="target-note small">{data.note}</p>}
      {data.offers.length === 0 ? (
        <p className="empty">{data.note ?? 'No realistic offer for him right now.'}</p>
      ) : (
        <ol className="offer-list">
          {data.offers.map((o, i) => (
            <Offer
              key={`${o.give.map((p) => p.id).join('.')}-${o.get.map((p) => p.id).join('.')}`}
              offer={o}
              open={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
              partner={data.owner.team_name}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function Owner({ data }: { data: TargetReport }) {
  const o = data.owner
  return (
    <section className="card stack" aria-labelledby="owner-title">
      <div>
        <span className="eyebrow">His owner</span>
        <h2 id="owner-title">{o.team_name}</h2>
        <div className="small muted">
          {o.record !== '0-0-0' ? `${o.record} · ` : ''}
          {pct(o.playoff_pct)} playoff odds{o.outside_playoffs ? ' · outside the playoff spots' : ''}
        </div>
      </div>
      <dl className="owner-facts">
        <div>
          <dt>Punts</dt>
          <dd>{o.punts.length ? o.punts.join(', ') : 'Nothing'}</dd>
        </div>
        <div>
          <dt>Needs</dt>
          <dd>{o.needs.length ? o.needs.join(', ') : 'Nothing close'}</dd>
        </div>
        <div>
          <dt>Strong in</dt>
          <dd>{o.build.strong.length ? o.build.strong.join(', ') : 'Nothing stands out'}</dd>
        </div>
      </dl>
      {o.target_is_star && (
        <p className="small" style={{ margin: 0 }}>
          {data.target.name} is one of their two most valued players, so expect to overpay on paper.
        </p>
      )}
      {o.would_value.length > 0 && (
        <div>
          <div className="detail-label">Your players they'd value most</div>
          <ul className="owner-wants">
            {o.would_value.map((w) => (
              <li key={w.player.id}>
                <span>
                  <strong>{w.player.name}</strong>
                  {w.helps.length > 0 && <span className="small muted"> · helps their {w.helps.join(', ')}</span>}
                </span>
                <span className="num good">{cats(w.their_cats_gain)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

interface Props {
  report: AnalysisReport
  keep: number[]
  creds: Credentials | null
}

export function TradeFor({ report, keep, creds }: Props) {
  const [playerId, setPlayerId] = useState<number | null>(null)
  const league = report.league
  const target = useQuery({
    queryKey: ['target', league.id, league.season, report.team_id, playerId, [...keep].sort(), creds?.swid ?? null],
    queryFn: () => fetchTarget(league.id, report.team_id, league.season, playerId!, keep, creds),
    enabled: playerId !== null,
    retry: false,
    staleTime: 5 * 60_000,
  })

  return (
    <div className="split trade-for">
      <div className="narrow">
        <Picker report={report} selected={playerId} onPick={setPlayerId} />
      </div>
      <div className="wide stack" style={{ gap: 16 }} aria-live="polite">
        {playerId === null && (
          <section className="card stack">
            <span className="eyebrow">Trade for</span>
            <h2>Who do you want?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Pick any player on another team. You'll see how he fits your build, what his owner needs, and the best
              offer to send, with two fallbacks.
            </p>
          </section>
        )}
        {playerId !== null && target.isPending && (
          <section className="card row" role="status">
            <svg className="spinner" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="8" stroke="var(--accent)" strokeWidth="2" fill="none" strokeDasharray="30 20" />
            </svg>
            <span>Building offers…</span>
          </section>
        )}
        {target.error && (
          <section className="card error stack">
            <h2>Couldn't build offers</h2>
            <p>{target.error.message}</p>
          </section>
        )}
        {target.data && (
          <>
            <Fit data={target.data} />
            <Offers data={target.data} leagueId={league.id} season={league.season} />
            <Owner data={target.data} />
          </>
        )}
      </div>
    </div>
  )
}
