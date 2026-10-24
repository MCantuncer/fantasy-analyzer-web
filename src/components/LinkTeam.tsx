import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { startTeamLink, verifyTeamLink } from '../api/client'
import type { FeedTeam, LeagueRef, TeamLinkChallenge } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { espnTeamUrl } from '../lib/espnUrl'
import type { TeamLink } from '../lib/teamLink'

interface Props {
  leagueRef: LeagueRef
  teams: FeedTeam[]
  defaultTeamId: number
  creds: Credentials | null
  onLinked: (link: TeamLink) => void
}

/**
 * Proves a team is yours without an ESPN login: set its abbreviation on ESPN to a code
 * we give you, we read it back, and you can change it back straight after.
 */
export function LinkTeam({ leagueRef, teams, defaultTeamId, creds, onLinked }: Props) {
  const [teamId, setTeamId] = useState(defaultTeamId)
  const [challenge, setChallenge] = useState<TeamLinkChallenge | null>(null)
  const [copied, setCopied] = useState(false)

  const start = useMutation({
    mutationFn: () => startTeamLink(leagueRef, teamId, creds),
    onSuccess: (c) => {
      setChallenge(c)
      setCopied(false)
    },
  })
  const verify = useMutation({
    mutationFn: () => verifyTeamLink(challenge!.challenge, creds),
    onSuccess: (me) => {
      const link = { token: me.token!, teamId: me.team_id, teamName: me.team_name }
      onLinked(link)
    },
  })
  const expired = verify.error && 'code' in verify.error && verify.error.code === 'challenge_expired'

  if (!challenge || expired) {
    return (
      <section className="card stack link-card" aria-labelledby="link-title">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="link-title">Join the league chat</h2>
          <p className="muted">
            Reactions, replies and chat are for managers in this league. Prove your team is yours with a one-minute
            check on ESPN. No password, no ESPN login.
          </p>
        </div>
        <div className="input-row">
          <label className="grow">
            <span className="small">Your team</span>
            <select value={teamId} onChange={(e) => setTeamId(Number(e.target.value))}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={start.isPending} onClick={() => start.mutate()}>
            {start.isPending ? 'Getting a code…' : 'Get my code'}
          </button>
        </div>
        {expired && <p className="small warn">That code expired. Here's a fresh start.</p>}
        {start.error && (
          <p className="small bad" role="alert">
            {start.error.message}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="card stack link-card" aria-labelledby="link-title">
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">Linking {challenge.team_name}</span>
        <h2 id="link-title">Set this as your team abbreviation on ESPN</h2>
      </div>
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
        <li>Come back and check. Then you can change it back to {challenge.current_abbrev}.</li>
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
        <button type="button" className="link small" onClick={() => setChallenge(null)}>
          Pick another team
        </button>
      </div>
      {verify.error && !expired && (
        <p className="small bad" role="alert">
          {verify.error.message}
        </p>
      )}
      <p className="small muted">
        Only a team's owner (and the league manager) can change its abbreviation, so this proves the team is yours. The
        code works for 30 minutes.
      </p>
    </section>
  )
}
