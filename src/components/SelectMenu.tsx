import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useEscapeLayer } from '../lib/escapeStack'
import './SelectMenu.css'

export interface SelectOption<T> {
  value: T
  /** Plain text: the button shows it, screen readers read it, and typing its first letters jumps to it. */
  label: string
  /** What the row shows in the list, when it is richer than the label (logos, a time). */
  row?: ReactNode
  /** A quiet note at the end of the row, such as "Final" or a tip-off time. */
  meta?: ReactNode
  /** Draw a thin line under this row, to set "All ..." apart from the rest. */
  rule?: boolean
}

interface Props<T> {
  /** The field's name for screen readers, e.g. "Game". */
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** Class on the wrapper, so a page can size and colour the button. */
  className?: string
  /** Which edge of the button the list lines up with on wide screens. */
  align?: 'start' | 'end'
}

const TYPE_RESET_MS = 600

/**
 * A select in the site's own look: a button that opens a list in a menu card, instead of the
 * browser's grey system list. Keyboard works like a native select (the WAI-ARIA select-only
 * combobox): focus stays on the button, Up/Down/Home/End move, Enter or Space picks, typing jumps
 * to a row, Tab and a click outside close it, and Esc closes it through the shared Esc stack.
 */
export function SelectMenu<T>({ label, value, options, onChange, className, align = 'start' }: Props<T>) {
  const id = useId()
  const listId = `${id}-list`
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [up, setUp] = useState(false)
  const typed = useRef({ text: '', at: 0 })

  const chosen = Math.max(
    0,
    options.findIndex((o) => Object.is(o.value, value)),
  )
  const current = options[chosen]

  const show = (at = chosen) => {
    setActive(Math.min(Math.max(at, 0), options.length - 1))
    setOpen(true)
  }
  const close = (focus = true) => {
    setOpen(false)
    if (focus) button.current?.focus()
  }
  const pick = (i: number) => {
    const o = options[i]
    close()
    if (o && !Object.is(o.value, value)) onChange(o.value)
  }

  useEscapeLayer(open, () => close())

  // A click or tap anywhere else closes it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Open upward when the button sits low on the screen and there is more room above.
  useLayoutEffect(() => {
    if (!open || !button.current || !list.current) return
    const b = button.current.getBoundingClientRect()
    const below = window.innerHeight - b.bottom
    setUp(below < Math.min(list.current.scrollHeight, 320) + 16 && b.top > below)
  }, [open])

  // Keep the active row in view while the arrows walk the list.
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active])

  const jump = (key: string) => {
    const now = Date.now()
    const t = typed.current
    t.text = now - t.at > TYPE_RESET_MS ? key : t.text + key
    t.at = now
    const q = t.text.toLowerCase()
    const from = open ? active : chosen
    const order = options.map((_, k) => (from + (t.text.length === 1 ? 1 : 0) + k) % options.length)
    const hit = order.find((k) => options[k].label.toLowerCase().startsWith(q))
    if (hit != null) show(hit)
  }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        show(e.key === 'Home' ? 0 : last)
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
        jump(e.key)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (e.altKey) return pick(active)
        setActive((a) => Math.min(a + 1, last))
        return
      case 'ArrowUp':
        e.preventDefault()
        if (e.altKey) return pick(active)
        setActive((a) => Math.max(a - 1, 0))
        return
      case 'Home':
      case 'PageUp':
        e.preventDefault()
        setActive(0)
        return
      case 'End':
      case 'PageDown':
        e.preventDefault()
        setActive(last)
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        pick(active)
        return
      case 'Tab':
        close(false)
        return
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) jump(e.key)
    }
  }

  return (
    <div ref={wrap} className={`selm${className ? ` ${className}` : ''}`} data-open={open || undefined}>
      <button
        ref={button}
        type="button"
        role="combobox"
        className="selm-btn"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
      >
        <span className="selm-val">{current?.label}</span>
        <svg className="selm-chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        hidden={!open}
        className={`selm-pop${align === 'end' ? ' end' : ''}${up ? ' up' : ''}`}
      >
        {options.map((o, i) => (
          <li
            key={String(o.value)}
            id={`${id}-o${i}`}
            data-i={i}
            role="option"
            aria-selected={i === chosen}
            data-active={(open && i === active) || undefined}
            className={`selm-opt${o.rule ? ' rule' : ''}`}
            onPointerMove={() => setActive(i)}
            // Keep focus on the button, so the keyboard keeps working after a hover.
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => pick(i)}
          >
            <span className="selm-row">{o.row ?? o.label}</span>{' '}
            {o.meta != null && <span className="selm-meta">{o.meta}</span>}
            <svg className="selm-check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              {i === chosen && <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" fill="none" />}
            </svg>
          </li>
        ))}
      </ul>
    </div>
  )
}
