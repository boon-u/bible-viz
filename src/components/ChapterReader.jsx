import { useEffect, useMemo, useRef, useState } from "react";
import { BIBLE, OT_COUNT, bookByName } from "../data/bibleMeta";
import { getChapter, loadBookMeta, chapterMeta, WEB_CREDIT } from "../lib/bibleText";
import { bookVerseMap } from "../lib/aggregate";
import { noteMarksForBook } from "../lib/notes";
import { highlightsForChapter, highlightCoversPoint } from "../lib/annotations";
import {
  blendFill,
  fillIntervalsForVerse,
  offsetInContainer,
  segmentVerseDisplay,
  selectionToRanges,
} from "../lib/highlight";
import { expandRangeToReads } from "../lib/readRange";
import { chapterFlow, isPoetryBook } from "../lib/bibleLayout";
import { todayISO } from "../lib/store";
import ScribbleOverlay from "./ScribbleOverlay";
import SelectionPopover from "./SelectionPopover";
import HighlightSessions from "./HighlightSessions";
import NotesPanel from "./NotesPanel";
import NoteEditor from "./NoteEditor";

export default function ChapterReader({
  bookName,
  chapter,
  store,
  notesStore,
  annoStore,
  onChangeLocation,
}) {
  const { reads, addReads } = store;
  const notes = notesStore.notes;
  const { annotations, addAnnotation, deleteAnnotation } = annoStore;
  const book = bookByName(bookName);
  const articleRef = useRef();
  const [chapters, setChapters] = useState([chapter]);
  const [verseMap, setVerseMap] = useState({});
  const [bookMeta, setBookMeta] = useState({});
  const [annotate, setAnnotate] = useState(false);
  const [penStyle, setPenStyle] = useState("fill");
  const [pending, setPending] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const date = todayISO();

  useEffect(() => {
    setChapters([chapter]);
    setPending(null);
    setSessions(null);
    setEditing(null);
  }, [bookName, chapter]);

  useEffect(() => {
    let alive = true;
    loadBookMeta(bookName)
      .then((m) => alive && setBookMeta(m))
      .catch(() => alive && setBookMeta({}));
    return () => {
      alive = false;
    };
  }, [bookName]);

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

  const highlightsByCh = useMemo(() => {
    const m = {};
    for (const ch of chapters) m[ch] = highlightsForChapter(annotations, bookName, ch);
    return m;
  }, [annotations, bookName, chapters]);

  const scribbles = useMemo(
    () =>
      chapters.flatMap((ch) =>
        (highlightsByCh[ch] ?? [])
          .filter((h) => h.style === "scribble")
          .map((h) => ({ id: h.id, chapter: ch, anchor: h.anchor, color: h.color })),
      ),
    [chapters, highlightsByCh],
  );
  const overlayRevision = `${chapters.join(",")}|${scribbles.length}|${Object.keys(verseMap).length}|${annotate}`;

  const pageNotes = useMemo(() => {
    const shown = new Set(chapters);
    return notes
      .filter((n) => n.book === bookName && shown.has(n.chapter) && n.verseStart != null)
      .sort((a, b) => a.chapter - b.chapter || a.verseStart - b.verseStart);
  }, [notes, bookName, chapters]);

  const showPopoverForSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !articleRef.current) return;
    const ranges = selectionToRanges(sel, articleRef.current.querySelectorAll(".rd-vtext"));
    if (!ranges.length) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPending({ ranges, pos: { x: Math.max(rect.left, 12), y: rect.bottom + 8 } });
    setSessions(null);
  };

  const onMouseUp = () => {
    if (!annotate) return;
    showPopoverForSelection();
  };

  const createHighlights = (color) => {
    if (!pending) return;
    for (const r of pending.ranges) {
      addAnnotation({
        book: bookName,
        chapter: r.chapter,
        kind: "highlight",
        color,
        style: penStyle,
        anchor: {
          startVerse: r.startVerse,
          startOffset: r.startOffset,
          endVerse: r.endVerse,
          endOffset: r.endOffset,
        },
      });
      addReads(
        expandRangeToReads({
          book: bookName,
          startChapter: r.chapter,
          startVerse: r.startVerse,
          endChapter: r.chapter,
          endVerse: r.endVerse,
          date,
        }),
      );
    }
    window.getSelection()?.removeAllRanges();
    setPending(null);
  };

  const selectVerse = (ch, v) => {
    const el = articleRef.current?.querySelector(`.rd-vtext[data-ch="${ch}"][data-v="${v}"]`);
    if (!el) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    showPopoverForSelection();
  };

  const onVnum = (ch, v) => {
    if (annotate) selectVerse(ch, v);
  };

  const caretToPoint = (x, y) => {
    const range = document.caretRangeFromPoint?.(x, y);
    if (!range) return null;
    const base = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const vtext = base?.closest?.(".rd-vtext");
    if (!vtext) return null;
    return {
      chapter: Number(vtext.dataset.ch),
      verse: Number(vtext.dataset.v),
      offset: offsetInContainer(vtext, range.startContainer, range.startOffset),
    };
  };

  const onArticleClick = (e) => {
    if (pending) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const pt = caretToPoint(e.clientX, e.clientY);
    if (!pt) return;
    const hits = (highlightsByCh[pt.chapter] ?? []).filter((h) =>
      highlightCoversPoint(h, pt.verse, pt.offset),
    );
    if (hits.length) {
      setSessions({
        pos: { x: Math.min(e.clientX, window.innerWidth - 300), y: e.clientY + 6 },
        ids: hits.map((h) => h.id),
      });
    }
  };

  const notesFor = (annId) => notes.filter((n) => n.annotationId === annId);

  const openAddNote = (anno) => {
    setEditing({
      chapter: anno.chapter,
      verse: anno.anchor.startVerse,
      verseEnd: anno.anchor.endVerse,
      annotationId: anno.id,
      ref: `${bookName} ${anno.chapter}:${anno.anchor.startVerse}`,
      title: "",
      body: "",
    });
    setSessions(null);
  };

  const openEditNote = (n) => {
    setEditing({
      id: n.id,
      chapter: n.chapter,
      verse: n.verseStart,
      verseEnd: n.verseEnd,
      annotationId: n.annotationId,
      ref: `${bookName} ${n.chapter}:${n.verseStart}`,
      title: n.title,
      body: n.body,
    });
    setSessions(null);
  };

  const saveNote = ({ title, body }) => {
    if (editing.id) {
      notesStore.updateNote(editing.id, { title, body });
    } else {
      notesStore.addNote({
        book: bookName,
        chapter: editing.chapter,
        verseStart: editing.verse,
        verseEnd: editing.verseEnd ?? editing.verse,
        category: "general",
        title,
        body,
        annotationId: editing.annotationId ?? null,
        source: "reader",
      });
    }
    setEditing(null);
  };

  const openNoteLink = (id) => {
    setExpanded((s) => new Set(s).add(id));
    setTimeout(
      () => document.getElementById(`panel-note-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      30,
    );
  };
  const openRef = (ref) => {
    if (ref?.book) onChangeLocation(ref.book, ref.chapter ?? 1);
  };

  const lastCh = chapters[chapters.length - 1];
  const canPrev = chapters[0] > 1;
  const canNext = lastCh < book.chapters.length;
  const goto = (ch) => onChangeLocation(bookName, ch);
  const poetry = isPoetryBook(bookName);

  const wjFor = (ch, verse) => chapterMeta(bookMeta, ch).wj?.[String(verse)] ?? [];

  const renderSegments = (segs) =>
    segs.map((seg, i) => {
      if (seg.hls) {
        return (
          <mark
            key={i}
            className={`rd-hl${seg.wj ? " rd-wj" : ""}`}
            style={{ background: blendFill(seg.hls.map((h) => h.color)) }}
          >
            {seg.text}
          </mark>
        );
      }
      if (seg.wj) {
        return (
          <span key={i} className="rd-wj">
            {seg.text}
          </span>
        );
      }
      return <span key={i}>{seg.text}</span>;
    });

  const renderVerseInner = (ch, verse, text, fillHls, hideNum = false) => {
    const readCount = counts.get(`${ch}:${verse}`)?.count ?? 0;
    const hasNote = (noteMarks.get(`${ch}:${verse}`) ?? 0) > 0;
    const intervals = fillIntervalsForVerse(fillHls, verse, text.length);
    const segs = segmentVerseDisplay(text, intervals, wjFor(ch, verse));
    return (
      <span className={`rd-verse${readCount > 0 ? " read" : ""}`}>
        {!hideNum && (
          <sup
            className={`rd-vnum${annotate ? " annot" : ""}`}
            onClick={() => onVnum(ch, verse)}
          >
            {verse}
            {readCount > 0 && <span className="rd-read-dot" />}
            {hasNote && <span className="rd-note-dot" />}
          </sup>
        )}
        <span className="rd-vtext" data-ch={ch} data-v={verse}>
          {renderSegments(segs)}
        </span>
      </span>
    );
  };

  const renderChapterBody = (ch, verses, fillHls) => {
    const meta = chapterMeta(bookMeta, ch);
    const headings = meta.h ?? [];

    if (poetry) {
      return (
        <div className="rd-body rd-body--poetry">
          {chapterFlow(verses, headings).map((item, i) =>
            item.type === "heading" ? (
              <div
                key={`h-${i}`}
                className={`rd-section-head rd-section-head--${item.level}`}
                role="heading"
                aria-level={item.level === 1 ? 3 : 4}
              >
                {item.title}
              </div>
            ) : (
              <p key={`v-${item.verse}`} className="rd-poetry-line">
                {renderVerseInner(ch, item.verse, item.text, fillHls)}
              </p>
            ),
          )}
        </div>
      );
    }

    const items = chapterFlow(verses, headings);
    const nodes = [];
    let paraVerses = [];
    let isFirstPara = true;
    let nodeKey = 0;

    const flushPara = () => {
      if (!paraVerses.length) return;
      const k = nodeKey++;
      nodes.push(
        <p key={`p-${ch}-${k}`} className={`rd-para${isFirstPara ? " rd-para-first" : ""}`}>
          {isFirstPara && <span className="rd-chapter-drop" aria-hidden="true">{ch}</span>}
          {paraVerses.map((v, vi) => (
            <span key={v.verse} className="rd-verse-block">
              {renderVerseInner(ch, v.verse, v.text, fillHls, isFirstPara && v.verse === 1)}
              {vi < paraVerses.length - 1 ? " " : null}
            </span>
          ))}
        </p>,
      );
      paraVerses = [];
      isFirstPara = false;
    };

    for (const item of items) {
      if (item.type === "heading") {
        flushPara();
        nodes.push(
          <div
            key={`h-${ch}-${nodeKey++}`}
            className={`rd-section-head rd-section-head--${item.level}`}
            role="heading"
            aria-level={item.level === 1 ? 3 : 4}
          >
            {item.title}
          </div>,
        );
        continue;
      }
      if (paraVerses.length && /[.!?]["'”»]?\s*$/.test(paraVerses.at(-1).text.trim())) {
        flushPara();
      }
      paraVerses.push(item);
    }
    flushPara();

    return <div className="rd-body">{nodes}</div>;
  };

  return (
    <main className="reader-canvas">
      <header className="reader-toolbar">
        <div className="reader-toolbar-section">
          <select className="reader-select" value={bookName} onChange={(e) => onChangeLocation(e.target.value, 1)}>
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
          <select className="reader-select reader-select-ch" value={chapters[0]} onChange={(e) => goto(Number(e.target.value))}>
            {book.chapters.map((_, i) => (
              <option key={i + 1} value={i + 1}>
                Ch. {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="reader-toolbar-section reader-toolbar-nav">
          <button type="button" className="reader-pill-btn" disabled={!canPrev} onClick={() => goto(chapters[0] - 1)} aria-label="Previous chapter">
            ‹
          </button>
          <button type="button" className="reader-pill-btn" disabled={!canNext} onClick={() => goto(lastCh + 1)} aria-label="Next chapter">
            ›
          </button>
        </div>

        <div className="reader-toolbar-section reader-toolbar-tools">
          <button
            type="button"
            className={`reader-tool-toggle${annotate ? " active" : ""}`}
            onClick={() => {
              setAnnotate((a) => !a);
              setPending(null);
              setSessions(null);
            }}
          >
            <span className="reader-tool-icon" aria-hidden="true">✎</span>
            {annotate ? "Annotating" : "Annotate"}
          </button>
          {annotate && (
            <div className="reader-pen-modes">
              <button
                type="button"
                className={`reader-pen-mode${penStyle === "fill" ? " active" : ""}`}
                onClick={() => setPenStyle("fill")}
              >
                Highlight
              </button>
              <button
                type="button"
                className={`reader-pen-mode${penStyle === "scribble" ? " active" : ""}`}
                onClick={() => setPenStyle("scribble")}
              >
                Scribble
              </button>
            </div>
          )}
        </div>
      </header>

      {annotate && (
        <p className="reader-annotate-tip">
          Select text or tap a verse number to highlight. Tap a highlight to add notes.
        </p>
      )}

      <div className="reader-stage">
        <div className="reader-desk">
          <article
            className="reader-page"
            ref={articleRef}
            onMouseUp={onMouseUp}
            onClick={onArticleClick}
          >
            {chapters.map((ch) => {
              const verses = verseMap[ch];
              const fillHls = (highlightsByCh[ch] ?? []).filter((h) => h.style !== "scribble");
              return (
                <section key={ch} className="rd-chapter" data-ch={ch}>
                  <h2 className="rd-chapter-head">{bookName} {ch}</h2>
                  {!verses ? (
                    <p className="rd-loading">Loading chapter…</p>
                  ) : verses.length === 0 ? (
                    <p className="rd-loading">No text found.</p>
                  ) : (
                    renderChapterBody(ch, verses, fillHls)
                  )}
                </section>
              );
            })}
            <ScribbleOverlay containerRef={articleRef} scribbles={scribbles} revision={overlayRevision} />
          </article>

          <NotesPanel
            notes={pageNotes}
            expanded={expanded}
            onToggle={(id) =>
              setExpanded((s) => {
                const n = new Set(s);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              })
            }
            onExpandAll={() => setExpanded(new Set(pageNotes.map((n) => n.id)))}
            onCollapseAll={() => setExpanded(new Set())}
            onEdit={openEditNote}
            onOpenNoteLink={openNoteLink}
            onOpenRef={openRef}
          />
        </div>
      </div>

      <footer className="reader-footer">
        {canNext && (
          <button type="button" className="reader-pill-btn reader-pill-btn-wide" onClick={() => setChapters((c) => [...c, lastCh + 1])}>
            + Continue to {bookName} {lastCh + 1}
          </button>
        )}
        <span className="reader-credit">{WEB_CREDIT}</span>
      </footer>

      {pending && (
        <SelectionPopover
          pos={pending.pos}
          style={penStyle}
          onStyle={setPenStyle}
          onPick={createHighlights}
          onClose={() => {
            window.getSelection()?.removeAllRanges();
            setPending(null);
          }}
        />
      )}

      {sessions && (
        <HighlightSessions
          pos={sessions.pos}
          sessions={sessions.ids
            .map((id) => annotations.find((a) => a.id === id))
            .filter(Boolean)}
          notesFor={notesFor}
          annotate={annotate}
          onDeleteHighlight={(id) => {
            deleteAnnotation(id);
            setSessions((s) => {
              const ids = s.ids.filter((x) => x !== id);
              return ids.length ? { ...s, ids } : null;
            });
          }}
          onAddNote={openAddNote}
          onOpenNote={openEditNote}
          onClose={() => setSessions(null)}
        />
      )}

      {editing && (
        <NoteEditor
          initial={editing}
          notesForLinks={notes.filter((n) => n.id !== editing.id)}
          onSave={saveNote}
          onCancel={() => setEditing(null)}
          onDelete={
            editing.id
              ? () => {
                  notesStore.deleteNote(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
