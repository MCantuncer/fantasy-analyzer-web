import type { ReactNode } from 'react'
import './IntroSteps.css'

export interface IntroStep {
  icon: 'pick' | 'search' | 'deal' | 'fit' | 'offers'
  title: string
  detail: string
}

const ICONS: Record<IntroStep['icon'], ReactNode> = {
  pick: <path d="M3 9l4 4 8-8" />,
  search: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M12 12l4 4" />
    </>
  ),
  deal: <path d="M3 6h11l-3-3M15 12H4l3 3" />,
  fit: <path d="M3 14V9M7 14V4M11 14V7M15 14V2" />,
  offers: <path d="M3 5h12M3 9h12M3 13h8" />,
}

/** A page's empty-state intro as numbered steps with icons, instead of a paragraph. */
export function IntroSteps({ steps }: { steps: IntroStep[] }) {
  return (
    <ol className="intro-steps">
      {steps.map((s) => (
        <li key={s.title}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            {ICONS[s.icon]}
          </svg>
          <span>
            <strong>{s.title}</strong>
            <span className="small muted">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
