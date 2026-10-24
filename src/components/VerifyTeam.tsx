import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { startTeamLink, verifyTeamLink } from '../api/client'
import type { LeagueRef, OverviewTeam, TeamLinkChallenge } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { espnTeamUrl } from '../lib/espnUrl'

interface Props {
  leagueRef: LeagueRef
  leagueName: string
  teams: OverviewTeam[]
  creds: Credentials | null
  onVerified: () => void
  onCancel: () => void
}

function status(t: OverviewTeam): string {
  if (t.mine) return 'Yours'
  return t.has_manager ? 'Verified by another account' : 'No manager yet'
}

/**
 * Makes this account a team's official manager without an ESPN login: set the team's
 * abbreviation on ESPN to a code we give you, we read it back, then you change it back.
 */
export function VerifyTeam({ leagueRef, leagueName, teams, creds, onVerified, onCancel }: Props) {
  const [teamId, setTeamId] = useState<number | null>(null)
  const [challenge, setChallenge] = useState<TeamLinkChallenge | null>(null)
  const [copied, setCopied] = useState(false)

  const start = useMutation({
    mutationFn: (id: number) => startTeamLink(leagueRef, id, creds),
    onSuccess: (c) => {
      setChallenge(c)
      setCopied(false)
    },
  })
  const verify = useMutation({
    mutationFn: () => verifyTeamLink(challenge!.challenge, creds),
    onSuccess: onVerified,
  })
  const expired = verify.error && 'code' in verify.error && verify.error.code === 'challenge_expired'
  const chosen = teams.find((t) => t.id === teamId)

  return (
    <div className="verify stack">
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">{leagueName}</span>
        <h1 className="page-title">Which team do you manage?</h1>
      </div>

      <div role="radiogroup" aria-label="Your team" className="verify-teams">
        {/* Once a team is picked, only it stays, so the next step is in view on a phone. */}
        {(chosen ? [chosen] : teams).map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={t.id === teamId}
            className="verify-team"
            disabled={t.mine}
            onClick={() => {
              setTeamId(t.id)
              setChallenge(null)
              verify.reset()
            }}
          >
            <span className="verify-team-name">{t.name}</span>
            <span className={t.has_manager && !t.mine ? 'small muted' : 'small faint'}>{status(t)}</span>
          </button>
        ))}
        {chosen && (
          <button
            type="button"
            className="link small verify-change"
            onClick={() => {
              setTeamId(null)
              setChallenge(null)
              start.reset()
              verify.reset()
            }}
          >
            Pick another team
          </button>
        )}
      </div>

      {chosen && (!challenge || expired || challenge.team_id !== chosen.id) && (
        <section className="card stack" aria-labelledby="code-title">
          <h2 id="code-title">Prove {chosen.name} is yours</h2>
          <p className="small muted">
            You'll set the team's abbreviation on ESPN to a 4-character code, and we read it back. Only the team's owner
            and the league manager can change it. No ESPN password or login.
          </p>
          {chosen.has_manager && (
            <p className="small warn">
              Another account verified this team. If you manage it, verify it here: the newest check wins and they are
              told.
            </p>
          )}
          {expired && <p className="small warn">That code expired. Get a fresh one.</p>}
          <div className="row">
            <button type="button" disabled={start.isPending} onClick={() => start.mutate(chosen.id)}>
              {start.isPending ? 'Getting a code…' : 'Get my code'}
            </button>
          </div>
          {start.error && (
            <p className="small bad" role="alert">
              {start.error.message}
            </p>
          )}
        </section>
      )}

      {chosen && challenge && !expired && challenge.team_id === chosen.id && (
        <section className="card stack link-card" aria-labelledby="code-title">
          <h2 id="code-title">Set this as your team abbreviation on ESPN</h2>
          <div className="link-code">
            <span className="num link-code-value" aria-label={`Code ${challenge.code.split('').join(' ')}`}>
              {challenge.code}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(challenge.code)
                  .then(() => setCopied(true))
                  .catch(() => undefined)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <ol className="link-steps small">
            <li>
              On ESPN, open your team, then <strong>Team Settings</strong>.
            </li>
            <li>
              Change the abbreviation from <strong>{challenge.current_abbrev}</strong> to{' '}
              <strong className="num">{challenge.code}</strong> and save.
            </li>
            <li>Come back and check. Then change it back to {challenge.current_abbrev}.</li>
          </ol>
          <div className="row link-actions">
            <button type="button" disabled={verify.isPending} onClick={() => verify.mutate()}>
              {verify.isPending ? 'Checking ESPN…' : 'I changed it, check now'}
            </button>
            <a
              className="button secondary"
              href={espnTeamUrl(leagueRef, challenge.team_id)}
              target="_blank"
              rel="noreferrer"
            >
              Open my team on ESPN
            </a>
          </div>
          {verify.error && !expired && (
            <p className="small bad" role="alert">
              {verify.error.message}
            </p>
          )}
          <p className="small muted">The code works for 30 minutes.</p>
        </section>
      )}

      <p className="small muted">
        Each team has one official manager, and each account manages one team per league.{' '}
        <button type="button" className="link" onClick={onCancel}>
          Back to the league
        </button>
      </p>
    </div>
  )
}
