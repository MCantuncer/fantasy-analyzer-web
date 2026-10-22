export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`
}

export function signedPts(x: number): string {
  const v = Math.round(x * 100)
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)} pts`
}

export function signed(x: number, digits = 2): string {
  const s = Math.abs(x).toFixed(digits)
  return x > 0 ? `+${s}` : x < 0 ? `−${s}` : s
}

export function projection(category: string, value: number): string {
  return category.endsWith('%') ? value.toFixed(3).replace(/^0/, '') : value.toFixed(0)
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
