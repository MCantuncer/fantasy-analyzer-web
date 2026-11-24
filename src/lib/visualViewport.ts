import { useEffect } from 'react'

/** Pins the sheet to the part of the screen the keyboard leaves (iOS moves the page, not the layout). */
export function useVisualViewport(active: boolean, el: HTMLElement | null) {
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !el || !vv) return
    let frame = 0
    const apply = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--ps-vvh', `${vv.height}px`)
        el.style.setProperty('--ps-vvy', `${vv.offsetTop}px`)
        el.classList.toggle('ps-kb-up', window.innerHeight - vv.height > 120)
      })
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [active, el])
}
