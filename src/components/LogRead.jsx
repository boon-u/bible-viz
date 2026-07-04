import { useState } from "react";
import { BIBLE, OT_COUNT, bookByName } from "../data/bibleMeta";
import {
  chapterRangeBounds,
  expandRangeToReads,
  formatRangeLabel,
  normalizeRange,
} from "../lib/readRange";
import { todayISO } from "../lib/store";

export default function LogRead({ store }) {
  const [bookName, setBookName] = useState("Matthew");
  const [chapter, setChapter] = useState(1);
  const [range, setRange] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [saved, setSaved] = useState(null);

  const book = bookByName(bookName);
  const verseCount = book.chapters[chapter - 1];

  const pickBook = (name) => {
    setBookName(name);
    setChapter(1);
    setRange(null);
    setSaved(null);
  };

  const pickChapter = (c) => {
    setChapter(c);
    setSaved(null);
  };

  const clearRange = () => {
    setRange(null);
    setSaved(null);
  };

  const tapVerse = (v) => {
    setSaved(null);
    if (!range || range.complete) {
      setRange({
        startChapter: chapter,
        startVerse: v,
        endChapter: chapter,
        endVerse: v,
        complete: false,
      });
      return;
    }

    setRange({
      startChapter: range.startChapter,
      startVerse: range.startVerse,
      endChapter: chapter,
      endVerse: v,
      complete: true,
    });
  };

  const selectWholeChapter = () => {
    setSaved(null);
    setRange({
      startChapter: chapter,
      startVerse: 1,
      endChapter: chapter,
      endVerse: verseCount,
      complete: true,
    });
  };

  const save = () => {
    if (!range) return;
    const normalized = normalizeRange({
      startChapter: range.startChapter,
      startVerse: range.startVerse,
      endChapter: range.complete ? range.endChapter : range.startChapter,
      endVerse: range.complete ? range.endVerse : range.startVerse,
    });
    const segments = expandRangeToReads({ book: bookName, ...normalized, date });
    store.addReads(segments);
    setSaved(formatRangeLabel({ book: bookName, ...normalized }));
    setRange(null);
  };

  const bounds = chapterRangeBounds(range, chapter, book);
  const inSel = (v) => bounds && v >= bounds.start && v <= bounds.end;

  const preview = (() => {
    if (saved) return `Logged ${saved} ✓`;
    if (!range) return "Tap a start verse, switch chapter if needed, then tap end verse";
    if (!range.complete) {
      return `${formatRangeLabel({ book: bookName, ...normalizeRange({ ...range, endChapter: range.startChapter, endVerse: range.startVerse }) })} …`;
    }
    return formatRangeLabel({ book: bookName, ...normalizeRange(range) });
  })();

  const segmentCount =
    range?.complete
      ? expandRangeToReads({
          book: bookName,
          ...normalizeRange(range),
          date,
        }).length
      : 0;

  return (
    <main className="page">
      <h2>Log a read</h2>
      <p className="log-hint">
        Select any verse range — including across chapters. Tap start, change chapter, tap end.
      </p>

      <div className="log-grid">
        <div className="log-col">
          <label className="field-label">Book</label>
          <select value={bookName} onChange={(e) => pickBook(e.target.value)}>
            <optgroup label="Old Testament">
              {BIBLE.slice(0, OT_COUNT).map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </optgroup>
            <optgroup label="New Testament">
              {BIBLE.slice(OT_COUNT).map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </optgroup>
          </select>

          <label className="field-label">Date read</label>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />

          {range && (
            <div className="range-summary">
              <span className="range-summary-label">Selection</span>
              <span className="range-summary-value">
                {range.complete
                  ? formatRangeLabel({ book: bookName, ...normalizeRange(range) })
                  : `${bookName} ${range.startChapter}:${range.startVerse} …`}
              </span>
              {range.complete && segmentCount > 1 && (
                <span className="range-summary-meta">{segmentCount} chapter segments</span>
              )}
            </div>
          )}

          <label className="field-label">Chapter {chapter}</label>
          <div className="num-grid">
            {book.chapters.map((_, i) => {
              const ch = i + 1;
              const inRange = chapterRangeBounds(range, ch, book);
              return (
                <button
                  key={ch}
                  className={
                    chapter === ch
                      ? "num-btn active"
                      : inRange
                        ? "num-btn in-range"
                        : "num-btn"
                  }
                  onClick={() => pickChapter(ch)}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        </div>

        <div className="log-col">
          <label className="field-label">
            Verses in chapter {chapter} — tap start, then end (any chapter)
          </label>
          <div className="num-grid verses">
            {Array.from({ length: verseCount }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                className={inSel(v) ? "num-btn selected" : "num-btn"}
                onClick={() => tapVerse(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="log-actions">
            <button type="button" className="ghost-btn" onClick={selectWholeChapter}>
              Whole chapter
            </button>
            {range && (
              <button type="button" className="ghost-btn" onClick={clearRange}>
                Clear
              </button>
            )}
          </div>

          <div className="save-row">
            <div className="save-preview">{preview}</div>
            <button className="primary-btn" disabled={!range} onClick={save}>
              Save read
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
