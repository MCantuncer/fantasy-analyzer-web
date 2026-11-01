// Phone fixes, one stylesheet each. main.tsx imports this module right after index.css,
// so these load after the base styles and win ties. (A glob written in main.tsx itself
// would be hoisted above index.css and lose.)
import.meta.glob('./*.css', { eager: true })
