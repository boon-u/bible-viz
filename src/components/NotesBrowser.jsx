import { useMemo, useState } from "react";
import { noteAnchor } from "../lib/notes";
import { refLabelOf } from "../lib/refs";

// Strip markdown-ish syntax for a plain snippet.
const snippet = (body, n = 160) =>
  body.replace(/[#*_`>[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

const connectedness = (n) => n.tags.length + n.refs.length;

const SORTS = {
  recent: { label: "Newest", cmp: (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") },
  title: { label: "Title A–Z", cmp: (a, b) => a.title.localeCompare(b.title) },
  connected: { label: "Most connected", cmp: (a, b) => connectedness(b) - connectedness(a) },
};

export default function NotesBrowser({ notes, onOpen, initialTag = null }) {
  const [q, setQ] = useState("");
  const [book, setBook] = useState("all");
  const [category, setCategory] = useState("all");
  const [tags, setTags] = useState(() => new Set(initialTag ? [initialTag] : []));
  const [tagMode, setTagMode] = useState("all"); // 'all' = AND, 'any' = OR
  const [sort, setSort] = useState("recent");
  const [showAllTags, setShowAllTags] = useState(false);

  const books = useMemo(
    () => [...new Set(notes.map((n) => n.book).filter(Boolean))].sort(),
    [notes],
  );
  const categories = useMemo(
    () => [...new Set(notes.map((n) => n.category))].sort(),
    [notes],
  );
  const allTags = useMemo(() => {
    const counts = new Map();
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [notes]);

  const toggleTag = (t) =>
    setTags((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const clearAll = () => {
    setQ("");
    setBook("all");
    setCategory("all");
    setTags(new Set());
  };

  const hasFilters = q || book !== "all" || category !== "all" || tags.size > 0;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const selected = [...tags];
    const out = notes.filter((n) => {
      if (book !== "all" && n.book !== book) return false;
      if (category !== "all" && n.category !== category) return false;
      if (selected.length) {
        const has = (t) => n.tags.includes(t);
        if (tagMode === "all" ? !selected.every(has) : !selected.some(has)) return false;
      }
      if (needle) {
        const refText = n.refs.map((r) => r.label ?? r.book ?? "").join(" ");
        const hay = `${n.title} ${n.body} ${n.tags.join(" ")} ${refText}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    return out.sort(SORTS[sort].cmp);
  }, [notes, q, book, category, tags, tagMode, sort]);

  const visibleTags = showAllTags ? allTags : allTags.slice(0, 20);

  return (
    <main className="page notesbrowser">
      <div className="notes-toolbar">
        <input
          className="notes-search"
          placeholder="Search title, text, tags, references…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={book} onChange={(e) => setBook(e.target.value)}>
          <option value="all">All books</option>
          {books.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} title="Sort order">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="notes-tagsection">
          <div className="notes-tagbar">
            {visibleTags.map(([t, c]) => (
              <button
                key={t}
                className={`tag-chip${tags.has(t) ? " active" : ""}`}
                onClick={() => toggleTag(t)}
              >
                #{t} <span className="tag-count">{c}</span>
              </button>
            ))}
            {allTags.length > 20 && (
              <button className="tag-more" onClick={() => setShowAllTags((s) => !s)}>
                {showAllTags ? "show fewer" : `+${allTags.length - 20} more`}
              </button>
            )}
          </div>
          {tags.size > 1 && (
            <div className="tag-mode">
              match
              <button
                className={tagMode === "all" ? "seg active" : "seg"}
                onClick={() => setTagMode("all")}
              >
                all
              </button>
              <button
                className={tagMode === "any" ? "seg active" : "seg"}
                onClick={() => setTagMode("any")}
              >
                any
              </button>
            </div>
          )}
        </div>
      )}

      <div className="notes-resultbar">
        <span className="section-hint">
          {filtered.length} note{filtered.length === 1 ? "" : "s"}
          {notes.length !== filtered.length ? ` of ${notes.length}` : ""}
        </span>
        {hasFilters && (
          <div className="active-filters">
            {book !== "all" && (
              <button className="filter-chip" onClick={() => setBook("all")}>{book} ✕</button>
            )}
            {category !== "all" && (
              <button className="filter-chip" onClick={() => setCategory("all")}>{category} ✕</button>
            )}
            {[...tags].map((t) => (
              <button key={t} className="filter-chip" onClick={() => toggleTag(t)}>#{t} ✕</button>
            ))}
            <button className="filter-clear" onClick={clearAll}>Clear all</button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-hint">
          No notes match. Notes are authored with AI and brought in via{" "}
          <strong>Import notes</strong> on the Overview — see <code>docs/NOTE_FORMAT.md</code>.
        </div>
      ) : (
        <div className="note-cards">
          {filtered.map((n) => {
            const label = refLabelOf(noteAnchor(n));
            return (
              <button key={n.id} className="note-card" onClick={() => onOpen(n)}>
                <div className="note-card-head">
                  <span className={`note-cat cat-${n.category}`}>{n.category}</span>
                  {label && <span className="note-card-ref">{label}</span>}
                </div>
                <div className="note-card-title">{n.title}</div>
                <div className="note-card-snippet">{snippet(n.body)}</div>
                {n.tags.length > 0 && (
                  <div className="note-card-tags">
                    {n.tags.map((t) => (
                      <span
                        key={t}
                        className={`tag-chip mini${tags.has(t) ? " active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTag(t);
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
