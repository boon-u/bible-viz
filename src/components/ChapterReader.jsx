import { useEffect, useMemo, useState } from "react";
import { BIBLE, OT_COUNT, bookByName } from "../data/bibleMeta";
import { getChapter, WEB_CREDIT } from "../lib/bibleText";
import { bookVerseMap } from "../lib/aggregate";
import { noteMarksForBook } from "../lib/notes";
import {
  expandRangeToReads,
  formatRangeLabel,
  normalizeRange,
} from "../lib/readRange";
import { todayISO } from "../lib/store";

// Stage 1 reading surface: renders WEB chapters as flowing verses, tints verses
// you've already read, and lets you select a verse range and log it — reusing the
// same read-range helpers as LogRead. Multiple chapters can be shown at once.
export default function ChapterReader({ bookName, chapter, store, notes = [], onChangeLocation }) {
  const { reads, addReads } = store;
  const book = bookByName(bookName);
  const [chapters, setChapters] = useState([chapter]);
  const [verseMap, setVerseMap] = useState({}); // chNum -> [{verse,text}]
  const [range, setRange] = useState(null); // {startChapter,startVerse,endChapter,endVerse,complete}
  const [saved, setSaved] = useState(null);
  const date = todayISO();

  // Reset when navigating to a new location.
  useEffect(() => {
    setChapters([chapter]);
    setRange(null);
    setSaved(null);
  }, [bookName, chapter]);

  // Load any displayed chapter whose text isn't cached yet.
  useEffect(() => {
    let alive = true;
    for (const ch of chapters) {
      if (verseMap[ch]) continue;
      getChapter(bookName, ch)
        .then((v) => alive && setVerseMap((m) => ({ ...m, [ch]: v })))
        .catch(() => alive && setVerseMap((m) => ({ ...m, [ch]: [] })));
    }
    return () => {
      alive = false;
    };
  }, [bookName, chapters, verseMap]);

  const counts = useMemo(() => bookVerseMap(reads, bookName), [reads, bookName]);
  const noteMarks = useMemo(() => noteMarksForBook(notes, bookName), [notes, bookName]);

  const norm = range
    ? normalizeRange(
        range.complete
          ? range
          : { ...range, endChapter: range.startChapter, endVerse: range.startVerse },
      )
    : null;

  const inSel = (ch, v) => {
    if (!norm) return false;
    const afterStart = ch > norm.startChapter || (ch === norm.startChapter && v >= norm.startVerse);
    const beforeEnd = ch < norm.endChapter || (ch === norm.endChapter && v <= norm.endVerse);
    return afterStart && beforeEnd;
  };

  const tapVerse = (ch, v) => {
    setSaved(null);
    if (!range || range.complete) {
      setRange({ startChapter: ch, startVerse: v, endChapter: ch, endVerse: v, complete: false });
    } else {
      setRange({
        startChapter: range.startChapter,
        startVerse: range.startVerse,
        endChapter: ch,
        endVerse: v,
        complete: true,
      });
    }
  };

  const logRead = () => {
    if (!range) return;
    const n = normalizeRange(
      range.complete
        ? range
        : { ...range, endChapter: range.startChapter, endVerse: range.startVerse },
    );
    addReads(expandRangeToReads({ book: bookName, ...n, date }));
    setSaved(formatRangeLabel({ book: bookName, ...n }));
    setRange(null);
  };

  const lastCh = chapters[chapters.length - 1];
  const canPrev = chapters[0] > 1;
  const canNext = lastCh < book.chapters.length;
  const goto = (ch) => onChangeLocation(bookName, ch);

  return (
    <main className="page reader">
      <div className="reader-nav">
        <select value={bookName} onChange={(e) => onChangeLocation(e.target.value, 1)}>
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
        <select value={chapters[0]} onChange={(e) => goto(Number(e.target.value))}>
          {book.chapters.map((_, i) => (
            <option key={i + 1} value={i + 1}>Chapter {i + 1}</option>
          ))}
        </select>
        <button className="ghost-btn" disabled={!canPrev} onClick={() => goto(chapters[0] - 1)}>
          ← Prev
        </button>
        <button className="ghost-btn" disabled={!canNext} onClick={() => goto(lastCh + 1)}>
          Next →
        </button>
      </div>

      <p className="reader-hint">
        Tap a verse number to start a selection, tap another to finish, then log the read.
      </p>

      <article className="reader-text">
        {chapters.map((ch) => {
          const verses = verseMap[ch];
          return (
            <section key={ch} className="rd-chapter" data-ch={ch}>
              <h2 className="rd-chapter-head">
                {bookName} {ch}
              </h2>
              {!verses ? (
                <p className="rd-loading">Loading…</p>
              ) : verses.length === 0 ? (
                <p className="rd-loading">No text found.</p>
              ) : (
                <p className="rd-prose">
                  {verses.map(({ verse, text }) => {
                    const readCount = counts.get(`${ch}:${verse}`)?.count ?? 0;
                    const hasNote = (noteMarks.get(`${ch}:${verse}`) ?? 0) > 0;
                    const sel = inSel(ch, verse);
                    return (
                      <span
                        key={verse}
                        className={`rd-verse${readCount > 0 ? " read" : ""}${sel ? " sel" : ""}`}
                        data-ch={ch}
                        data-v={verse}
                      >
                        <sup
                          className="rd-vnum"
                          title={readCount > 0 ? `read ${readCount}×` : "tap to select"}
                          onClick={() => tapVerse(ch, verse)}
                        >
                          {verse}
                          {hasNote && <span className="rd-note-dot" />}
                        </sup>
                        {text}{" "}
                      </span>
                    );
                  })}
                </p>
              )}
            </section>
          );
        })}
      </article>

      <div className="reader-foot">
        {canNext && (
          <button className="ghost-btn" onClick={() => setChapters((c) => [...c, lastCh + 1])}>
            + Show {bookName} {lastCh + 1}
          </button>
        )}
        <span className="reader-credit">{WEB_CREDIT}</span>
      </div>

      {(range || saved) && (
        <div className="reader-actionbar">
          <span className="reader-sel-label">
            {saved
              ? `Logged ${saved} ✓`
              : norm
                ? formatRangeLabel({ book: bookName, ...norm }) + (range.complete ? "" : " …")
                : ""}
          </span>
          {range && (
            <>
              <button className="ghost-btn" onClick={() => setRange(null)}>Clear</button>
              <button className="primary-btn" onClick={logRead}>Log read</button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
