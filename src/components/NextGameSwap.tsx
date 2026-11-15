// "Next game": the opened FA row's swap, one game long. His line over the line of the player he
// replaces, in the site's stat column order, a divider between them. One number per
// stat, never a range. The better number in each category is bold; ties stay plain on both sides.
// The players carry an icon only (+ you add, − you drop), with words for screen readers. It takes
// the place of the "Players in this move" chips: each name still opens the player's card.
import { Minus, Plus } from '@phosphor-icons/react'
import type { PickupIdea } from '../api/client'
import { better, lineCells, LINE_LABELS, type LineCell } from '../lib/nextGame'
import { usePlayerCard } from '../lib/playerCard'
import { PlayerHead } from './PlayerHead'
import './NextGameSwap.css'

type Player = PickupIdea['add']
type Side = 'add' | 'drop'

const COLS = LINE_LABELS.length

/** + or − and the face and name; the name is a button to his card inside a league. */
function Who({ player, side, byTrade }: { player: Player; side: Side; byTrade: boolean }) {
  const card = usePlayerCard()
  const Icon = side === 'add' ? Plus : Minus
  const said = side === 'add' ? 'You add' : byTrade ? 'You trade' : 'You drop'
  const inner = (
    <>
      <PlayerHead player={player} size={20} team={player.pro_team} />
      <span className="ng-name">{player.name}</span>
    </>
  )
  return (
    <span className="ng-who-line">
      <span className="ng-mark" role="img" aria-label={said}>
        <Icon size={13} weight="bold" aria-hidden="true" />
      </span>
      {card && player.id > 0 ? (
        <button
          type="button"
          className="ng-who"
          aria-haspopup="dialog"
          onPointerEnter={(e) => e.pointerType === 'mouse' && card.prefetch(player)}
          onPointerDown={() => card.prefetch(player)}
          onClick={() => card.open(player)}
        >
          {inner}
        </button>
      ) : (
        <span className="ng-who">{inner}</span>
      )}
    </span>
  )
}

interface RowsProps {
  player: Player
  side: Side
  byTrade: boolean
  cells: LineCell[] | null
  other: LineCell[] | null
}

function Rows({ player, side, byTrade, cells, other }: RowsProps) {
  return (
    <tbody className="ng-player" data-side={side}>
      <tr>
        <th scope="rowgroup" colSpan={COLS}>
          <Who player={player} side={side} byTrade={byTrade} />
        </th>
      </tr>
      <tr className="ng-nums">
        {cells ? (
          cells.map((c, i) => {
            const o = other?.[i].value ?? null
            const win = side === 'add' ? better(c.key, c.value, o) : better(c.key, o, c.value)
            return (
              <td key={c.key} data-key={c.key} data-win={win === side ? '' : undefined} className="num">
                {c.text}
              </td>
            )
          })
        ) : (
          <td colSpan={COLS} className="ng-out">
            Listed out: no line for his next game
          </td>
        )}
      </tr>
    </tbody>
  )
}

interface Props {
  add: Player
  drop: Player
  /** The spot opens by trading the drop player away instead of releasing him. */
  byTrade?: boolean
  /** His game is on right now (the Today slip says "Playing now"): the line is for this game. */
  live?: boolean
}

/** The swap for one game. Nothing when he has no line (listed out): the row's reasons say why. */
export function NextGameSwap({ add, drop, byTrade = false, live = false }: Props) {
  const line = add.next_game
  if (!line) return null
  const mine = lineCells(line)
  const theirs = drop.next_game ? lineCells(drop.next_game) : null
  return (
    <section className="ng" aria-labelledby={`ng-${add.id}`}>
      <p className="ng-head detail-label" id={`ng-${add.id}`}>
        {live ? 'This game' : 'Next game'}
      </p>
      <div className="ng-well">
        <table className="ng-table">
          <colgroup>
            {LINE_LABELS.map((l) => (
              <col key={l.key} className={l.key.endsWith('%') ? 'ng-col-pct' : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {LINE_LABELS.map((l) => (
                <th key={l.key} scope="col" data-key={l.key}>
                  <span aria-hidden="true">{l.key}</span>
                  <span className="sr-only">{l.word}</span>
                </th>
              ))}
            </tr>
          </thead>
          <Rows player={add} side="add" byTrade={byTrade} cells={mine} other={theirs} />
          <Rows player={drop} side="drop" byTrade={byTrade} cells={theirs} other={mine} />
        </table>
        <p className="ng-foot">A usual night, not a promise</p>
      </div>
    </section>
  )
}
