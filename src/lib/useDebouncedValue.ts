import { useEffect, useState } from 'react'

/**
 * ``value`` once it has stayed the same for ``ms``: each change restarts the wait, so a burst of
 * picks settles into one value (and one search) instead of one per click.
 */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}
