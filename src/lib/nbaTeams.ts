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
