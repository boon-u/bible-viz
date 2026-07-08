// Popover shown when you click a highlighted spot: lists every highlight
// "session" there (multiple colors/styles can overlap), its titled notes, a
// per-session ✕ delete (only in annotate mode), and ＋ note to attach one.
export default function HighlightSessions({
  pos,
  sessions,
  notesFor,
  annotate,
  onDeleteHighlight,
  onAddNote,
  onOpenNote,
  onClose,
}) {
  return (
    <div className="sessions-popover" style={{ left: pos.x, top: pos.y }}>
      <div className="sessions-head">
        <span>Highlights here</span>
        <button className="sel-close" onClick={onClose}>✕</button>
      </div>
      {sessions.map((s) => {
        const notes = notesFor(s.id);
        return (
          <div key={s.id} className="session-row">
            <span
              className={`session-swatch${s.style === "scribble" ? " scribble" : ""}`}
              style={s.style === "scribble" ? { borderColor: s.color } : { background: s.color }}
            />
            <div className="session-main">
              <div className="session-notes">
                {notes.map((n) => (
                  <button key={n.id} className="session-note" onClick={() => onOpenNote(n)}>
                    {n.title}
                  </button>
                ))}
                <button className="session-addnote" onClick={() => onAddNote(s)}>＋ note</button>
              </div>
            </div>
            {annotate && (
              <button
                className="session-del"
                title="Delete this highlight"
                onClick={() => onDeleteHighlight(s.id)}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
