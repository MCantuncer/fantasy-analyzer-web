import './YouTag.css'

/**
 * The "your team" mark: a small gold "You" tag that sits right after your team's name. It's a
 * word, so it reads on sight. Leave it out wherever the name itself already says "You".
 */
export function YouTag() {
  return <span className="youtag">You</span>
}
