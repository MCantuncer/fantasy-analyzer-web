// Each NBA team's main colour, by ESPN's abbreviation. Identity only (the player card's header),
// never an outcome. Picked to read under white text: very dark or very light brand colours are
// swapped for the team's next colour.
const COLOURS: Record<string, string> = {
  ATL: '#c8102e',
  BOS: '#007a33',
  BKN: '#3a3a3a',
  CHA: '#1d1160',
  CHI: '#ce1141',
  CLE: '#860038',
  DAL: '#00538c',
  DEN: '#0e2240',
  DET: '#c8102e',
  GS: '#1d428a',
  HOU: '#ce1141',
  IND: '#002d62',
  LAC: '#c8102e',
  LAL: '#552583',
  MEM: '#5d76a9',
  MIA: '#98002e',
  MIL: '#00471b',
  MIN: '#236192',
  NO: '#0c2340',
  NY: '#006bb6',
  OKC: '#007ac1',
  ORL: '#0077c0',
  PHI: '#006bb6',
  PHX: '#e56020',
  POR: '#e03a3e',
  SAC: '#5a2d81',
  SA: '#5b6770',
  TOR: '#ce1141',
  UTAH: '#4e008e',
  WSH: '#002b5c',
}

/** The team's colour, or null for a free agent or an unknown abbreviation (the site's accent then). */
export function teamColour(abbrev: string | null | undefined): string | null {
  return abbrev ? (COLOURS[abbrev.toUpperCase()] ?? null) : null
}

/**
 * NBA team "light" colours for the Front Office faces: each club's main colour, lifted so it
 * glows on both the espresso and cream themes. Used only as the glow behind a face and its 2px
 * bottom edge, never as text colour (several would fail contrast as text).
 *
 * Keyed by the abbreviation ESPN writes (NO, GS, UTAH, WSH...), with the common long forms as
 * aliases so a caller never has to normalise first.
 */
const TEAM_LIGHT: Record<string, string> = {
  ATL: '#E5484D',
  BOS: '#2FA05A',
  BKN: '#9A9A9A',
  CHA: '#1FA3B3',
  CHI: '#D8333F',
  CLE: '#A8324F',
  DAL: '#2F7DE1',
  DEN: '#E8B33A',
  DET: '#D93A4A',
  GS: '#3E73D8',
  HOU: '#E03A4E',
  IND: '#F2B233',
  LAC: '#3B6FD6',
  LAL: '#9B6FE0',
  MEM: '#6F8FC9',
  MIA: '#D9314F',
  MIL: '#2F9E5E',
  MIN: '#3FA06A',
  NO: '#C1A06A',
  NY: '#F07F2E',
  OKC: '#2F8FD8',
  ORL: '#2F7DE1',
  PHI: '#3466D6',
  PHX: '#E5662E',
  POR: '#E0423F',
  SAC: '#8A5CC9',
  SA: '#A7AEB5',
  TOR: '#D8333F',
  UTAH: '#6E7BEA',
  WSH: '#D8394C',
}

const ALIASES: Record<string, string> = {
  BRK: 'BKN',
  GSW: 'GS',
  NOP: 'NO',
  NYK: 'NY',
  PHO: 'PHX',
  SAS: 'SA',
  UTA: 'UTAH',
  WAS: 'WSH',
}

/** The team's light colour, or undefined for a free agent / unknown abbreviation. */
export function teamLight(abbrev: string | null | undefined): string | undefined {
  if (!abbrev) return undefined
  const key = abbrev.toUpperCase()
  return TEAM_LIGHT[ALIASES[key] ?? key]
}

const NAMES: Record<string, string> = {
  ATL: 'Atlanta Hawks',
  BOS: 'Boston Celtics',
  BKN: 'Brooklyn Nets',
  CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls',
  CLE: 'Cleveland Cavaliers',
  DAL: 'Dallas Mavericks',
  DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons',
  GS: 'Golden State Warriors',
  HOU: 'Houston Rockets',
  IND: 'Indiana Pacers',
  LAC: 'LA Clippers',
  LAL: 'Los Angeles Lakers',
  MEM: 'Memphis Grizzlies',
  MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks',
  MIN: 'Minnesota Timberwolves',
  NO: 'New Orleans Pelicans',
  NY: 'New York Knicks',
  OKC: 'Oklahoma City Thunder',
  ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers',
  PHX: 'Phoenix Suns',
  POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings',
  SA: 'San Antonio Spurs',
  TOR: 'Toronto Raptors',
  UTAH: 'Utah Jazz',
  WSH: 'Washington Wizards',
}

export function teamName(abbrev: string | null | undefined): string {
  return abbrev ? (NAMES[abbrev.toUpperCase()] ?? abbrev) : 'Free agent'
}
