import {
  ArrowsLeftRight,
  ChatCircleDots,
  Crosshair,
  DotsThreeOutline,
  Lightning,
  Newspaper,
  Pulse,
  Television,
  Trophy,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import './SectionNav.css'

export interface Section {
  id: string
  label: string
}

/** One icon per section: outline at rest, filled for the open one. */
const ICON: Record<string, Icon> = {
  moves: Lightning,
  park: ArrowsLeftRight,
  'trade-for': Crosshair,
  team: UsersThree,
  league: Trophy,
  overview: Trophy,
  scores: Television,
  news: Newspaper,
  chat: ChatCircleDots,
  feed: Pulse,
}

/** Short names for the phone's bottom bar, where five items share 360px. */
const SHORT: Record<string, string> = {
  park: 'Trades',
  'trade-for': 'Trade For',
  team: 'Team',
  news: 'News',
  chat: 'Chat',
  feed: 'Feed',
  overview: 'League',
}

/** The bottom bar keeps four sections in reach; the rest sit behind More. */
const PHONE_FIRST = ['moves', 'park', 'team', 'league']

function SectionIcon({ id, active, size }: { id: string; active: boolean; size: number }) {
  const I = ICON[id]
  return I ? <I className="sn-ic" size={size} weight={active ? 'fill' : 'regular'} aria-hidden="true" /> : null
}

/**
 * The section tabs: a row of icon + label tabs under the top bar on wider screens, and a
 * fixed bottom bar on phones (four sections plus More). Both drive the same tab state.
 */
export function SectionNav({
  sections,
  active,
  onSelect,
  tabsRef,
}: {
  sections: readonly Section[]
  active: string
  onSelect: (id: string) => void
  tabsRef?: Ref<HTMLElement>
}) {
  return (
    <>
      <nav ref={tabsRef} className="tabs sn-tabs" role="tablist" aria-label="Sections">
        {sections.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            className="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => onSelect(t.id)}
          >
            <SectionIcon id={t.id} active={active === t.id} size={17} />
            {t.label}
          </button>
        ))}
      </nav>
      {/* On the page body, not in the sticky top bar's stacking context, so it layers over toasts. */}
      {createPortal(<BottomBar sections={sections} active={active} onSelect={onSelect} />, document.body)}
    </>
  )
}

function BottomBar({
  sections,
  active,
  onSelect,
}: {
  sections: readonly Section[]
  active: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const bar = useRef<HTMLElement>(null)
  // Five or fewer sections fit as they are; more keep the first four and fold the rest into More.
  const first = sections.length <= 5 ? sections : PHONE_FIRST.flatMap((id) => sections.filter((s) => s.id === id))
  const rest = sections.length <= 5 ? [] : sections.filter((s) => !first.includes(s))
  const moreActive = rest.some((s) => s.id === active)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !bar.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const pick = (id: string) => {
    setOpen(false)
    onSelect(id)
    window.scrollTo?.({ top: 0 })
  }

  return (
    <nav ref={bar} className="sn-bar" aria-label="Sections">
      {open && (
        <ul className="sn-more" id="sn-more">
          {rest.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="sn-more-item"
                aria-current={active === s.id ? 'page' : undefined}
                onClick={() => pick(s.id)}
              >
                <SectionIcon id={s.id} active={active === s.id} size={20} />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {first.map((s) => (
        <button
          key={s.id}
          type="button"
          className="sn-item"
          aria-current={active === s.id ? 'page' : undefined}
          onClick={() => pick(s.id)}
        >
          <SectionIcon id={s.id} active={active === s.id} size={22} />
          <span>{SHORT[s.id] ?? s.label}</span>
        </button>
      ))}
      {rest.length > 0 && (
        <button
          type="button"
          className="sn-item"
          aria-expanded={open}
          aria-controls="sn-more"
          aria-current={moreActive ? 'page' : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <DotsThreeOutline className="sn-ic" size={22} weight={moreActive || open ? 'fill' : 'regular'} aria-hidden="true" />
          <span>{moreActive ? (SHORT[active] ?? rest.find((s) => s.id === active)?.label) : 'More'}</span>
        </button>
      )}
    </nav>
  )
}
