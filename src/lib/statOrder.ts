/**
 * The site's one stat column order (Can, 2026-11-08, final): minutes, then shooting (FG FT 3PM),
 * then the box stats (REB AST STL BLK), then TO and PTS on their own. Every table of game or week
 * stats (player game log, Scores box score, Film Room box score) lays out its columns in this
 * order, so change it here only.
 */
export const STAT_COLUMNS = ['MIN', 'FG', 'FT', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'] as const
export type StatColumn = (typeof STAT_COLUMNS)[number]

/** The nine categories in the same order, for lists of category results. */
export const CATEGORY_ORDER = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'] as const
