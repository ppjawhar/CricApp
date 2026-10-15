export type ScorerOption = {
  userId: string;
  name?: string;
  email?: string;
  role: "admin" | "organizer" | "member";
};

function scorerName(scorer?: ScorerOption) {
  return scorer?.name || scorer?.email || "Club admin";
}

function scorerInitials(scorer?: ScorerOption) {
  return scorerName(scorer)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function AssignedScorerCard({
  scorer,
  onEdit,
}: {
  scorer?: ScorerOption;
  onEdit?: () => void;
}) {
  return (
    <div className="assigned-scorer-card">
      <span className="scorer-avatar">{scorerInitials(scorer)}</span>
      <span className="assigned-scorer-copy">
        <small>Assigned scorer</small>
        <strong>{scorerName(scorer)}</strong>
        <span>
          {scorer?.email && scorer.name ? scorer.email : "Email unavailable"}
          {scorer?.role ? ` · ${scorer.role}` : ""}
        </span>
      </span>
      {onEdit && (
        <button
          type="button"
          className="scorer-edit-button"
          onClick={onEdit}
          aria-label={`Change scorer from ${scorerName(scorer)}`}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ScorerPickerSheet({
  currentScorer,
  options,
  busy = false,
  onSelect,
  onDismiss,
}: {
  currentScorer?: ScorerOption;
  options: ScorerOption[];
  busy?: boolean;
  onSelect: (scorerId: string) => void;
  onDismiss: () => void;
}) {
  const otherMembers = options.filter(
    (member) => member.userId !== currentScorer?.userId,
  );

  return (
    <div className="scorer-sheet-backdrop" onMouseDown={onDismiss}>
      <section
        className="scorer-picker-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scorer-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header className="scorer-sheet-header">
          <span>
            <small>MATCH ACCESS</small>
            <h2 id="scorer-picker-title">Choose scorer</h2>
          </span>
          <button type="button" onClick={onDismiss} aria-label="Close scorer selection">
            ×
          </button>
        </header>
        <p>
          The assigned scorer has exclusive scoring access. Other members can
          continue viewing the match.
        </p>
        <AssignedScorerCard scorer={currentScorer} />
        <h3>Other club members</h3>
        <div className="scorer-option-list">
          {otherMembers.map((member) => (
            <button
              type="button"
              key={member.userId}
              onClick={() => onSelect(member.userId)}
              disabled={busy}
            >
              <span className="scorer-avatar">{scorerInitials(member)}</span>
              <span>
                <strong>{scorerName(member)}</strong>
                <small>{member.email || "Email unavailable"}</small>
              </span>
              <b>{member.role}</b>
              <i aria-hidden="true">›</i>
            </button>
          ))}
          {!otherMembers.length && (
            <div className="scorer-options-empty">
              No other club members are available.
            </div>
          )}
        </div>
        {busy && <div className="scorer-sheet-progress">Updating scorer…</div>}
      </section>
    </div>
  );
}
