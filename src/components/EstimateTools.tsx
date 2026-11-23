import { CaretDown, SquaresFour } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { FULL_AT, tallyOf } from '../lib/iddaaCompare'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import { rungsServed } from '../lib/valueRungs'
import { ValueRungs, ValueRungsLine } from './ValueRungs'
import './EstimateTools.css'

/** The tool rows a viewer keeps open, remembered in this browser. */
export const TOOLS_KEY = 'ic-tl-open'
type ToolId = 'value' | 'divided' | 'lines'
const IDS: ToolId[] = ['value', 'divided', 'lines']
const DEFAULT_OPEN: ToolId[] = ['value']

/** Storage can be missing or blocked (private windows, previews), so every read and write is
 *  guarded and the rows work without it. */
function loadOpen(): ToolId[] {
  try {
    const raw = localStorage.getItem(TOOLS_KEY)
    if (raw == null) return DEFAULT_OPEN
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? IDS.filter((id) => v.includes(id)) : DEFAULT_OPEN
  } catch {
    return DEFAULT_OPEN
  }
}

function saveOpen(open: ToolId[]): void {
  try {
    localStorage.setItem(TOOLS_KEY, JSON.stringify(open))
  } catch {
    // storage blocked: the rows stay as set for this page view
  }
}

interface Props {
  data: BookCompare
  lines: Line[]
  settled: boolean
  /** The How divided field, opened from its row. */
  divided: ReactNode
  /** Game by game with the team totals, opened from Every line. */
  boxes: ReactNode
}

/** Tools (The Slip Rail): Value rungs, How divided and Every line as quiet disclosure rows, each a
 *  64px target with a hover fill, the open ones remembered per viewer. The row's button holds only
 *  its title and stretches over the whole head; the header line sits beside it (never inside), so a
 *  player's name in it opens the player card on its own. */
export function EstimateTools({ data, lines, settled, divided, boxes }: Props) {
  const [open, setOpen] = useState<ToolId[]>(loadOpen)
  const players = useMemo(() => lines.filter((l) => l.kind === 'player'), [lines])
  const gaps = useMemo(() => players.filter((l) => l.gap != null), [players])
  const games = lines.length - players.length
  if (data.games.length === 0) return null

  const toggle = (id: ToolId) => {
    const next = open.includes(id) ? open.filter((x) => x !== id) : [...open, id]
    setOpen(next)
    saveOpen(next)
  }
  const above = tallyOf(gaps).above
  return (
    <section className="ic-tl" aria-labelledby="ic-h-tl">
      <div className="ic-tl-head">
        <h2 id="ic-h-tl">
          <SquaresFour size={22} aria-hidden="true" />
          Tools
        </h2>
      </div>
      <ul className="ic-tl-rows">
        {rungsServed(data) && (
          <Tool
            id="value"
            title="Value rungs"
            open={open.includes('value')}
            onToggle={toggle}
            line={<ValueRungsLine data={data} lines={lines} />}
          >
            <ValueRungs data={data} lines={lines} settled={settled} />
          </Tool>
        )}
        {gaps.length > 0 && (
          <Tool
            id="divided"
            title="How divided"
            open={open.includes('divided')}
            onToggle={toggle}
            line={
              <>
                Every player line at its gap · ours above on <b className="num">{above}</b>
              </>
            }
            preview={<Preview lines={gaps} />}
          >
            {divided}
          </Tool>
        )}
        <Tool
          id="lines"
          title="Every line"
          open={open.includes('lines')}
          onToggle={toggle}
          line={
            <>
              <b className="num">{players.length}</b> player lines · <b className="num">{games}</b> game lines with team
              points
            </>
          }
          count={lines.length}
        >
          {boxes}
        </Tool>
      </ul>
    </section>
  )
}

function Tool({
  id,
  title,
  open,
  onToggle,
  line,
  preview,
  count,
  children,
}: {
  id: ToolId
  title: string
  open: boolean
  onToggle: (id: ToolId) => void
  line: ReactNode
  preview?: ReactNode
  count?: number
  children: ReactNode
}) {
  const body = `ic-tl-b-${id}`
  return (
    <li className={`ic-tl-row${open ? ' open' : ''}`}>
      <div className="ic-tl-top">
        <h3 className="ic-tl-h">
          <button type="button" className="ic-tl-btn" aria-expanded={open} aria-controls={body} onClick={() => onToggle(id)}>
            {title}
          </button>
        </h3>
        <p className="ic-tl-line">{line}</p>
        <span className="ic-tl-side" aria-hidden="true">
          {preview}
          {count != null && <b className="ic-tl-cnt num">{count}</b>}
          <CaretDown className="ic-tl-cv" size={18} />
        </span>
      </div>
      <div className="ic-tl-body" id={body} hidden={!open}>
        {open && children}
      </div>
    </li>
  )
}

/** How divided, closed: a 120×28 glimpse of the player gaps around the book's line. Decoration only,
 *  the count is in the text. */
function Preview({ lines }: { lines: Line[] }) {
  const all = lines.map((l) => 60 + Math.max(-1, Math.min(1, l.score / FULL_AT)) * 56).sort((a, b) => a - b)
  // a busy night is sampled evenly, so the glimpse keeps its shape instead of a smudge
  const step = Math.max(1, all.length / 56)
  const xs = Array.from({ length: Math.min(all.length, 56) }, (_, i) => all[Math.floor(i * step)])
  return (
    <svg className="ic-tl-prev" viewBox="0 0 120 28" aria-hidden="true">
      <path d="M60 2v24" />
      {xs.map((x, i) => (
        <circle key={i} cx={x.toFixed(1)} cy={8 + ((i * 7) % 13)} r={1.8} />
      ))}
    </svg>
  )
}
