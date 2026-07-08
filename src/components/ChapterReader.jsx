import { useEffect, useMemo, useRef, useState } from "react";
import { BIBLE, OT_COUNT, bookByName } from "../data/bibleMeta";
import { getChapter, WEB_CREDIT } from "../lib/bibleText";
import { bookVerseMap } from "../lib/aggregate";
import { noteMarksForBook } from "../lib/notes";
import { highlightsByVerse } from "../lib/annotations";
import { HIGHLIGHT_COLORS, segmentVerse, selectionToHighlights } from "../lib/highlight";
import {
  expandRangeToReads,
  formatRangeLabel,
  normalizeRange,
} from "../lib/readRange";
import { todayISO } from "../lib/store";

const markBg = (color) => `color-mix(in srgb, ${color} 42%, transparent)`;

// Reading surface: renders WEB chapters, tints already-read verses, lets you
// select a verse range and log it, and — with the highlighter armed — highlight
// verse groups or word/phrase spans.
export default function ChapterReader({ bookName, chapter, store, notes = [], annoStore, onChangeLocation }) {
  const { reads, addReads } = store;
  const { annotations, addAnnotation, deleteAnnotation } = annoStore;
  const book = bookByName(bookName);
  const articleRef = useRef();
  const [chapters, setChapters] = useState([chapter]);
  const [verseMap, setVerseMap] = useState({}); // chNum -> [{verse,text}]
  const [range, setRange] = useState(null);
  const [saved, setSaved] = useState(null);
  const [hlColor, setHlColor] = useState(null); // null = read mode; else armed color
  const date = todayISO();

  useEffect(() => {
    setChapters([chapter]);
    setRange(null);
    setSaved(null);
  }, [bookName, chapter]);

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
  const hlByChapter = useMemo(() => {
    const m = {};
    for (const ch of chapters) m[ch] = highlightsByVerse(annotations, bookName, ch);
    return m;
  }, [annotations, bookName, chapters]);

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

  const toggleVerseHighlight = (ch, v) => {
    const text = verseMap[ch]?.[v - 1]?.text ?? "";
    const existing = annotations.find(
      (a) =>
        a.kind === "highlight" &&
        a.book === bookName &&
        a.chapter === ch &&
        a.anchor?.verse === v &&
        (a.anchor?.start ?? 0) === 0 &&
        (a.anchor?.end ?? 0) >= text.length,
    );
    if (existing) deleteAnnotation(existing.id);
    else
      addAnnotation({
        book: bookName,
        chapter: ch,
        kind: "highlight",
        color: hlColor,
        anchor: { verse: v, start: 0, end: text.length },
      });
  };

  const onVnum = (ch, v) => (hlColor ? toggleVerseHighlight(ch, v) : tapVerse(ch, v));

  // Highlighter armed + a text selection → create word/phrase highlights.
  const onMouseUp = () => {
    if (!hlColor || !articleRef.current) return;
    const sel = window.getSelection();
    const verseEls = articleRef.current.querySelectorAll(".rd-vtext");
    const hls = selectionToHighlights(sel, verseEls);
    if (!hls.length) return;
    for (const h of hls) {
      addAnnotation({
        book: bookName,
        chapter: h.chapter,
        kind: "highlight",
        color: hlColor,
        anchor: { verse: h.verse, start: h.start, end: h.end },
      });
    }
    sel.removeAllRanges();
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

      <div className="hl-toolbar">
        <span className="hl-label">Highlighter</span>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.name}
            className={`hl-swatch${hlColor === c.value ? " active" : ""}`}
            style={{ background: c.value }}
            title={c.name}
            onClick={() => setHlColor(hlColor === c.value ? null : c.value)}
          />
        ))}
        <span className="hl-hint">
          {hlColor
            ? "select text or tap a verse number to highlight · tap a highlight to remove"
            : "tap a verse number to select & log a read"}
        </span>
      </div>

      <article className="reader-text" ref={articleRef} onMouseUp={onMouseUp}>
        {chapters.map((ch) => {
          const verses = verseMap[ch];
          const hlMap = hlByChapter[ch];
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
                    const segs = segmentVerse(text, hlMap?.get(verse));
                    return (
                      <span
                        key={verse}
                        className={`rd-verse${readCount > 0 ? " read" : ""}${sel ? " sel" : ""}`}
                      >
                        <sup
                          className="rd-vnum"
                          title={readCount > 0 ? `read ${readCount}×` : "tap to select"}
                          onClick={() => onVnum(ch, verse)}
                        >
                          {verse}
                          {hasNote && <span className="rd-note-dot" />}
                        </sup>
                        <span className="rd-vtext" data-ch={ch} data-v={verse}>
                          {segs.map((seg, i) =>
                            seg.hl ? (
                              <mark
                                key={i}
                                className="rd-hl"
                                style={{ background: markBg(seg.hl.color) }}
                                onClick={(e) => {
                                  if (hlColor) {
                                    e.stopPropagation();
                                    deleteAnnotation(seg.hl.id);
                                  }
                                }}
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <span key={i}>{seg.text}</span>
                            ),
                          )}
                        </span>{" "}
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
