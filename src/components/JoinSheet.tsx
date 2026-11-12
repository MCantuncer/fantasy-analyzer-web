import { useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from '@phosphor-icons/react'
import type { AnalysisReport, AuthResult } from '../api/client'
import { bestMoveOf } from '../lib/bestMove'
import { parseLeagueInput } from '../lib/espnUrl'
import { pct, ptsDiff } from '../lib/format'
import type { Theme } from '../lib/theme'
import { Auth } from './Auth'
import { Delta } from './OddsChange'
import { OpenCrest } from './OpenCrest'
import { TeamCrest } from './TeamCrest'
import './JoinSheet.css'

/** The league a visitor pasted before making an account: opened (and verified) right after sign-up. */
export interface PendingLeague {
  leagueId: number
  season: number | null
  /** What they pasted, for My leagues to try again (a private league needs cookies first). */
  input: string
}

const STEPS = ['League', 'Account', 'Your team'] as const

/** The scouted team's move before and after, for the mirror row. */
function scoutOdds(report: AnalysisReport | undefined): { before: number; after: number } | null {
  if (!report) return null
  const best = bestMoveOf(report)
  if (best.kind === 'pickup') return { before: best.pickup.playoff_pct_before, after: best.pickup.playoff_pct_after }
  if (best.kind === 'trade') return { before: best.trade.playoff_pct_before, after: best.trade.playoff_pct_after }
  const me = report.season.find((r) => r.team_id === report.team_id)
  return me ? { before: me.playoff_pct, after: me.playoff_pct } : null
}

/**
 * "Get your own best move": the sheet every sample door opens. It asks for the ESPN league first
 * (no account needed yet), then the account; the team check follows on the league's own page.
 * The sample stays underneath, and closing the sheet returns to it.
 */
export function JoinSheet({
  mode,
  scoutName,
  scoutColour,
  scoutReport,
  theme,
  onSignedIn,
  onClose,
}: {
  mode: 'signup' | 'signin'
  scoutName: string
  scoutColour?: string
  scoutReport?: AnalysisReport
  theme: Theme
  onSignedIn: (result: AuthResult, league: PendingLeague | null) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<0 | 1>(mode === 'signin' ? 1 : 0)
  const [authMode, setAuthMode] = useState(mode)
  const [input, setInput] = useState('')
  const [tried, setTried] = useState(false)
  const [league, setLeague] = useState<PendingLeague | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const parsed = parseLeagueInput(input)
  const odds = scoutOdds(scoutReport)

  // Escape closes; focus moves into the sheet and back to the door that opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    sheet.current?.querySelector<HTMLElement>('input, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('join-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('join-open')
      opener?.focus?.()
    }
  }, [onClose])

  useEffect(() => {
    sheet.current?.querySelector<HTMLElement>('input')?.focus()
  }, [step])

  const next = () => {
    setTried(true)
    if (!parsed.leagueId) return
    setLeague({ leagueId: parsed.leagueId, season: parsed.season ?? null, input: input.trim() })
    setStep(1)
  }

  return (
    <div className="join-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="join-sheet card" role="dialog" aria-modal="true" aria-labelledby="join-title" ref={sheet}>
        <header className="join-head">
          <h2 className="join-title" id="join-title">
            Get your own best move
          </h2>
          <button type="button" className="icon join-close" aria-label="Close, keep scouting" onClick={onClose}>
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </header>

        <div className="join-mirror">
          <div className="join-mirror-row">
            <TeamCrest name={scoutName} colour={scoutColour} size={26} />
            <span className="join-mirror-who">
              <b>{scoutName}</b>
              <span className="small muted">Sample league, read only</span>
            </span>
            {odds && (
              <span className="join-mirror-odds num">
                {pct(odds.before)} <ArrowRight size={11} weight="bold" aria-label="to" /> <b>{pct(odds.after)}</b>
                {ptsDiff(odds.before, odds.after) > 0 && (
                  <span className="good">
                    <Delta value={ptsDiff(odds.before, odds.after)} />
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="join-mirror-row join-mirror-yours">
            <OpenCrest size={26} />
            <span className="join-mirror-who">
              <b>Your team</b>
              <span className="small muted">Its own move, odds and trades</span>
            </span>
            <span className="join-mirror-odds num muted" aria-label="not analysed yet">
              – → –
            </span>
          </div>
        </div>

        {authMode === 'signup' && (
          <ol className="join-steps" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'now' : i < step ? 'done' : undefined}>
                <span className="join-step-n num">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        )}

        {step === 0 ? (
          <form
            className="stack join-league"
            onSubmit={(e) => {
              e.preventDefault()
              next()
            }}
          >
            <label className="field">
              <span>Your ESPN league</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the league link or ID"
                inputMode="url"
                autoComplete="off"
                aria-invalid={tried && !parsed.leagueId ? true : undefined}
                aria-describedby="join-league-help"
              />
            </label>
            {tried && !parsed.leagueId ? (
              <p className="join-error small" role="alert">
                That doesn't look like an ESPN league. Paste the link from your team page, or just the league ID.
              </p>
            ) : (
              <p className="small muted" id="join-league-help">
                No account needed yet. Private league? After sign-up you add two ESPN cookies; they stay in your
                browser.
              </p>
            )}
            <button type="submit">Next</button>
          </form>
        ) : (
          <div className="join-auth">
            <Auth
              key={authMode}
              theme={theme}
              initialMode={authMode}
              lead={league ? 'Then your league opens, and you pick the team you manage.' : undefined}
              onSignedIn={(r) => onSignedIn(r, league)}
            />
          </div>
        )}

        <footer className="join-foot small">
          {step === 0 ? (
            <span>
              Have an account?{' '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setAuthMode('signin')
                  setStep(1)
                }}
              >
                Sign in
              </button>
            </span>
          ) : (
            <span />
          )}
          <button type="button" className="link" onClick={onClose}>
            Keep scouting
          </button>
        </footer>
      </div>
    </div>
  )
}
