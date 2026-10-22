import { signedPts } from '../lib/format'

/** Shows only categories that move by at least 2 points of weekly win %. */
export function CategoryChanges({ changes }: { changes: Record<string, number> }) {
  const moved = Object.entries(changes)
    .filter(([, v]) => Math.abs(v) >= 0.02)
    .sort((a, b) => b[1] - a[1])
  if (!moved.length) return null
  return (
    <ul className="chips">
      {moved.map(([cat, v]) => (
        <li key={cat} className={v > 0 ? 'chip up' : 'chip down'}>
          {cat} {signedPts(v)}
        </li>
      ))}
    </ul>
  )
}
