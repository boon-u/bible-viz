import { useEffect, useMemo, useRef, useState } from "react";
import { bookByName } from "../data/bibleMeta";
import { bookVerseMap } from "../lib/aggregate";
import { fmtDate, refLabel, todayISO } from "../lib/store";
import ReadEntryRow from "./ReadEntryRow";

// Colour tiers by read count: 0 = unread, then warming up with each re-read
const TIERS = ["var(--cell-unread)", "#3b82f6", "#22c55e", "#a3e635", "#facc15", "#fb923c", "#f43f5e"];
const TIER_LABELS = ["unread", "1×", "2×", "3×", "4×", "5×", "6×+"];
const tierColor = (count) => TIERS[Math.min(count, TIERS.length - 1)];

export default function BookView({ bookName, focus, store, onBack }) {
  const { reads, addRead, deleteRead } = store;
  const book = bookByName(bookName);
  const counts = useMemo(() => bookVerseMap(reads, bookName), [reads, bookName]);
  const [selected, setSelected] = useState(focus ?? null);
  const gridRef = useRef();

  useEffect(() => {
    if (!focus || !gridRef.current) return;
    const cell = gridRef.current.querySelector(`[data-ch="${focus.chapter}"][data-v="${focus.verse}"]`);
    cell?.scrollIntoView({ block: "center" });
  }, [focus]);

  const selEntry = selected ? counts.get(`${selected.chapter}:${selected.verse}`) : null;
  const selDates = useMemo(() => {
    if (!selEntry) return [];
    const byDate = new Map();
    for (const d of selEntry.dates) byDate.set(d, (byDate.get(d) ?? 0) + 1);
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [selEntry]);

  const verseReads = useMemo(() => {
    if (!selected) return [];
    return reads
      .filter(
        (r) =>
          r.book === bookName &&
          r.chapter === selected.chapter &&
          selected.verse >= r.start &&
          selected.verse <= r.end,
      )
      .sort((a, b) => b.ts - a.ts);
  }, [reads, bookName, selected]);

  return (
    <main className="page bookview">
      <div className="book-topbar">
        <button className="ghost-btn" onClick={onBack}>← All books</button>
        <h1 className="book-title">{bookName}</h1>
        <div className="legend">
          {TIERS.map((c, i) => (
            <span key={i} className="legend-item">
              <span className="legend-swatch" style={{ background: c }} />
              {TIER_LABELS[i]}
            </span>
          ))}
        </div>
      </div>

      <p className="hm-hint">Each row is a chapter, each square a verse. Click a square for its read dates.</p>

      <div className="heatmap" ref={gridRef}>
        {book.chapters.map((verseCount, ci) => {
          const ch = ci + 1;
          return (
            <div key={ch} className="hm-row">
              <span className="hm-ch">{ch}</span>
              <div className="hm-cells">
                {Array.from({ length: verseCount }, (_, i) => i + 1).map((v) => {
                  const count = counts.get(`${ch}:${v}`)?.count ?? 0;
                  const isSel = selected?.chapter === ch && selected?.verse === v;
                  return (
                    <button
                      key={v}
                      className={`hm-cell${count > 0 ? " lit" : ""}${isSel ? " selected" : ""}`}
                      data-ch={ch}
                      data-v={v}
                      style={{ background: tierColor(count) }}
                      title={`${bookName} ${ch}:${v} — ${count === 0 ? "unread" : `read ${count}×`}`}
                      onClick={() => setSelected(isSel ? null : { chapter: ch, verse: v })}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <aside className="verse-panel">
          <div className="verse-panel-head">
            <strong>
              {bookName} {selected.chapter}:{selected.verse}
            </strong>
            <button className="delete-btn" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="verse-panel-count">
            {selEntry ? `Read ${selEntry.count} time${selEntry.count === 1 ? "" : "s"}` : "Not read yet"}
          </div>
          {selDates.length > 0 && (
            <div className="verse-dates">
              {selDates.map(([d, n]) => (
                <span key={d} className="date-chip">
                  {fmtDate(d)}{n > 1 ? ` ×${n}` : ""}
                </span>
              ))}
            </div>
          )}
          {verseReads.length > 0 && (
            <div className="verse-read-log">
              <p className="verse-read-log-label">Logged reads</p>
              {verseReads.map((r) => (
                <ReadEntryRow key={r.id} read={r} onDelete={deleteRead} />
              ))}
            </div>
          )}
          <button
            className="primary-btn"
            onClick={() =>
              addRead({
                book: bookName,
                chapter: selected.chapter,
                start: selected.verse,
                end: selected.verse,
                date: todayISO(),
              })
            }
          >
            Log read today
          </button>
        </aside>
      )}
    </main>
  );
}
