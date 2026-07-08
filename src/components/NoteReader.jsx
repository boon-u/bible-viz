import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { inlineRefsToMarkdown, parseRef, refLabelOf } from "../lib/refs";
import { noteAnchor } from "../lib/notes";
import { readStatsForAnchor } from "../lib/aggregate";
import { fmtDate } from "../lib/store";

// Read-only view of a single note: title, anchor, rendered Markdown with clickable
// cross-references, tags, and how often the anchored passage has been read.
export default function NoteReader({ note, reads, onOpenRef, onDelete, onBack }) {
  const anchor = noteAnchor(note);
  const anchorLabel = refLabelOf(anchor);
  const stats = useMemo(() => readStatsForAnchor(reads, anchor), [reads, anchor]);
  const md = useMemo(() => inlineRefsToMarkdown(note.body), [note.body]);

  // react-markdown link renderer: `ref:` links are clickable cross-references.
  const components = {
    a({ href, children }) {
      if (href?.startsWith("ref:")) {
        const raw = decodeURIComponent(href.slice(4));
        return (
          <button className="xref-inline" onClick={() => onOpenRef(parseRef(raw))}>
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
  };

  return (
    <main className="page notereader">
      <div className="book-topbar">
        <button className="ghost-btn" onClick={onBack}>← Notes</button>
        <span className={`note-cat cat-${note.category}`}>{note.category}</span>
        {onDelete && (
          <button
            className="delete-btn"
            title="Delete this note"
            onClick={() => {
              if (confirm(`Delete note "${note.title}"?`)) onDelete(note.id);
            }}
          >
            Delete
          </button>
        )}
      </div>

      <h1 className="note-title">{note.title}</h1>

      <div className="note-meta">
        {anchorLabel && (
          <button className="note-anchor" onClick={() => onOpenRef(anchor)}>
            {anchorLabel}
          </button>
        )}
        {stats.events > 0 && (
          <span className="note-readstat">
            read {stats.events}× · {stats.days} day{stats.days === 1 ? "" : "s"}
            {stats.lastDate ? ` · last ${fmtDate(stats.lastDate)}` : ""}
          </span>
        )}
        {note.source && <span className="note-source">source: {note.source}</span>}
      </div>

      {note.tags.length > 0 && (
        <div className="note-tags">
          {note.tags.map((t) => (
            <span key={t} className="tag-chip">#{t}</span>
          ))}
        </div>
      )}

      <div className="note-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {md}
        </ReactMarkdown>
      </div>

      {note.refs.length > 0 && (
        <div className="note-xrefs">
          <h3>Cross-references</h3>
          <div className="xref-list">
            {note.refs.map((r, i) => (
              <button key={i} className="xref-chip" onClick={() => onOpenRef(r)}>
                {r.book ? refLabelOf(r) : r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
