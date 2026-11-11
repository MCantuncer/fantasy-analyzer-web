import './SeatNote.css'

interface Props {
  teamName: string
  onVerify: () => void
  onChange: () => void
}

/** One quiet line while a manager looks at the team they picked but have not proven on ESPN yet. */
export function SeatNote({ teamName, onVerify, onChange }: Props) {
  return (
    <p className="seat-note small">
      <span className="muted">
        Showing <strong>{teamName}</strong>, not verified yet. Verify it to use League Chat, save trade rules and keep
        these moves private.
      </span>
      <span className="seat-note-actions">
        <button type="button" className="link" onClick={onVerify}>
          Verify my team
        </button>
        <button type="button" className="link" onClick={onChange}>
          Not your team?
        </button>
      </span>
    </p>
  )
}
