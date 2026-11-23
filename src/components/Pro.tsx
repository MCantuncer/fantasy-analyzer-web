import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CaretRight, Eye, X } from '@phosphor-icons/react'
import type { Me, PlanFeature } from '../api/client'
import { hasFeature, shortDate } from '../lib/plans'
import { ProContext, usePro, type ProApi } from '../lib/pro'
import type { Theme } from '../lib/theme'
import { ProSheet } from './ProSheet'
import './Pro.css'

const PREVIEW_KEY = 'court.previewFree'

function readPreview(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

/** The Pro mark: a solid ink tag, never gold. ``label`` false when a button around it names it. */
export function ProMark({ size = 'sm', label = true }: { size?: 'sm' | 'md' | 'lg'; label?: boolean }) {
  const cls = size === 'sm' ? 'pro' : `pro pro-${size}`
  return label ? (
    <span className={cls} role="img" aria-label="Pro feature">
      PRO
    </span>
  ) : (
    <span className={cls} aria-hidden="true">
      PRO
    </span>
  )
}

/**
 * One quiet lock where a Pro spot would sit: "PRO · His line for tonight · See Pro >".
 * ``words`` is what the spot holds; ``plural`` when they are things ("…are a Pro feature").
 */
export function ProLock({ words, plural = false }: { words: string; plural?: boolean }) {
  const { open } = usePro()
  return (
    <button
      type="button"
      className="pro-lock"
      aria-haspopup="dialog"
      aria-label={`${words} ${plural ? 'are' : 'is'} a Pro feature. See Pro plans`}
      onClick={open}
    >
      <ProMark label={false} />
      <span className="pro-lock-t">{words}</span>
      <span className="pro-lock-go">
        See Pro
        <CaretRight size={16} weight="bold" aria-hidden="true" />
      </span>
    </button>
  )
}

/** The Scores card foot for Free: "Our call [PRO]", opening the sheet. */
export function ProCall() {
  const { open } = usePro()
  return (
    <button
      type="button"
      className="pro-call"
      aria-haspopup="dialog"
      aria-label="Our call, Pro feature. See Pro plans"
      onClick={open}
    >
      Our call
      <ProMark label={false} />
    </button>
  )
}

/** Admins with the Free preview on: a reminder in the top bar, and the way out. */
export function ProPreviewPill() {
  const { previewFree, setPreviewFree } = usePro()
  if (!previewFree) return null
  return (
    <span className="pro-preview" role="status">
      <Eye size={16} aria-hidden="true" />
      <span className="hide-sm">Free preview</span>
      <button type="button" onClick={() => setPreviewFree(false)}>
        Turn off
      </button>
    </span>
  )
}

function welcomeText(me: Me): ReactNode {
  const trial = me.trial_ends ? new Date(me.trial_ends) : null
  return (
    <>
      <b>You're Pro.</b>{' '}
      {trial ? `Free trial to ${shortDate(trial)}. Nothing charged today.` : 'Every Pro spot is open now.'}
    </>
  )
}

/** "You're Pro." after checkout: 6 s, held while hovered or focused, with a Close button. */
function ProToast({ me, onClose }: { me: Me; onClose: () => void }) {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held) return
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [held, onClose])
  return (
    <div
      className="pro-toast"
      role="status"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <ProMark size="md" />
      <span className="pro-toast-t">{welcomeText(me)}</span>
      <button type="button" className="icon pro-toast-x" aria-label="Close" onClick={onClose}>
        <X size={18} weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Pro for the whole site: which spots show their content, the upgrade sheet, the welcome toast and
 * the admin Free preview. A visitor's lock asks for an account first (``onNeedAccount``).
 */
export function ProProvider({
  me,
  signedIn,
  visitorLocked = false,
  theme,
  onNeedAccount,
  children,
}: {
  me: Me | undefined
  signedIn: boolean
  /** Signed out, plans on: the sample league's Pro spots show their locks (the API blanks them). */
  visitorLocked?: boolean
  theme: Theme
  onNeedAccount: () => void
  children: ReactNode
}) {
  const [sheet, setSheet] = useState(false)
  const [welcome, setWelcome] = useState<Me | null>(null)
  const [previewFree, setPreview] = useState(readPreview)
  const preview = previewFree && !!me?.admin
  const needAccount = useRef(onNeedAccount)
  useEffect(() => {
    needAccount.current = onNeedAccount
  })

  const setPreviewFree = useCallback((on: boolean) => {
    setPreview(on)
    try {
      if (on) localStorage.setItem(PREVIEW_KEY, '1')
      else localStorage.removeItem(PREVIEW_KEY)
    } catch {
      // private window: the preview lasts this visit only
    }
  }, [])

  const api = useMemo<ProApi>(
    () => ({
      me,
      has: (feature: PlanFeature) => (signedIn ? !preview && hasFeature(me, feature) : !visitorLocked),
      open: () => (signedIn ? setSheet(true) : needAccount.current()),
      previewFree: preview,
      setPreviewFree,
    }),
    [me, preview, signedIn, visitorLocked, setPreviewFree],
  )
  const closeSheet = useCallback(() => setSheet(false), [])
  const closeWelcome = useCallback(() => setWelcome(null), [])

  return (
    <ProContext.Provider value={api}>
      {children}
      {sheet && signedIn && (
        <ProSheet
          theme={theme}
          onClose={closeSheet}
          onPro={(next) => {
            setSheet(false)
            setWelcome(next)
          }}
        />
      )}
      {welcome && <ProToast me={welcome} onClose={closeWelcome} />}
    </ProContext.Provider>
  )
}
