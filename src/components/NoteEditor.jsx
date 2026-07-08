import { useState } from "react";

// Titled note editor (title required) with a link-to-note picker. Media (images /
// scribbles) is planned next — the model already carries it.
export default function NoteEditor({ initial, notesForLinks = [], onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(initial.title || "");
  const [body, setBody] = useState(initial.body || "");

  const insertLink = (id) => {
    const n = notesForLinks.find((x) => x.id === id);
    if (!n) return;
    setBody((b) => `${b}${b && !b.endsWith("\n") ? " " : ""}[${n.title}](note:${n.id})`);
  };

  return (
    <div className="note-editor-overlay" onClick={onCancel}>
      <div className="note-editor" onClick={(e) => e.stopPropagation()}>
        <div className="note-editor-head">{initial.ref}</div>
        <input
          className="note-title-input"
          placeholder="Note title…"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="note-editor-text"
          placeholder="Write your note (Markdown supported)…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {notesForLinks.length > 0 && (
          <div className="note-link-row">
            <label>Link to note</label>
            <select
              value=""
              onChange={(e) => {
                insertLink(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">choose…</option>
              {notesForLinks.map((n) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
          </div>
        )}
        <div className="note-editor-actions">
          {onDelete && (
            <button className="delete-btn" onClick={onDelete}>Delete</button>
          )}
          <button className="ghost-btn" onClick={onCancel}>Cancel</button>
          <button
            className="primary-btn"
            disabled={!title.trim()}
            onClick={() => onSave({ title: title.trim(), body })}
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
