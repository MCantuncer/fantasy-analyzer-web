import './OpenCrest.css'

// The shield of TeamCrest, drawn empty: a crest still waiting for your team.
const SHIELD = 'M20 2.5 L36 7.5 Q37.5 8 37.5 9.6 L37.5 21 Q37.5 33.5 20 42 Q2.5 33.5 2.5 21 L2.5 9.6 Q2.5 8 4 7.5 Z'

/** The open crest: an empty shield with a small gold person in it, which is you. The door to your own league. */
export function OpenCrest({ size = 22 }: { size?: number }) {
  return (
    <svg className="smp-open-crest" width={size} height={size * 1.1} viewBox="0 0 40 44" aria-hidden="true">
      <path d={SHIELD} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <g fill="var(--gold)">
        <circle cx="20" cy="17" r="4.2" />
        <path d="M12.5 31c1-4.6 4-7 7.5-7s6.5 2.4 7.5 7z" />
      </g>
    </svg>
  )
}
