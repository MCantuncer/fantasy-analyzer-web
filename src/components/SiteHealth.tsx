import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchErrorReports, fetchUsage, resolveErrorReport } from '../api/client'
import type { ErrorReport } from '../api/client'
import { ago } from '../lib/news'
import { dayLabel, pageLabel, summarize, totalViews } from '../lib/siteHealth'
import './SiteHealth.css'

const RANGE_DAYS = 30

interface Props {
  onBack: () => void
}

/** Admins only: how many people use the site and what broke. Nothing here names a person. */
export function SiteHealth({ onBack }: Props) {
  return (
    <div className="health stack">
      <div className="health-head">
        <h1 className="page-title">Site health</h1>
        <button type="button" className="secondary" onClick={onBack}>
          Back to my leagues
        </button>
      </div>
      <Usage />
      <Errors />
    </div>
  )
}

function Usage() {
  const usage = useQuery({ queryKey: ['admin-usage', RANGE_DAYS], queryFn: () => fetchUsage(RANGE_DAYS) })
  if (usage.isPending) return <section className="card health-loading">Loading the numbers…</section>
  if (usage.error || !usage.data) {
    return (
      <section className="card error stack" role="alert">
        <p>{usage.error instanceof Error ? usage.error.message : "Couldn't load the numbers."}</p>
      </section>
    )
  }
  const data = usage.data
  const s = summarize(data.days, RANGE_DAYS, new Date())
  const most = s.pages[0]?.views ?? 0
  return (
    <>
      <section className="health-tiles" aria-label="At a glance">
        <Tile label="Visitors today" value={s.visitorsToday} />
        <Tile label="Visitors a day" value={s.dailyAverage.toFixed(1)} hint={`${RANGE_DAYS}-day average`} />
        <Tile label="Accounts" value={data.accounts} hint={`${s.newAccounts} new in ${RANGE_DAYS} days`} />
        <Tile label="Verified teams" value={data.verified_teams} hint={`${data.followed_leagues} leagues followed`} />
        <Tile label="Analyses run" value={s.analyses} hint={`last ${RANGE_DAYS} days`} />
      </section>

      <section className="card flush">
        <div className="card-head">
          <h2>Pages opened</h2>
          <span className="small muted">last {RANGE_DAYS} days</span>
        </div>
        {s.pages.length === 0 ? (
          <p className="empty health-pad">No page views counted yet.</p>
        ) : (
          <ul className="health-pages">
            {s.pages.map((p) => (
              <li key={p.page}>
                <span className="health-page-name">{pageLabel(p.page)}</span>
                <span className="health-bar" aria-hidden="true">
                  <span style={{ width: `${most ? (p.views / most) * 100 : 0}%` }} />
                </span>
                <span className="health-count">{p.views}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flush">
        <div className="card-head">
          <h2>Day by day</h2>
          <span className="small muted">UTC days</span>
        </div>
        {data.days.length === 0 ? (
          <p className="empty health-pad">Nothing counted yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="health-days">
              <thead>
                <tr>
                  <th className="left">Day</th>
                  <th>Visitors</th>
                  <th>Signed in</th>
                  <th>Views</th>
                  <th>
                    <abbr title="New accounts">New</abbr>
                  </th>
                  <th>Analyses</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{dayLabel(d.day)}</th>
                    <td>{d.visitors}</td>
                    <td>{d.signed_in}</td>
                    <td>{totalViews(d)}</td>
                    <td>{d.new_accounts}</td>
                    <td>{d.events.analysis ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="small muted health-note">
        A visitor is counted once a day without cookies or ids, so the same person on two days counts twice.
      </p>
    </>
  )
}

function Tile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card health-tile">
      <span className="small muted">{label}</span>
      <strong className="health-tile-value">{value}</strong>
      {hint && <span className="small faint">{hint}</span>}
    </div>
  )
}

function Errors() {
  const qc = useQueryClient()
  const [showFixed, setShowFixed] = useState(false)
  const errors = useQuery({ queryKey: ['admin-errors'], queryFn: fetchErrorReports })
  const resolve = useMutation({
    mutationFn: resolveErrorReport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-errors'] }),
  })
  const reports = errors.data?.reports ?? []
  const open = reports.filter((r) => !r.resolved)
  const shown = showFixed ? reports : open
  return (
    <section className="card flush">
      <div className="card-head">
        <h2>Errors</h2>
        <div className="segmented health-filter" role="group" aria-label="Which errors">
          <button type="button" aria-pressed={!showFixed} onClick={() => setShowFixed(false)}>
            Open ({open.length})
          </button>
          <button type="button" aria-pressed={showFixed} onClick={() => setShowFixed(true)}>
            All ({reports.length})
          </button>
        </div>
      </div>
      {errors.isPending && <p className="health-pad muted">Loading…</p>}
      {errors.error && (
        <p className="health-pad error" role="alert">
          {errors.error instanceof Error ? errors.error.message : "Couldn't load the errors."}
        </p>
      )}
      {errors.data && shown.length === 0 && (
        <p className="empty health-pad">{showFixed ? 'No errors in the last 30 days.' : 'Nothing open. All quiet.'}</p>
      )}
      {shown.length > 0 && (
        <ul className="health-errors">
          {shown.map((r) => (
            <ErrorRow
              key={r.id}
              report={r}
              busy={resolve.isPending && resolve.variables === r.id}
              onResolve={() => resolve.mutate(r.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ErrorRow({ report: r, busy, onResolve }: { report: ErrorReport; busy: boolean; onResolve: () => void }) {
  const now = new Date()
  return (
    <li className={r.resolved ? 'health-error fixed' : 'health-error'}>
      <div className="health-error-top">
        <span className={r.source === 'api' ? 'tag' : 'tag warn'}>{r.source === 'api' ? 'Server' : 'Website'}</span>
        <strong className="health-error-title">{r.title}</strong>
        <span className="health-count" title="Times it happened">
          ×{r.count}
        </span>
      </div>
      <p className="small muted health-error-meta">
        {r.route} · last {ago(r.last_seen, now)} · first {ago(r.first_seen, now)} · build {r.build || '?'}
        {r.resolved && ' · marked fixed'}
      </p>
      <details className="health-error-more">
        <summary className="small">Details</summary>
        <p className="small health-error-message">{r.message}</p>
        {r.stack && <pre className="health-stack">{r.stack}</pre>}
        {r.user_agent && <p className="small faint">{r.user_agent}</p>}
      </details>
      {!r.resolved && (
        <button type="button" className="secondary btn-sm health-fix" disabled={busy} onClick={onResolve}>
          {busy ? 'Marking…' : 'Mark fixed'}
        </button>
      )}
    </li>
  )
}
