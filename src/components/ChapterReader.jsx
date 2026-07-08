import { useEffect, useMemo, useRef, useState } from "react";
import { BIBLE, OT_COUNT, bookByName } from "../data/bibleMeta";
import { getChapter, WEB_CREDIT } from "../lib/bibleText";
import { bookVerseMap } from "../lib/aggregate";
import { noteMarksForBook } from "../lib/notes";
import { highlightsForChapter, highlightCoversPoint } from "../lib/annotations";
import {
  blendFill,
  fillIntervalsForVerse,
  offsetInContainer,
  segmentVerseFill,
  selectionToRanges,
} from "../lib/highlight";
import { expandRangeToReads } from "../lib/readRange";
import { todayISO } from "../lib/store";
import ScribbleOverlay from "./ScribbleOverlay";
import SelectionPopover from "./SelectionPopover";
import HighlightSessions from "./HighlightSessions";
import NotesPanel from "./NotesPanel";
import NoteEditor from "./NoteEditor";

// Reader with a paper-Bible annotation model: turn Annotate on, select text to
// highlight (Fill or hand-drawn Scribble), click a highlight to manage its
// sessions + titled notes. Highlighting auto-logs the read. Layout never shifts.
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
  const [annotate, setAnnotate] = useState(false);
  const [penStyle, setPenStyle] = useState("fill");
  const [pending, setPending] = useState(null); // { ranges, pos }
  const [sessions, setSessions] = useState(null); // { pos, ids }
  const [editing, setEditing] = useState(null); // note editor state
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

  // --- highlight creation from a selection --------------------------------
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
      // highlighting something means you read it → log it
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

  // --- click a highlight → sessions popover -------------------------------
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
    if (sel && !sel.isCollapsed) return; // this was a selection, not a click
    const pt = caretToPoint(e.clientX, e.clientY);
    if (!pt) return;
    const hits = (highlightsByCh[pt.chapter] ?? []).filter((h) =>
      highlightCoversPoint(h, pt.verse, pt.offset),
    );
    if (hits.length) setSessions({ pos: { x: Math.min(e.clientX, window.innerWidth - 300), y: e.clientY + 6 }, ids: hits.map((h) => h.id) });
  };

  // --- notes --------------------------------------------------------------
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
    setTimeout(() => document.getElementById(`panel-note-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
  };
  const openRef = (ref) => {
    if (ref?.book) onChangeLocation(ref.book, ref.chapter ?? 1);
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
        <button className="ghost-btn" disabled={!canPrev} onClick={() => goto(chapters[0] - 1)}>← Prev</button>
        <button className="ghost-btn" disabled={!canNext} onClick={() => goto(lastCh + 1)}>Next →</button>

        <div className="reader-pen">
          <button
            className={`pen-toggle${annotate ? " on" : ""}`}
            onClick={() => {
              setAnnotate((a) => !a);
              setPending(null);
              setSessions(null);
            }}
          >
            {annotate ? "✎ Annotating" : "✎ Annotate"}
          </button>
          {annotate && (
            <div className="pen-styles">
              <button className={penStyle === "fill" ? "active" : ""} onClick={() => setPenStyle("fill")}>▬ Fill</button>
              <button className={penStyle === "scribble" ? "active" : ""} onClick={() => setPenStyle("scribble")}>◯ Scribble</button>
            </div>
          )}
        </div>
      </div>

      {annotate && (
        <p className="reader-hint">
          Select any words or a verse (or tap a verse number) to highlight. Click a highlight to add a note or remove it.
        </p>
      )}

      <div className="reader-body">
        <article
          className="reader-text"
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
                  <p className="rd-loading">Loading…</p>
                ) : verses.length === 0 ? (
                  <p className="rd-loading">No text found.</p>
                ) : (
                  <p className="rd-prose">
                    {verses.map(({ verse, text }) => {
                      const readCount = counts.get(`${ch}:${verse}`)?.count ?? 0;
                      const hasNote = (noteMarks.get(`${ch}:${verse}`) ?? 0) > 0;
                      const intervals = fillIntervalsForVerse(fillHls, verse, text.length);
                      const segs = segmentVerseFill(text, intervals);
                      return (
                        <span key={verse} className={`rd-verse${readCount > 0 ? " read" : ""}`}>
                          <sup
                            className={`rd-vnum${annotate ? " annot" : ""}`}
                            onClick={() => onVnum(ch, verse)}
                          >
                            {verse}
                            {readCount > 0 && <span className="rd-read-dot" />}
                            {hasNote && <span className="rd-note-dot" />}
                          </sup>
                          <span className="rd-vtext" data-ch={ch} data-v={verse}>
                            {segs.map((seg, i) =>
                              seg.hls ? (
                                <mark
                                  key={i}
                                  className="rd-hl"
                                  style={{ background: blendFill(seg.hls.map((h) => h.color)) }}
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

      <div className="reader-foot">
        {canNext && (
          <button className="ghost-btn" onClick={() => setChapters((c) => [...c, lastCh + 1])}>
            + Show {bookName} {lastCh + 1}
          </button>
        )}
        <span className="reader-credit">{WEB_CREDIT}</span>
      </div>

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
