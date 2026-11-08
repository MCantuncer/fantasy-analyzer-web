import type { AnalysisReport, PickupIdea, PlayerRef, ReportChange, TradeIdea } from '../api/client'

/** A small league for the news card: you are team 3, Baglayan BDSMs 5, Gergin Atamans 8. */
export const ME = 3

export function player(id: number, name: string, pro_team = 'LAL', injury_status = 'ACTIVE'): PlayerRef {
  return {
    id,
    name,
    pro_team,
    positions: ['F'],
    injury_status,
    percent_owned: 50,
    value: 1,
    perceived_value: 1,
    tier: 'tradeable',
    owner_premium: 0,
    injury_prone: false,
  }
}

export const P = {
  green: player(1, 'Draymond Green', 'GS'),
  barnes: player(2, 'Scottie Barnes', 'TOR', 'DAY_TO_DAY'),
  lopez: player(3, 'Brook Lopez', 'LAC'),
  coulibaly: player(4, 'Bilal Coulibaly', 'WSH'),
  dosunmu: player(5, 'Ayo Dosunmu', 'MIN'),
  morant: player(6, 'Ja Morant', 'MEM'),
  mitchell: player(7, 'Davion Mitchell', 'MIA'),
  holmgren: player(8, 'Chet Holmgren', 'OKC'),
  brown: player(9, 'Jaylen Brown', 'PHI'),
  embiid: player(10, 'Joel Embiid', 'PHI'),
  bane: player(11, 'Desmond Bane', 'ORL'),
  davis: player(12, 'Anthony Davis', 'DAL'),
  klay: player(13, 'Klay Thompson', 'DAL'),
  vucevic: player(14, 'Nikola Vucevic', 'BOS'),
}

export function pickup(add: PlayerRef, before: number, after: number, drop = P.mitchell): PickupIdea {
  return {
    add,
    drop,
    open_spot_by_trade: false,
    stream: false,
    availability: 'free_agent',
    my_cats_gain: 0.3,
    playoff_pct_before: before,
    playoff_pct_after: after,
    category_changes: {},
  }
}

export function trade(
  partner: [number, string],
  give: PlayerRef[],
  get: PlayerRef[],
  before: number,
  after: number,
): TradeIdea {
  return {
    partner_team_id: partner[0],
    partner_team_name: partner[1],
    give,
    get,
    my_cats_gain: 0.2,
    their_cats_gain: 0.2,
    edge: 0,
    value_they_get: 1,
    value_they_give: 1,
    owner_premium: 0,
    acceptance: 0.3,
    acceptance_label: 'possible',
    pitch: '',
    reasons: [],
    playoff_pct_before: before,
    playoff_pct_after: after,
    category_changes: {},
  }
}

const TEAMS: [number, string][] = [
  [3, 'Kucukesat Aspavas'],
  [5, 'Baglayan BDSMs'],
  [6, 'Simsek Splashers'],
  [7, 'Aliaga Hermanos'],
  [8, 'Gergin Atamans'],
]

export function report(over: Partial<AnalysisReport> & { odds?: number }): AnalysisReport {
  const { odds = 0.38, ...rest } = over
  return {
    team_id: ME,
    team_name: 'Kucukesat Aspavas',
    league: { id: 744636428, season: 2027 },
    roster: [P.green, P.barnes, P.mitchell, P.holmgren],
    trades: [],
    edge_trades: [],
    pickups: [],
    season: TEAMS.map(([id, name]) => ({
      team_id: id,
      team_name: name,
      current_record: '10-8',
      projected_wins: 80,
      projected_losses: 80,
      projected_ties: 0,
      playoff_pct: id === ME ? odds : 0.5,
      first_seed_pct: 0.1,
      mean_rank: 5,
    })),
    league_rosters: TEAMS.map(([id, name]) => ({
      team_id: id,
      team_name: name,
      players: [],
    })),
    ...rest,
  } as unknown as AnalysisReport
}

const change = (
  kind: ReportChange['kind'],
  text: string,
  player_id: number | null,
  team_id: number | null,
  mine = false,
): ReportChange => ({
  kind,
  text,
  player_id,
  team_id,
  mine,
})

/** Your roster news, your old best add taken, a rival adding the player a new trade idea gets, league noise. */
export const CHANGES: ReportChange[] = [
  change('status', 'Draymond Green is healthy again', 1, ME, true),
  change('status', 'Scottie Barnes is day-to-day', 2, ME, true),
  change('status', 'Anthony Davis moved off IR', 12, 6),
  change('status', 'Joel Embiid is day-to-day', 10, 7),
  change('status', 'Desmond Bane is out', 11, 8),
  change('added', 'Baglayan BDSMs added Brook Lopez', 3, 5),
  change('dropped', 'Baglayan BDSMs dropped Bilal Coulibaly', 4, 5),
  change('added', 'Simsek Splashers added Klay Thompson', 13, 6),
  change('dropped', 'Gergin Atamans dropped Nikola Vucevic', 14, 8),
  change('added', 'Gergin Atamans added Ja Morant', 6, 8),
  change('games', 'New stats from 68 player games', null, null),
]

/** Before: add Lopez was the best move, one trade sent Barnes. After: add Dosunmu, a new idea gets Morant. */
export const BEFORE = report({
  pickups: [pickup(P.lopez, 0.38, 0.42), pickup(P.dosunmu, 0.38, 0.41)],
  trades: [trade([7, 'Aliaga Hermanos'], [P.barnes], [P.brown], 0.38, 0.4)],
  odds: 0.38,
})

export const AFTER = report({
  pickups: [pickup(P.dosunmu, 0.39, 0.42)],
  trades: [trade([8, 'Gergin Atamans'], [P.holmgren], [P.morant], 0.39, 0.41)],
  odds: 0.39,
})
