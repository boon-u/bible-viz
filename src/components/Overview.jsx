import { useRef, useState } from "react";
import { BIBLE, OT_COUNT } from "../data/bibleMeta";
import { coverageByBook, overallStats, topVerses } from "../lib/aggregate";
import { fmtDate } from "../lib/store";
import { buildUniversalExport, buildMarkdownExport } from "../lib/exportBundle";
import { SEED_NOTES } from "../data/seedNotes";
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

export default function Overview({ store, notesStore, profile, onOpenBook }) {
  const { reads, deleteRead, exportJSON, importReads } = store;
  const [expanded, setExpanded] = useState(null);
  const [showCount, setShowCount] = useState(15);
  const [showLogCount, setShowLogCount] = useState(20);
  const fileRef = useRef();
  const notesFileRef = useRef();

  const stats = overallStats(reads);
  const coverage = coverageByBook(reads);
  const top = topVerses(reads);
  const log = [...reads].sort((a, b) => b.ts - a.ts);
  const visibleLog = log.slice(0, showLogCount);

  const doExport = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bible-viz-reads.json";
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

  const download = (text, filename, type) => {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Universal export: everything (reads + per-verse read counts + notes + refs +
  // tags + dates) in one JSON bundle, portable to any tool or AI.
  const doExportAll = () => {
    const bundle = buildUniversalExport({
      profile,
      reads,
      notes: notesStore?.exportNotes() ?? [],
    });
    download(JSON.stringify(bundle, null, 2), "bible-viz-export.json", "application/json");
  };

  const doExportMarkdown = () => {
    download(buildMarkdownExport(notesStore?.notes ?? []), "bible-viz-notes.md", "text/markdown");
  };

  const doImportNotes = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const n = await notesStore.importNotes(await file.text());
      alert(`Imported ${n} note${n === 1 ? "" : "s"}.`);
    } catch (err) {
      alert(`Note import failed: ${err.message}`);
    }
    e.target.value = "";
  };

  // Load the built-in sample notes as reference templates. Idempotent — the
  // samples have stable ids, so clicking again won't duplicate them.
  const doLoadSamples = async () => {
    try {
      const added = await notesStore.addNotes(SEED_NOTES);
      alert(`Loaded ${added.length} sample note${added.length === 1 ? "" : "s"} to reference.`);
    } catch (err) {
      alert(`Could not load samples: ${err.message}`);
    }
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

      <section>
        <h2>Data &amp; notes</h2>
        <p className="section-hint">
          Notes are authored with AI and brought in here (JSON or Markdown, see{" "}
          <code>docs/NOTE_FORMAT.md</code>). New to it? <strong>Load sample notes</strong>{" "}
          to keep a set of worked examples as reference templates. The universal export
          carries everything — reads, read counts, notes, cross-references, tags, dates.
        </p>
        <div className="data-row">
          <button className="primary-btn" onClick={doExportAll}>Export everything (JSON)</button>
          <button className="ghost-btn" onClick={doExportMarkdown}>Export notes (Markdown)</button>
          <button className="ghost-btn" onClick={() => notesFileRef.current.click()}>Import notes</button>
          <button className="ghost-btn" onClick={doLoadSamples}>Load sample notes</button>
          <input
            ref={notesFileRef}
            type="file"
            accept=".json,.md,.markdown,application/json,text/markdown"
            hidden
            onChange={doImportNotes}
          />
        </div>
        <div className="data-row">
          <button className="ghost-btn" onClick={doExport}>Export reads only (JSON)</button>
          <button className="ghost-btn" onClick={() => fileRef.current.click()}>Import reads</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={doImport} />
        </div>
      </section>
    </main>
  );
}
