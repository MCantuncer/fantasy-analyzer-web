import { fold, type Mark } from './playerSearch'

/** An NBA team as the header search finds it: by ESPN's abbreviation, city or nickname. */
export interface NbaTeam {
  abbrev: string
  location: string
  nickname: string
  /** Other names people type: "okc", "sixers", "cavs", "golden state". */
  aliases: string[]
}

const t = (abbrev: string, location: string, nickname: string, ...aliases: string[]): NbaTeam => ({
  abbrev,
  location,
  nickname,
  aliases,
})

export const NBA_TEAMS: NbaTeam[] = [
  t('ATL', 'Atlanta', 'Hawks'),
  t('BOS', 'Boston', 'Celtics', 'celts'),
  t('BKN', 'Brooklyn', 'Nets', 'bkn', 'bro'),
  t('CHA', 'Charlotte', 'Hornets', 'cha'),
  t('CHI', 'Chicago', 'Bulls'),
  t('CLE', 'Cleveland', 'Cavaliers', 'cavs'),
  t('DAL', 'Dallas', 'Mavericks', 'mavs'),
  t('DEN', 'Denver', 'Nuggets'),
  t('DET', 'Detroit', 'Pistons'),
  t('GS', 'Golden State', 'Warriors', 'gsw', 'dubs'),
  t('HOU', 'Houston', 'Rockets'),
  t('IND', 'Indiana', 'Pacers'),
  t('LAC', 'LA', 'Clippers', 'los angeles clippers', 'clips'),
  t('LAL', 'Los Angeles', 'Lakers', 'la lakers'),
  t('MEM', 'Memphis', 'Grizzlies', 'grizz'),
  t('MIA', 'Miami', 'Heat'),
  t('MIL', 'Milwaukee', 'Bucks'),
  t('MIN', 'Minnesota', 'Timberwolves', 'wolves', 'twolves'),
  t('NO', 'New Orleans', 'Pelicans', 'nop', 'pels'),
  t('NY', 'New York', 'Knicks', 'nyk'),
  t('OKC', 'Oklahoma City', 'Thunder'),
  t('ORL', 'Orlando', 'Magic'),
  t('PHI', 'Philadelphia', '76ers', 'sixers', 'philly'),
  t('PHX', 'Phoenix', 'Suns', 'phx'),
  t('POR', 'Portland', 'Trail Blazers', 'blazers'),
  t('SAC', 'Sacramento', 'Kings'),
  t('SA', 'San Antonio', 'Spurs', 'sas'),
  t('TOR', 'Toronto', 'Raptors', 'raps'),
  t('UTAH', 'Utah', 'Jazz', 'uta'),
  t('WSH', 'Washington', 'Wizards', 'was', 'wiz'),
]

export function teamName(team: NbaTeam): string {
  return `${team.location} ${team.nickname}`
}

export function teamByAbbrev(abbrev: string | null | undefined): NbaTeam | undefined {
  const a = abbrev?.toUpperCase()
  return a ? NBA_TEAMS.find((x) => x.abbrev === a) : undefined
}

export interface TeamHit {
  team: NbaTeam
  /** 0 the abbreviation or a name starts with it, 1 a word of the name does, 2 a nickname people use. */
  rank: number
  /** Stretches of the full name ("Denver Nuggets") to mark as matched. */
  marks: Mark[]
}

function clean(text: string): string {
  return fold(text).folded.replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim()
}

function matchTeam(team: NbaTeam, q: string): TeamHit | null {
  const name = clean(teamName(team))
  const nick = team.location.length + 1 // where the nickname starts in the full name
  if (name.startsWith(q)) return { team, rank: 0, marks: [[0, q.length]] }
  if (clean(team.nickname).startsWith(q)) return { team, rank: 0, marks: [[nick, nick + q.length]] }
  if (team.abbrev.toLowerCase() === q) return { team, rank: 0, marks: [] }
  // "state", "antonio", "blazers": a later word of the name.
  for (let i = 1; i < name.length; i++) {
    if (name[i - 1] === ' ' && name.startsWith(q, i)) return { team, rank: 1, marks: [[i, i + q.length]] }
  }
  if (q.length >= 2 && (team.abbrev.toLowerCase().startsWith(q) || team.aliases.some((a) => a.startsWith(q))))
    return { team, rank: 2, marks: [] }
  return null
}

/** Teams matching what was typed. Teams need two letters ("d" alone is a player search). */
export function searchTeams(query: string, limit = 3): TeamHit[] {
  const q = clean(query)
  if (q.length < 2) return []
  const hits = NBA_TEAMS.map((team) => matchTeam(team, q)).filter((h): h is TeamHit => h !== null)
  hits.sort((a, b) => a.rank - b.rank || teamName(a.team).localeCompare(teamName(b.team)))
  return hits.slice(0, limit)
}
