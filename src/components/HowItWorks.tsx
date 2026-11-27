import { useId, useState, type ReactNode } from 'react'
import { BookOpenText, CaretDown } from '@phosphor-icons/react'
import './HowItWorks.css'

export interface HowPart {
  title: string
  body: ReactNode
}

/**
 * "How this works" at the foot of a page (hiw- prefix): a bare 56px row (book, label, caret) that
 * opens up to four short columns, then the page's notes one per line. One component for Moves,
 * My Team, League and Scores.
 */
export function HowItWorks({ parts = [], notes = [] }: { parts?: HowPart[]; notes?: ReactNode[] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <section className="hiw-sec" aria-label="How this works">
      <button type="button" className="hiw-row" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <BookOpenText className="hiw-ic" aria-hidden="true" />
        <b>How this works</b>
        <CaretDown className="hiw-caret" aria-hidden="true" />
      </button>
      <div id={id} className="hiw-body" hidden={!open}>
        {parts.length > 0 && (
          <div className="hiw-parts">
            {parts.map((p) => (
              <div key={p.title} className="hiw-part">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        )}
        {notes.length > 0 && (
          <ul className="hiw-notes">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
