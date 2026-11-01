// Pull espn_s2 and SWID out of whatever the user pasted: a Cookie header, rows copied
// from the DevTools cookie table, "name=value" pairs, or just the bare values.

export interface Found {
  espnS2: string | null
  swid: string | null
}

const GUID = /\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?/i
// espn_s2 is a long URL-encoded token; real ones are a few hundred characters.
const S2_VALUE = '[A-Za-z0-9%+/=_.-]{60,}'
const S2_NAMED = new RegExp(`espn_s2["']?\\s*[=:\\t ]\\s*["']?(${S2_VALUE})`, 'i')
const S2_BARE = new RegExp(`(?:^|[\\s;,"'])(${S2_VALUE})(?=$|[\\s;,"'])`)

export function parseCookiePaste(text: string): Found {
  const swidMatch = text.match(new RegExp(`swid["']?\\s*[=:\\t ]\\s*["']?${GUID.source}`, 'i')) ?? text.match(GUID)
  const swid = swidMatch ? `{${swidMatch[1].toUpperCase()}}` : null
  const named = text.match(S2_NAMED)
  // Without a name, take the long token that isn't the SWID.
  const bare = named ? null : text.replace(GUID, ' ').match(S2_BARE)
  const espnS2 = (named?.[1] ?? bare?.[1] ?? null)?.trim() ?? null
  return { espnS2, swid }
}
