import { CheckCircle, Diamond, Warning } from '@phosphor-icons/react'
import type { OfferCheck } from '../api/client'
import { clearChecks, pointChange } from '../lib/tradeCheck'
import './TradeCheckMoves.css'

const CATS = 'FG%|FT%|3PM|REB|AST|STL|BLK|TO|PTS'
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')

/**
 * A build conflict split into one chip per category: the code, the change in weekly win chance from the
 * rounded ends (so it matches the table), and the engine's words for how often you win it now.
 */
function conflictChips(check: OfferCheck, evidence: string) {
  const rows = check.idea.category_detail ?? []
  const out: { category: string; change: number; note: string }[] = []
  for (const m of evidence.matchAll(new RegExp(`(${CATS}) [−-]?\\d+ pts \\(([^)]*)\\)`, 'g'))) {
    const r = rows.find((x) => x.category === m[1])
    if (!r) continue
    out.push({ category: m[1], change: pointChange(r.my_win_before, r.my_win_after), note: m[2] })
  }
  return out
}

/** Their keystones you'd take, told from their side: "Dyson Daniels carries their STL: they win it 60% …". */
function theirKeystones(check: OfferCheck): string[] {
  return check.idea.get.flatMap((p) =>
    (p.badges ?? [])
      .filter((b) => b.kind === 'keystone' && b.category)
      .map((b) => {
        const tail = b.reason.includes('. ') ? b.reason.slice(b.reason.indexOf('. ') + 2) : ''
        return `${p.name} carries their ${b.category}${tail ? `: ${tail.charAt(0).toLowerCase()}${tail.slice(1)}` : '.'}`
      }),
  )
}

/** Flags the engine confirmed, the other team's keystones, and which checks came back clear. */
export function TradeCheckFlags({ check }: { check: OfferCheck }) {
  const checks = check.checks ?? []
  const confirmed = checks.filter((c) => c.status === 'confirmed').length
  const keystones = theirKeystones(check)
  const clear = clearChecks(check).map((t) => t.toLowerCase())
  if (!check.flags.length && !keystones.length && !checks.length) return null
  return (
    <section className="card tck-fl" aria-labelledby="tck-fl-title">
      <div className="tck-fl-head">
        <h3 id="tck-fl-title">Flags</h3>
        {checks.length > 0 && (
          <span className="num">
            {confirmed} of {checks.length} checks
          </span>
        )}
      </div>
      {check.flags.length === 0 && keystones.length === 0 && <p className="tck-fl-none">Nothing flagged.</p>}
      <ul className="tck-fl-list">
        {check.flags.map((f) => {
          const chips = f.check === 'build_conflict' ? conflictChips(check, f.evidence) : []
          return (
            <li key={`${f.check}-${f.evidence}`}>
              <Warning className="tck-fl-icon warn" size={18} aria-hidden="true" />
              <div>
                <b>{f.title}</b>
                {chips.length ? (
                  <>
                    <p>It costs categories you compete in.</p>
                    <ul className="tck-fl-chips">
                      {chips.map((c) => (
                        <li key={c.category}>
                          <b>{c.category}</b>
                          <span className={`num ${c.change < 0 ? 'down' : 'up'}`}>{signed(c.change)} pts</span>
                          <span>{c.note}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>{f.evidence}</p>
                )}
              </div>
            </li>
          )
        })}
        {keystones.map((text) => (
          <li key={text}>
            <Diamond className="tck-fl-icon them" size={18} aria-hidden="true" />
            <div>
              <b>Their keystone</b>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ul>
      {clear.length > 0 && (
        <p className="tck-fl-clear">
          <CheckCircle size={16} aria-hidden="true" /> Clear: {clear.join(', ')}.
        </p>
      )}
    </section>
  )
}
