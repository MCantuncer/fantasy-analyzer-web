import { useTeamLink } from '../lib/teamLink'

interface Props {
  leagueId: number
  season: number
  onOpen: () => void
}

/** Top-bar entry to the team check: "Verify team" until this device is linked, then the linked team. */
export function TeamLinkButton({ leagueId, season, onOpen }: Props) {
  const [link] = useTeamLink(leagueId, season)
  return (
    <button
      className={link ? 'secondary team-link-btn linked' : 'team-link-btn'}
      onClick={onOpen}
      aria-label={link ? `Verified as ${link.teamName}. Open league chat` : 'Verify your team'}
      title={link ? `Verified as ${link.teamName}` : 'Prove which team is yours to join the league chat'}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {link ? (
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <path
            d="M8 1.5l5 2v4c0 3.2-2.2 5.6-5 7-2.8-1.4-5-3.8-5-7v-4l5-2z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="hide-sm">{link ? link.teamName : 'Verify team'}</span>
    </button>
  )
}
