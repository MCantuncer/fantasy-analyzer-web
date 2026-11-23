import { X } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { useEscapeLayer } from '../lib/escapeStack'
import { MIN_ODD, num } from '../lib/iddaaCompare'
import type { BookCompare } from '../lib/iddaaCompare'
import './HowToRead.css'

/** How to read Our Estimates: every explanation the page used to carry, as one term list in a
 *  native modal dialog. Esc closes it through the escape stack (so a card opened on top closes
 *  first), a click on the backdrop closes it too, and focus goes back to the button that opened it. */
export function HowToRead({ bands, onClose }: { bands: BookCompare['bands'] | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEscapeLayer(true, onClose)
  useEffect(() => {
    const d = ref.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (d && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '') // older engines (and jsdom): still shown, still focusable
    }
    return () => {
      if (d?.open && typeof d.close === 'function') d.close()
      opener?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="ic-how"
      aria-labelledby="ic-how-h"
      // The escape stack handles Esc; the browser's own close request (Android back) closes the same way.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose() // the backdrop, outside the sheet
      }}
    >
      <div className="ic-how-in">
        <div className="ic-how-h">
          <h2 id="ic-how-h">How to read</h2>
          <button type="button" className="ic-ib" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="ic-how-lede">
          iddaa's lines at the last look before each tip-off, set against ours. For comparison only: iddaa never feeds
          our model.
        </p>
        <dl className="ic-how-dl">
          <dt>
            <i>Kupon</i>
          </dt>
          <dd>
            iddaa's word for a bet slip: a few picks whose odds multiply. Every pick has to win for it to pay. At most
            two picks from one game, and only ones that barely move together (Surprise keeps one). If a player sits
            out, iddaa counts his pick at <span className="num">1.00</span>.
          </dd>
          <dt>Total odds · Probability</dt>
          <dd>
            The picks' odds multiplied, and our chances multiplied. iddaa's own odds only; {MIN_ODD.toFixed(2)} or less
            is ignored.
          </dd>
          <dt>Our chance</dt>
          <dd>How often we expect the bet to win. The bar is the same number.</dd>
          <dt>Bet</dt>
          <dd>One bet per player: iddaa's highest rung at or under our number. None there means no bet.</dd>
          <dt>Gap</dt>
          <dd>
            Ours minus the book. Ranked in bands
            {bands ? (
              <>
                , so +{num(bands.reb / 2)} rebounds and +{num(bands.pts / 2)} points weigh the same
              </>
            ) : null}
            . The book's lines have its margin removed.
          </dd>
          <dt>Closer</dt>
          <dd>
            Once a game is final, the side nearer the result; level within 0.1. A winner pick is right when that team
            won.
          </dd>
          <dt>Value rungs</dt>
          <dd>Our chance × odds − 1. Above 0 pays more than it should.</dd>
          {bands && (
            <>
              <dt>Bands</dt>
              <dd>
                Points <span className="num">{bands.pts}</span>, rebounds and assists{' '}
                <span className="num">{bands.reb}</span>, 3PM, steals and blocks <span className="num">{bands.stl}</span>,
                team points <span className="num">{bands.team_pts}</span>, total <span className="num">{bands.total}</span>,
                margin <span className="num">{bands.margin}</span>.
              </dd>
            </>
          )}
        </dl>
      </div>
    </dialog>
  )
}
