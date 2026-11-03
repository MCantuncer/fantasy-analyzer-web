import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import './ScoresLens.css'

export type Lens = 'all' | 'mine'

interface Props {
  value: Lens
  onChange: (value: Lens) => void
  all: number
  mine: number
}

const OPTIONS: Lens[] = ['all', 'mine']

/** "All 15 | Mine 6": which games the Scores page shows, with each view's game count up front. */
export function ScoresLens({ value, onChange, all, mine }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const count = { all, mine }

  // Radio group keys: any arrow moves to the other option and selects it.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next = OPTIONS[1 - i]
    onChange(next)
    refs.current[1 - i]?.focus()
  }

  return (
    <div className="sl-lens" role="radiogroup" aria-label="Games shown" data-value={value}>
      <span className="sl-lit" aria-hidden="true" />
      {OPTIONS.map((o, i) => (
        <button
          key={o}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          className="sl-seg"
          aria-checked={value === o}
          aria-label={`${o === 'all' ? 'All' : 'Mine'} ${count[o]} ${count[o] === 1 ? 'game' : 'games'}`}
          tabIndex={value === o ? 0 : -1}
          onClick={() => onChange(o)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o === 'all' ? 'All' : 'Mine'} <span className="sl-n num">{count[o]}</span>
        </button>
      ))}
    </div>
  )
}
