import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { inlineRefsToMarkdown, parseRef } from "../lib/refs";

// Allow our custom ref:/note: link schemes (react-markdown strips them by
// default); still block javascript: URLs.
const urlTransform = (url) => (/^javascript:/i.test(url) ? "" : url);

// Side panel of the page's notes, collapsed to titles. Expand one (or all) to
// read; bodies render Markdown with clickable note-to-note and scripture links.
export default function NotesPanel({
  notes,
  expanded,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onEdit,
  onOpenNoteLink,
  onOpenRef,
}) {
  if (!notes.length) return null;

  const components = {
    a({ href, children }) {
      if (href?.startsWith("note:")) {
        return (
          <button className="note-inline-link" onClick={() => onOpenNoteLink(href.slice(5))}>
            {children}
          </button>
        );
      }
      if (href?.startsWith("ref:")) {
        return (
          <button
            className="xref-inline"
            onClick={() => onOpenRef(parseRef(decodeURIComponent(href.slice(4))))}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer">{children}</a>
      );
    },
  };

  return (
    <aside className="notes-panel">
      <div className="notes-panel-head">
        <span className="notes-panel-title">Notes on this page</span>
        <div className="notes-panel-tools">
          <button onClick={onExpandAll}>Expand all</button>
          <button onClick={onCollapseAll}>Collapse all</button>
        </div>
      </div>
      {notes.map((n) => {
        const open = expanded.has(n.id);
        return (
          <div key={n.id} id={`panel-note-${n.id}`} className={`panel-note${open ? " open" : ""}`}>
            <button className="panel-note-title" onClick={() => onToggle(n.id)}>
              <span className="panel-note-ref">
                {n.chapter}:{n.verseStart}
                {n.verseEnd !== n.verseStart ? `–${n.verseEnd}` : ""}
              </span>
              <span className="panel-note-name">{n.title}</span>
              <span className="panel-note-caret">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="panel-note-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
                  {inlineRefsToMarkdown(n.body)}
                </ReactMarkdown>
                <button className="panel-note-edit" onClick={() => onEdit(n)}>edit</button>
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
