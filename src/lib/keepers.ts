/**
 * Keepers: the players a manager never wants offered in trades or suggested as drops.
 *
 * They are saved with the account, so they follow the manager to every device and the server's
 * league-wide trade scan can respect them. The browser keeps a copy so the first paint needs no
 * request, and so keepers still work while the account's list can't be reached.
 */

export interface AccountKeepers {
  player_ids: number[]
  /** False until the account has saved a list for this team, even an empty one. */
  saved: boolean
}

function keepKey(leagueId: number, teamId: number) {
  return `keep:${leagueId}:${teamId}`
}

export function loadKeep(leagueId: number, teamId: number): number[] {
  try {
    const raw = localStorage.getItem(keepKey(leagueId, teamId))
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'number') : []
  } catch {
    return []
  }
}

export function storeKeep(leagueId: number, teamId: number, ids: number[]) {
  try {
    localStorage.setItem(keepKey(leagueId, teamId), JSON.stringify(ids))
  } catch {
    // storage unavailable; keepers last for this page view only
  }
}

export function sameKeepers(a: number[], b: number[]) {
  return a.length === b.length && [...a].sort((x, y) => x - y).join(',') === [...b].sort((x, y) => x - y).join(',')
}

/**
 * What to do once the account's keepers arrive, given the copy this browser holds.
 *
 * The account's list wins once it exists. Until then the browser's copy is the list, and it is
 * uploaded so the manager's other devices get it (keepers chosen before they were saved to accounts).
 */
export function settleKeepers(local: number[], account: AccountKeepers) {
  if (!account.saved) return { keep: local, upload: local.length > 0, changed: false }
  return { keep: account.player_ids, upload: false, changed: !sameKeepers(local, account.player_ids) }
}
