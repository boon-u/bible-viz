import { useEffect, useMemo, useRef, useState } from "react";
import { parseRef, refLabelOf } from "../lib/refs";

// Global quick-jump (⌘K / Ctrl-K). Searches notes, topics, and Scripture
// references so anything is one keystroke away while prepping — the core
// "easily accessible" requirement. Self-contained: manages its own open state.
export default function CommandPalette({ notes, onOpenNote, onOpenRef, onOpenTopic }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const allTags = useMemo(
    () => [...new Set(notes.flatMap((n) => n.tags))].sort(),
    [notes],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = [];

    // Scripture reference jump
    if (needle) {
      const ref = parseRef(q.trim());
      if (ref?.book) {
        out.push({
          key: "ref",
          kind: "Go to",
          label: refLabelOf(ref),
          action: () => onOpenRef(ref),
        });
      }
    }

    const noteMatches = (needle
      ? notes.filter((n) =>
          `${n.title} ${n.tags.join(" ")} ${n.body}`.toLowerCase().includes(needle),
        )
      : notes
    ).slice(0, 7);
    for (const n of noteMatches) {
      out.push({
        key: `note:${n.id}`,
        kind: n.category,
        label: n.title,
        action: () => onOpenNote(n.id),
      });
    }

    const tagMatches = (needle ? allTags.filter((t) => t.includes(needle)) : allTags).slice(0, 5);
    for (const t of tagMatches) {
      out.push({ key: `tag:${t}`, kind: "topic", label: `#${t}`, action: () => onOpenTopic(t) });
    }

    return out.slice(0, 12);
  }, [q, notes, allTags]);

  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(results.length - 1, 0)));
  }, [results.length]);

  if (!open) return null;

  const run = (item) => {
    item.action();
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[sel]) {
      e.preventDefault();
      run(results[sel]);
    }
  };

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Jump to a note, topic, or reference (e.g. Rom 8:28)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cmdk-results">
          {results.length === 0 ? (
            <div className="cmdk-empty">No matches</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.key}
                className={`cmdk-item${i === sel ? " active" : ""}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => run(item)}
              >
                <span className={`note-cat cat-${item.kind}`}>{item.kind}</span>
                <span className="cmdk-label">{item.label}</span>
              </button>
            ))
          )}
        </div>
        <div className="cmdk-hint">↑↓ to move · ↵ to open · esc to close</div>
      </div>
    </div>
  );
}
