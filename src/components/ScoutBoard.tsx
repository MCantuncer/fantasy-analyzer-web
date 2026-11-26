import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import './ScoutBoard.css'

/** One band of the board: a row on wide screens, a column on phones. */
export interface ScoutBand {
  key: string
  label: string
  hint: string
  /** The band where the moves go: lit in gold. */
  focus?: boolean
}

export interface ScoutMagnet {
  cat: string
  band: string
  big: string
  small: string
  tone?: 'lead' | 'trail'
  dim?: boolean
  tag?: string
}

/** The nine categories in three bands: where each one stands, at a glance. */
export function ScoutBoard({
  cats,
  bands,
  magnets,
  catHint,
  label,
}: {
  cats: readonly string[]
  bands: ScoutBand[]
  magnets: ScoutMagnet[]
  catHint?: (cat: string) => string | undefined
  label: string
}) {
  return (
    <div className="sb-board" role="table" aria-label={label}>
      {bands.map((b, i) => (
        <div
          key={`bg-${b.key}`}
          className={`sb-bandbg${b.focus ? ' focus' : i === 0 ? ' top' : ''}`}
          style={{ '--bi': i + 2 } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      {bands.map((b, i) => (
        <div
          key={`lab-${b.key}`}
          className={`sb-bandlab${b.focus ? ' focus' : ''}`}
          style={{ '--bi': i + 2 } as CSSProperties}
          role="rowheader"
        >
          <b>{b.label}</b>
          <span>{b.hint}</span>
        </div>
      ))}
      {cats.map((cat, i) => (
        <div key={`h-${cat}`} className="sb-cathead" style={{ '--ci': i + 2 } as CSSProperties} role="columnheader">
          {cat}
          {catHint?.(cat) && <small>{catHint(cat)}</small>}
        </div>
      ))}
      {magnets.map((m) => {
        const bi = bands.findIndex((b) => b.key === m.band)
        const ci = cats.indexOf(m.cat)
        if (bi < 0 || ci < 0) return null
        const cls = ['sb-mag', m.tone, m.dim ? 'dim' : ''].filter(Boolean).join(' ')
        return (
          <div
            key={`m-${m.cat}`}
            className={cls}
            style={{ '--bi': bi + 2, '--ci': ci + 2 } as CSSProperties}
            role="cell"
            aria-label={`${m.cat}: ${bands[bi].label}, ${m.big}, ${m.small}${m.tag ? `, ${m.tag}` : ''}`}
          >
            {m.tag && <em className="sb-tag">{m.tag}</em>}
            <span className="sb-big">{m.big}</span>
            <span className="sb-small">{m.small}</span>
          </div>
        )
      })}
    </div>
  )
}

/** A flat label: the word, then its number. */
export function ScoutLabel({ word, children }: { word: string; children?: ReactNode }) {
  return (
    <span className="sb-label">
      <b>{word}</b>
      {children && <span className="sb-label-num">{children}</span>}
    </span>
  )
}

export interface ScoutNote {
  key: string
  text: ReactNode
  number: string
  caption: string
  tone?: 'good' | 'bad'
  /** The number is words (category names), not digits. */
  words?: boolean
}

/** Scout's notes with the evidence beside each line; the first ``shown`` notes open, the rest behind More. */
export function ScoutNotes({ notes, shown = 3, label }: { notes: ScoutNote[]; shown?: number; label: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const row = (n: ScoutNote) => (
    <li key={n.key} className="sb-note">
      <p>{n.text}</p>
      <div className="sb-margin">
        <span className={`sb-n${n.tone ? ` ${n.tone}` : ''}${n.words ? ' words' : ''}`}>{n.number}</span>
        <span className="sb-c">{n.caption}</span>
      </div>
    </li>
  )
  const rest = notes.slice(shown)
  return (
    <div className="sb-notes-wrap">
      <ul className="sb-notes" aria-label={label}>
        {notes.slice(0, shown).map(row)}
      </ul>
      {rest.length > 0 && (
        <>
          <div className={`sb-more${open ? ' open' : ''}`} id={id} hidden={!open}>
            <ul className="sb-notes">{rest.map(row)}</ul>
          </div>
          <button type="button" className="sb-more-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
            {open ? 'Less' : 'More'} {!open && <span className="num">({rest.length})</span>}
          </button>
        </>
      )}
    </div>
  )
}
