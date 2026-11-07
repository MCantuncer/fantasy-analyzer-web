/** A small turning ring for something that is working (it stands still for reduced motion). */
export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className ? `spinner ${className}` : 'spinner'}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="30 20" />
    </svg>
  )
}
