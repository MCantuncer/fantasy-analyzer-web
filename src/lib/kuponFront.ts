import { flushSync } from 'react-dom'
import type { CouponKind } from './coupons'

/** Brings a Kupon to the front of the phone stack (KuponStack) from elsewhere on the page (the Night
 *  File's jumps), at once and without moving focus: the caller scrolls to it next. */
export const FRONT_EVENT = 'ic-ku-front'
export function bringKupon(kind: CouponKind) {
  flushSync(() => window.dispatchEvent(new CustomEvent<CouponKind>(FRONT_EVENT, { detail: kind })))
}
