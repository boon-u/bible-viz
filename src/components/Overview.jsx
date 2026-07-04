import { useRef, useState } from "react";
import { BIBLE, OT_COUNT } from "../data/bibleMeta";
import { coverageByBook, overallStats, topVerses } from "../lib/aggregate";
import { fmtDate } from "../lib/store";
import ReadEntryRow from "./ReadEntryRow";
import ReadingCalendar from "./ReadingCalendar";

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function BookGrid({ books, coverage, onOpenBook }) {
  return (
    <div className="book-grid">
      {books.map((b) => {
        const c = coverage.get(b.name);
        return (
          <button key={b.name} className="book-card" onClick={() => onOpenBook(b.name)}>
            <span className="book-name">{b.name}</span>
            <span className="book-meta">
              {c.unique > 0 ? `${c.unique} / ${c.total}` : `${c.total} verses`}
            </span>
            <span className="book-bar">
              <span style={{ width: `${Math.max(c.pct, c.unique > 0 ? 2 : 0)}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function Overview({ store, onOpenBook }) {
  const { reads, deleteRead, exportJSON, importReads } = store;
  const [expanded, setExpanded] = useState(null);
  const [showCount, setShowCount] = useState(15);
  const [showLogCount, setShowLogCount] = useState(20);
  const fileRef = useRef();

  const stats = overallStats(reads);
  const coverage = coverageByBook(reads);
  const top = topVerses(reads);
  const log = [...reads].sort((a, b) => b.ts - a.ts);
  const visibleLog = log.slice(0, showLogCount);

  const doExport = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "verse-trail-reads.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const n = importReads(await file.text());
      alert(`Imported ${n} read${n === 1 ? "" : "s"}.`);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
    e.target.value = "";
  };

  return (
    <main className="page">
      <section className="stats-row">
        <Stat label="reads logged" value={stats.events} />
        <Stat label="unique verses" value={stats.unique.toLocaleString()} sub={`of ${stats.total.toLocaleString()}`} />
        <Stat label="of the Bible" value={`${stats.pct < 10 ? stats.pct.toFixed(1) : Math.round(stats.pct)}%`} />
        <Stat label="books touched" value={`${stats.booksTouched} / 66`} />
        <Stat label="reading days" value={stats.days} />
      </section>

      <ReadingCalendar reads={reads} />

      {reads.length === 0 && (
        <div className="empty-hint">
          No reads yet. Hit <strong>+ Log a read</strong> above to record your first one, then come
          back here and open any book to see your reading map.
        </div>
      )}

      <section>
        <h2>Old Testament</h2>
        <BookGrid books={BIBLE.slice(0, OT_COUNT)} coverage={coverage} onOpenBook={onOpenBook} />
        <h2>New Testament</h2>
        <BookGrid books={BIBLE.slice(OT_COUNT)} coverage={coverage} onOpenBook={onOpenBook} />
      </section>

      {top.length > 0 && (
        <section>
          <h2>Most read verses</h2>
          <div className="verse-table">
            {top.slice(0, showCount).map((v) => {
              const key = `${v.book}|${v.chapter}|${v.verse}`;
              const isOpen = expanded === key;
              return (
                <div key={key} className="verse-row-wrap">
                  <div className="verse-row">
                    <button
                      className="verse-ref"
                      title="Open in book view"
                      onClick={() => onOpenBook(v.book, { chapter: v.chapter, verse: v.verse })}
                    >
                      {v.book} {v.chapter}:{v.verse}
                    </button>
                    <span className="verse-count">{v.count}×</span>
                    <span className="verse-last">last {fmtDate(v.dates[v.dates.length - 1])}</span>
                    <button className="verse-toggle" onClick={() => setExpanded(isOpen ? null : key)}>
                      {isOpen ? "hide dates" : "dates"}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="verse-dates">
                      {v.dates.map((d, i) => (
                        <span key={i} className="date-chip">{fmtDate(d)}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {top.length > showCount && (
            <button className="ghost-btn" onClick={() => setShowCount((n) => n + 25)}>
              Show more ({top.length - showCount} remaining)
            </button>
          )}
        </section>
      )}

      {log.length > 0 && (
        <section>
          <h2>Read log</h2>
          <p className="section-hint">Remove mistaken entries with ✕. Newest first.</p>
          <div className="read-entry-list">
            {visibleLog.map((r) => (
              <ReadEntryRow key={r.id} read={r} onDelete={deleteRead} />
            ))}
          </div>
          {log.length > showLogCount && (
            <button className="ghost-btn" onClick={() => setShowLogCount((n) => n + 25)}>
              Show more ({log.length - showLogCount} remaining)
            </button>
          )}
        </section>
      )}

      <section className="data-row">
        <button className="ghost-btn" onClick={doExport}>Export data (JSON)</button>
        <button className="ghost-btn" onClick={() => fileRef.current.click()}>Import data</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={doImport} />
      </section>
    </main>
  );
}
