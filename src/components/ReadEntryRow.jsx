import { fmtDate, refLabel } from "../lib/store";

export default function ReadEntryRow({ read, onDelete }) {
  return (
    <div className="read-entry-row">
      <span className="read-entry-ref">{refLabel(read)}</span>
      <span className="read-entry-date">{fmtDate(read.date)}</span>
      <button
        type="button"
        className="delete-btn"
        title="Delete this read"
        aria-label={`Delete ${refLabel(read)}`}
        onClick={() => onDelete(read.id)}
      >
        ✕
      </button>
    </div>
  );
}
