import { useEffect, useRef } from 'react'

/**
 * One Esc closes one layer. Every card, sheet, box score or menu that Esc can close registers here
 * while it is open; a single document listener closes only the newest one. So a player card opened
 * on top of a box score closes first, and the box score waits for the next Esc.
 */

type Layer = { close: () => void }

const layers: Layer[] = []

function onKey(e: KeyboardEvent) {
  // A field that handles Esc itself (and calls preventDefault) keeps it.
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return
  const top = layers[layers.length - 1]
  if (!top) return
  e.preventDefault()
  top.close()
}

/** Adds a layer on top; the returned function takes it off again (from wherever it sits). */
export function pushEscapeLayer(close: () => void): () => void {
  const layer: Layer = { close }
  if (!layers.length) document.addEventListener('keydown', onKey)
  layers.push(layer)
  return () => {
    const i = layers.indexOf(layer)
    if (i >= 0) layers.splice(i, 1)
    if (!layers.length) document.removeEventListener('keydown', onKey)
  }
}

/** How many layers are open (tests). */
export function escapeLayerCount(): number {
  return layers.length
}

/**
 * While `active`, Esc calls `onEscape`, unless something opened after it is still open.
 * The layer keeps its place in the stack when `onEscape` changes between renders.
 */
export function useEscapeLayer(active: boolean, onEscape: () => void) {
  const latest = useRef(onEscape)
  useEffect(() => {
    latest.current = onEscape
  })
  useEffect(() => {
    if (!active) return
    return pushEscapeLayer(() => latest.current())
  }, [active])
}
