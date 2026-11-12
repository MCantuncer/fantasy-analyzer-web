import { useId } from 'react'
import './CourtMark.css'

/*
 * The COURT mark. Every drawing sits on a 32-unit cap box (ink from y 2 to y 30).
 *
 * Folded (phones, icons): a basketball made of C and T. The C is the ball's outline (centre 14,16; outer radius 14,
 * inner 9). Its upper end runs into the T's right arm, which ends flat on the bar's underside. The T's bar is the
 * horizontal seam and its stem the vertical one. Five thin seams are cut out with a mask.
 *
 * Closed: the wordmark C O U R T, with the rail that joins C and T running over O U R. The T is a plain T with a
 * straight right arm: the bend lives only in the folded mark, where the C runs into it. The top bar shows the
 * folded ball on every screen; the closed wordmark stays available for other uses.
 */

const C_FOLDED = 'M25.87 23.42A14 14 0 1 1 21.42 4.13L18.77 8.37A9 9 0 1 0 21.63 20.77Z'
const T_ARM = 'M21 3.88A14 14 0 0 1 27.92 14.5L22.87 14.5A9 9 0 0 0 18.5 8.21Z'
const T_BAR = 'M6.99 10H21.01A9 9 0 0 1 23.17 14.5H4.83A9 9 0 0 1 6.99 10Z'
const T_STEM = 'M11.5 14.3H16.5V23.5H11.5Z'

const C_WORD = 'M23 26.72A14 14 0 1 1 24.72 7L20.89 10.21A9 9 0 1 0 19.79 22.89Z'
const T_WORD = 'M0 2H20V8H13V30H7V8H0Z'

const SEAM_BAR_LEFT = 'M-1 12.25H6.5'
const SEAM_SIDE_LEFT = 'M2.6 4.8A17 17 0 0 1 2.6 27.2'
const SEAM_SIDE_RIGHT = 'M25.4 4.8A17 17 0 0 0 21.46 19'
const SEAM_TOP = 'M14 0V7.2'
const SEAM_BOTTOM = 'M14 24.6V32.5'

const FOLDED_SEAMS = [SEAM_BAR_LEFT, SEAM_SIDE_LEFT, SEAM_SIDE_RIGHT, SEAM_TOP, SEAM_BOTTOM]
const WORD_SEAMS = [SEAM_BAR_LEFT, SEAM_SIDE_LEFT, SEAM_BOTTOM]

function SeamMask({ id, seams }: { id: string; seams: string[] }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="-4" y="-2" width="40" height="38">
      <rect x="-4" y="-2" width="40" height="38" fill="#fff" />
      {seams.map((d) => (
        <path key={d} d={d} fill="none" stroke="#000" strokeWidth="1.3" />
      ))}
    </mask>
  )
}

export type CourtMarkState = 'auto' | 'folded' | 'closed'

/** Decorative: the button around it carries the accessible name. `auto` is closed on wide screens, folded on phones. */
export function CourtMark({ state = 'auto' }: { state?: CourtMarkState }) {
  // useId() returns ":r0:"-style ids; keep them safe inside url(#...).
  const id = 'court' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <span className={`court-mark court-mark--${state}`} aria-hidden="true">
      {state !== 'closed' && (
        <svg className="court-folded" viewBox="0 2 28 28" fill="currentColor" focusable="false">
          <defs>
            <SeamMask id={`${id}-f`} seams={FOLDED_SEAMS} />
          </defs>
          <path d={`${C_FOLDED} ${T_ARM} ${T_BAR} ${T_STEM}`} mask={`url(#${id}-f)`} />
        </svg>
      )}
      {state !== 'folded' && (
        <svg className="court-closed" viewBox="0 0 104.5 32" fill="currentColor" focusable="false">
          <defs>
            <SeamMask id={`${id}-w`} seams={WORD_SEAMS} />
          </defs>
          <path d={C_WORD} mask={`url(#${id}-w)`} />
          <rect x="14" y="2" width="71" height="6" />
          <rect x="29.25" y="13.75" width="12.5" height="13.5" rx="6.25" fill="none" stroke="currentColor" strokeWidth="5.5" />
          <path d="M50.25 11V21A6.25 6.25 0 0 0 62.75 21V11" fill="none" stroke="currentColor" strokeWidth="5.5" />
          <g transform="translate(68.5 0)">
            <path d="M0 11H5.5V30H0Z" />
            <path d="M2.75 13.75H8.5A4.75 4.75 0 0 1 8.5 23.25H2.75" fill="none" stroke="currentColor" strokeWidth="5.5" />
            <path d="M6.6 23H13L17.4 30H11Z" />
          </g>
          <path transform="translate(84.5 0)" d={T_WORD} />
        </svg>
      )}
    </span>
  )
}
