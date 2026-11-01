import { useState } from 'react'
import type { Credentials } from '../lib/credentials'
import { parseCookiePaste } from '../lib/cookiePaste'
import './CookieForm.css'

interface Props {
  onSubmit: (creds: Credentials, remember: boolean) => void
  onCancel: () => void
  /** Try the league again without cookies, e.g. after the commissioner made it public. */
  onRetry?: () => void
}

type Way = 'public' | 'cookies'
type Browser = 'chrome' | 'firefox' | 'safari'

// Where the commissioner flips the switch on ESPN. Plain text so it copies cleanly.
const PUBLIC_PATH = ['League', 'Settings', 'Basic Settings', 'Make League Viewable to Public', 'Yes']

const STEPS: Record<Browser, string[]> = {
  chrome: [
    'Open fantasy.espn.com and log in.',
    'Press F12 (Mac: ⌥⌘I), open the Application tab, then Cookies › https://fantasy.espn.com.',
    'Type espn in the filter box, select the espn_s2 and SWID rows, copy and paste them below.',
  ],
  firefox: [
    'Open fantasy.espn.com and log in.',
    'Press F12 (Mac: ⌥⌘I), open the Storage tab, then Cookies › https://fantasy.espn.com.',
    'Click espn_s2, copy its value and paste it below. Do the same for SWID.',
  ],
  safari: [
    'Turn on Settings › Advanced › Show features for web developers, then log in at fantasy.espn.com.',
    'Press ⌥⌘I, open the Storage tab, then Cookies.',
    'Double-click the espn_s2 value, copy and paste it below. Do the same for SWID.',
  ],
}

function isPhone(): boolean {
  try {
    return window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches
  } catch {
    return false
  }
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="4" y="9.5" width="14" height="9.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="11" cy="14.2" r="1.4" fill="currentColor" />
    </svg>
  )
}

function Check({ ok }: { ok: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {ok ? (
        <path d="m3 7.5 2.5 2.5L11 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      ) : (
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      )}
    </svg>
  )
}

export function CookieForm({ onSubmit, onCancel, onRetry }: Props) {
  const phone = isPhone()
  const [way, setWay] = useState<Way>(phone ? 'public' : 'cookies')
  const [browser, setBrowser] = useState<Browser>('chrome')
  const [paste, setPaste] = useState('')
  const [manual, setManual] = useState(false)
  const [espnS2, setEspnS2] = useState('')
  const [swid, setSwid] = useState('')
  const [remember, setRemember] = useState(false)
  const [copied, setCopied] = useState(false)

  const found = parseCookiePaste(paste)
  const creds: Credentials | null = manual
    ? espnS2.trim() && swid.trim()
      ? { espnS2, swid }
      : null
    : found.espnS2 && found.swid
      ? { espnS2: found.espnS2, swid: found.swid }
      : null

  async function sendLink() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // share sheet dismissed or clipboard blocked
    }
  }

  return (
    <section className="card pl-private-league stack" aria-labelledby="private-title">
      <header className="pl-private-head">
        <span className="pl-private-icon">
          <LockIcon />
        </span>
        <div className="pl-stack-sm">
          <h2 id="private-title">This league is private</h2>
          <p className="muted">ESPN keeps private leagues behind a velvet rope. Here are two ways past it.</p>
        </div>
      </header>

      <div className="pl-way-picker" role="radiogroup" aria-label="How to open this league">
        <button
          type="button"
          role="radio"
          aria-checked={way === 'public'}
          className="pl-way"
          onClick={() => setWay('public')}
        >
          <span className="pl-way-title">Ask the commissioner</span>
          <span className="small muted">Works on any phone. Costs you one favor.</span>
          {phone && <span className="tag good pl-way-tag">Best on phone</span>}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={way === 'cookies'}
          className="pl-way"
          onClick={() => setWay('cookies')}
        >
          <span className="pl-way-title">Connect with ESPN cookies</span>
          <span className="small muted">Needs a computer. About 2 minutes.</span>
          {!phone && <span className="tag good pl-way-tag">Fastest</span>}
        </button>
      </div>

      {way === 'public' && (
        <div className="stack pl-way-body pl-commish">
          <p>
            Your commissioner holds the keys. One switch on ESPN opens the league to viewers, read only, so nobody
            can sneak a trade through the back door.
          </p>
          <p className="pl-espn-path" aria-label="Where the setting lives on ESPN">
            {PUBLIC_PATH.map((step, i) => (
              <span key={step}>
                {i > 0 && <span className="pl-espn-path-sep"> &gt; </span>}
                <span className={i === PUBLIC_PATH.length - 1 ? 'pl-espn-path-end' : undefined}>{step}</span>
              </span>
            ))}
          </p>
          <p className="small muted">
            Commissioners answer faster after a win. Picking your moment is half the trade game anyway.
          </p>
          {onRetry && (
            <div className="pl-check-again">
              <button type="button" onClick={onRetry}>
                Check again
              </button>
              <span className="small muted">Flipped it? We'll knock again.</span>
            </div>
          )}
        </div>
      )}

      {way === 'cookies' && phone && (
        <div className="pl-callout pl-stack-sm">
          <strong>Phones can't show cookies</strong>
          <p className="small">
            Mobile browsers hide them. Open this page on a computer, connect there, and you're set on that device.
          </p>
          <div className="row">
            <button type="button" className="secondary" onClick={sendLink}>
              {copied ? 'Copied' : 'Send this page to my computer'}
            </button>
          </div>
        </div>
      )}

      {way === 'cookies' && (
        <form
          className="stack pl-way-body"
          onSubmit={(e) => {
            e.preventDefault()
            if (creds) onSubmit(creds, remember)
          }}
        >
          <div className="segmented pl-browsers" role="group" aria-label="Your browser">
            {(['chrome', 'firefox', 'safari'] as const).map((b) => (
              <button key={b} type="button" aria-pressed={browser === b} onClick={() => setBrowser(b)}>
                {b === 'chrome' ? 'Chrome · Edge' : b === 'firefox' ? 'Firefox' : 'Safari'}
              </button>
            ))}
          </div>
          <ol className="pl-steps">
            {STEPS[browser].map((s, i) => (
              <li key={i}>
                <span className="pl-step-num">{i + 1}</span>
                <p>{s}</p>
              </li>
            ))}
          </ol>

          {manual ? (
            <div className="pl-stack-sm">
              <label>
                espn_s2
                <input value={espnS2} onChange={(e) => setEspnS2(e.target.value)} autoComplete="off" spellCheck={false} />
              </label>
              <label>
                SWID
                <input
                  value={swid}
                  onChange={(e) => setSwid(e.target.value)}
                  placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </div>
          ) : (
            <div className="pl-stack-sm">
              <label htmlFor="cookie-paste">Paste here</label>
              <textarea
                id="cookie-paste"
                className="pl-cookie-paste"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="Paste the rows, or both values in any order. We'll find espn_s2 and SWID."
                rows={3}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="pl-found" aria-live="polite">
                <span className={found.espnS2 ? 'pl-found-item ok' : 'pl-found-item'}>
                  <Check ok={!!found.espnS2} /> espn_s2
                </span>
                <span className={found.swid ? 'pl-found-item ok' : 'pl-found-item'}>
                  <Check ok={!!found.swid} /> SWID
                </span>
              </div>
            </div>
          )}
          <button type="button" className="link small pl-self-start" onClick={() => setManual(!manual)}>
            {manual ? 'Paste both at once instead' : 'Enter them one by one instead'}
          </button>

          <label className="row small">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>
          <div className="row">
            <button type="submit" disabled={!creds}>
              Open league
            </button>
            <button type="button" className="secondary" onClick={onCancel}>
              Back
            </button>
          </div>

          <p className="pl-trust small muted">
            <LockIcon /> Used only to read your league from ESPN. Never saved on our server or logged. They work like
            a password, so only paste them into sites you trust. Logging out of ESPN turns them off.
          </p>
        </form>
      )}

    </section>
  )
}
