import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { inlineRefsToMarkdown, parseRef } from "../lib/refs";
import {
  categoryMeta,
  crossRefLabel,
  formatNoteDate,
  formatScriptureRef,
  studyDepth,
} from "../lib/noteDisplay";
import { noteCoversVerse, parseVerseKey, verseKey } from "../lib/noteVerseLink";

const urlTransform = (url) => (/^javascript:/i.test(url) ? "" : url);

export default function NotesPanel({
  notes,
  anchors,
  trackHeight,
  articleRef,
  bookName,
  focusVerseKey,
  onFocusVerseKey,
  expanded,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onEdit,
  onOpenNoteLink,
  onOpenRef,
}) {
  const positioned = useMemo(() => {
    const seen = new Map();
    return notes.map((n, i) => {
      const key = verseKey(n.chapter, n.verseStart);
      const base = anchors[key] ?? i * 88;
      const stack = seen.get(key) ?? 0;
      seen.set(key, stack + 1);
      return { note: n, top: base + stack * 10 };
    });
  }, [notes, anchors]);

  if (!notes.length) return null;

  const focus = parseVerseKey(focusVerseKey);
  const isLinked = (n) => focus && noteCoversVerse(n, focus.chapter, focus.verse);

  const scrollToVerse = (n) => {
    articleRef.current
      ?.querySelector(`.rd-vtext[data-ch="${n.chapter}"][data-v="${n.verseStart}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const components = {
    a({ href, children }) {
      if (href?.startsWith("note:")) {
        return (
          <button type="button" className="notion-note-link" onClick={() => onOpenNoteLink(href.slice(5))}>
            {children}
          </button>
        );
      }
      if (href?.startsWith("ref:")) {
        return (
          <button
            type="button"
            className="notion-note-link"
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
    <aside className="notion-rail" aria-label="Margin notes">
      <div className="notion-rail-header">
        <span className="notion-rail-title">Notes</span>
        <div className="notion-rail-tools">
          <button type="button" onClick={onExpandAll}>Expand all</button>
          <span className="notion-rail-dot" aria-hidden="true">·</span>
          <button type="button" onClick={onCollapseAll}>Collapse all</button>
        </div>
      </div>

      <div className="notion-rail-track" style={{ minHeight: trackHeight }}>
        {positioned.map(({ note: n, top }) => {
          const open = expanded.has(n.id);
          const linked = isLinked(n);
          const meta = categoryMeta(n.category);
          const depth = studyDepth(n);
          const xref = crossRefLabel(n);
          const scripture = formatScriptureRef(n, bookName);

          return (
            <article
              key={n.id}
              id={`panel-note-${n.id}`}
              className={`notion-card${open ? " open" : ""}${linked ? " linked" : ""}`}
              style={{ top }}
              onMouseEnter={() => onFocusVerseKey(verseKey(n.chapter, n.verseStart))}
              onMouseLeave={() => onFocusVerseKey(null)}
            >
              <button type="button" className="notion-card-face" onClick={() => onToggle(n.id)}>
                <div className="notion-card-row notion-card-row-title">
                  <span className="notion-card-icon" aria-hidden="true">{meta.icon}</span>
                  <span className="notion-card-name">{n.title || "Untitled"}</span>
                </div>

                <div className="notion-card-row">
                  <span className="notion-card-icon" aria-hidden="true">📍</span>
                  <span
                    className="notion-card-link"
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToVerse(n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        scrollToVerse(n);
                      }
                    }}
                  >
                    {scripture}
                  </span>
                </div>

                {xref && (
                  <div className="notion-card-row">
                    <span className="notion-card-icon" aria-hidden="true">🔗</span>
                    <span className="notion-card-link notion-card-link-muted">{xref}</span>
                  </div>
                )}

                <div
                  className="notion-card-pill"
                  style={{ "--pill-dot": meta.dot, "--pill-bg": meta.bg }}
                >
                  <span className="notion-card-pill-dot" aria-hidden="true" />
                  {meta.label}
                </div>

                <div className="notion-card-progress">
                  <span className="notion-card-progress-label">{depth}%</span>
                  <div className="notion-card-progress-track">
                    <div className="notion-card-progress-fill" style={{ width: `${depth}%` }} />
                  </div>
                </div>

                <div className="notion-card-date">
                  {n.updatedAt !== n.createdAt ? "Updated " : "Added "}
                  {formatNoteDate(n.updatedAt ?? n.createdAt)}
                </div>
              </button>

              {open && (
                <div className="notion-card-body">
                  {n.tags?.length > 0 && (
                    <div className="notion-card-tags">
                      {n.tags.map((t) => (
                        <span key={t} className="notion-card-tag">{t}</span>
                      ))}
                    </div>
                  )}
                  {n.source && (
                    <p className="notion-card-source">Source: {n.source}</p>
                  )}
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
                    {inlineRefsToMarkdown(n.body) || "_No content yet._"}
                  </ReactMarkdown>
                  <button type="button" className="notion-card-edit" onClick={() => onEdit(n)}>
                    Edit
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
