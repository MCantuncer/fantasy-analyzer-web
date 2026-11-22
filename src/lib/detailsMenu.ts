import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useEscapeLayer } from './escapeStack'

/**
 * A `<details>` menu that closes like any other menu: on a click or tap anywhere outside it,
 * and on Esc (through the shared Esc stack, so a card opened on top closes first).
 * Spread `menuProps` on the `<details>`; `close()` shuts it from inside, e.g. after picking an item.
 */
export function useDetailsMenu() {
  const ref = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const el = ref.current
      if (el?.open && !el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEscapeLayer(open, () => {
    const el = ref.current
    if (!el) return
    el.open = false
    el.querySelector('summary')?.focus()
  })

  const close = () => {
    if (ref.current) ref.current.open = false
  }

  return {
    open,
    close,
    menuProps: {
      ref,
      onToggle: (e: SyntheticEvent<HTMLDetailsElement>) => setOpen(e.currentTarget.open),
    },
  }
}
