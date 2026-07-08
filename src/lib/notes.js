import { useCallback, useEffect, useState } from "react";
import { parseRef, refCoversVerse } from "./refs";
import { SEED_NOTES } from "../data/seedNotes";

// Notes store — same dual-backend shape as useReads (src/lib/store.js): cloud
// (Supabase `notes` + `note_refs`, scoped to a profile) when configured, else
// localStorage. Notes are read-only in the UI; they get in via import/seed.
//
// App note shape:
//   { id, book, chapter, verseStart, verseEnd, category, title, body,
//     tags: [], refs: [{book, chapter, verseStart, verseEnd, label}],
//     source, createdAt, updatedAt }
// Anchor is inferred from which of book/chapter/verseStart are set.

const LOCAL_KEY = "bible-viz:notes:v1";

export const NOTE_CATEGORIES = [
  "intro", "background", "history", "word-study",
  "application", "sermon", "cross-ref", "topic", "general",
];

// --- normalization: import shape → app note ----------------------------
export function normalizeNote(raw) {
  const refs = (raw.refs ?? [])
    .map((r) => (typeof r === "string" ? parseRef(r) : r))
    .filter((r) => r && (r.book || r.label));
  const verseStart = raw.verseStart ?? raw.verse_start ?? null;
  const verseEnd = raw.verseEnd ?? raw.verse_end ?? verseStart ?? null;
  const createdAt = raw.createdAt ?? raw.created_at ?? new Date().toISOString();
  return {
    id: raw.id || crypto.randomUUID(),
    book: raw.book ?? null,
    chapter: raw.chapter ?? null,
    verseStart,
    verseEnd,
    category: raw.category || "general",
    title: raw.title || "Untitled note",
    body: raw.body || "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    refs,
    source: raw.source ?? null,
    createdAt,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? createdAt,
  };
}

// A note's home location as a structured ref (for coverage checks / labels).
export function noteAnchor(note) {
  return {
    book: note.book,
    chapter: note.chapter,
    verseStart: note.verseStart,
    verseEnd: note.verseEnd,
  };
}

// For one verse, split notes into those anchored here vs. those cross-referencing
// here. `target` = { book, chapter, verse }.
export function notesForVerse(notes, target) {
  const anchored = [];
  const referencing = [];
  for (const n of notes) {
    if (n.book && refCoversVerse(noteAnchor(n), target)) anchored.push(n);
    else if (n.refs.some((r) => refCoversVerse(r, target))) referencing.push(n);
  }
  return { anchored, referencing };
}

// Count of notes touching each "chapter:verse" of a book, for heatmap dots.
export function noteMarksForBook(notes, bookName) {
  const marks = new Map();
  const bump = (ch, v) => {
    if (ch == null || v == null) return;
    const k = `${ch}:${v}`;
    marks.set(k, (marks.get(k) ?? 0) + 1);
  };
  for (const n of notes) {
    const anchors = [];
    if (n.book === bookName) anchors.push(noteAnchor(n));
    for (const r of n.refs) if (r.book === bookName) anchors.push(r);
    for (const a of anchors) {
      if (a.chapter == null || a.verseStart == null) continue; // book/chapter-level: no dot
      const end = a.verseEnd ?? a.verseStart;
      for (let v = a.verseStart; v <= end; v++) bump(a.chapter, v);
    }
  }
  return marks;
}

const sortNotes = (list) =>
  [...list].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

// --- localStorage helpers ----------------------------------------------
function readLocalNotes() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw == null) return null; // null ⇒ never seeded
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalNotes(notes) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  } catch {
    // storage unavailable; in-memory state still works for the session
  }
}

// --- cloud row mapping --------------------------------------------------
function noteToRow(note, profileId) {
  return {
    id: note.id,
    profile_id: profileId,
    book: note.book,
    chapter: note.chapter,
    verse_start: note.verseStart,
    verse_end: note.verseEnd,
    category: note.category,
    title: note.title,
    body: note.body,
    tags: note.tags,
    source: note.source,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

function refsToRows(note) {
  return note.refs.map((r) => ({
    note_id: note.id,
    book: r.book,
    chapter: r.chapter ?? null,
    verse_start: r.verseStart ?? null,
    verse_end: r.verseEnd ?? null,
    label: r.label ?? null,
  }));
}

function noteFromRows(row, refRows) {
  return {
    id: row.id,
    book: row.book,
    chapter: row.chapter,
    verseStart: row.verse_start,
    verseEnd: row.verse_end,
    category: row.category,
    title: row.title,
    body: row.body ?? "",
    tags: row.tags ?? [],
    refs: refRows.map((r) => ({
      book: r.book,
      chapter: r.chapter,
      verseStart: r.verse_start,
      verseEnd: r.verse_end,
      label: r.label,
    })),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- import parsing (JSON or Markdown front-matter) --------------------
function parseFrontMatterValue(v) {
  const t = v.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    return t
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return t.replace(/^["']|["']$/g, "");
}

function parseMarkdownNotes(text) {
  // Split into blocks each starting with a front-matter fence.
  const blocks = text.split(/^---\s*$/m);
  const out = [];
  // blocks alternate: [pre, fm, body, fm, body, ...]; find fm/body pairs.
  for (let i = 1; i < blocks.length; i += 2) {
    const fm = blocks[i];
    const body = (blocks[i + 1] ?? "").trim();
    const note = { body };
    for (const line of fm.split("\n")) {
      const m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = parseFrontMatterValue(m[2]);
      if (key === "chapter" || key === "verseStart" || key === "verseEnd") {
        note[key] = val === "" ? null : Number(val);
      } else {
        note[key] = val;
      }
    }
    if (note.title) out.push(note);
  }
  return out;
}

export function parseNotesImport(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const data = JSON.parse(trimmed);
    const arr = Array.isArray(data) ? data : (data.notes ?? []);
    if (!Array.isArray(arr)) throw new Error("Expected a `notes` array or a JSON array");
    return arr;
  }
  const md = parseMarkdownNotes(trimmed);
  if (!md.length) throw new Error("No notes found — expected JSON, or Markdown with a `title` front-matter key");
  return md;
}

// -----------------------------------------------------------------------
export function useNotes({ supabase, profileId } = {}) {
  const cloud = Boolean(supabase && profileId);
  const [notes, setNotes] = useState([]);
  const [ready, setReady] = useState(false);

  // load
  useEffect(() => {
    let alive = true;
    setReady(false);
    async function load() {
      if (cloud) {
        const { data: rows, error } = await supabase
          .from("notes")
          .select("*")
          .eq("profile_id", profileId);
        if (!alive) return;
        if (error) {
          console.error("Failed to load notes:", error.message);
          setNotes([]);
        } else {
          const ids = rows.map((r) => r.id);
          let refsByNote = new Map();
          if (ids.length) {
            const { data: refRows } = await supabase
              .from("note_refs")
              .select("*")
              .in("note_id", ids);
            for (const rr of refRows ?? []) {
              if (!refsByNote.has(rr.note_id)) refsByNote.set(rr.note_id, []);
              refsByNote.get(rr.note_id).push(rr);
            }
          }
          if (!alive) return;
          setNotes(sortNotes(rows.map((r) => noteFromRows(r, refsByNote.get(r.id) ?? []))));
        }
      } else {
        const local = readLocalNotes();
        if (local == null) {
          // first ever run in this browser → seed sample notes
          const seeded = SEED_NOTES.map(normalizeNote);
          saveLocalNotes(seeded);
          if (alive) setNotes(sortNotes(seeded));
        } else {
          if (alive) setNotes(sortNotes(local.map(normalizeNote)));
        }
      }
      if (alive) setReady(true);
    }
    load();
    return () => {
      alive = false;
    };
  }, [cloud, supabase, profileId]);

  const persistCloudNote = useCallback(
    async (note) => {
      const { error } = await supabase.from("notes").upsert(noteToRow(note, profileId), { onConflict: "id" });
      if (error) throw new Error(error.message);
      await supabase.from("note_refs").delete().eq("note_id", note.id);
      const rows = refsToRows(note);
      if (rows.length) {
        const { error: refErr } = await supabase.from("note_refs").insert(rows);
        if (refErr) throw new Error(refErr.message);
      }
    },
    [supabase, profileId],
  );

  const addNotes = useCallback(
    async (raws) => {
      const incoming = raws.map(normalizeNote);
      setNotes((prev) => {
        const byId = new Map([...prev, ...incoming].map((n) => [n.id, n]));
        const merged = sortNotes([...byId.values()]);
        if (!cloud) saveLocalNotes(merged);
        return merged;
      });
      if (cloud) {
        for (const note of incoming) await persistCloudNote(note);
      }
      return incoming;
    },
    [cloud, persistCloudNote],
  );

  const deleteNote = useCallback(
    (id) => {
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        if (!cloud) saveLocalNotes(next);
        return next;
      });
      if (cloud) {
        supabase
          .from("notes")
          .delete()
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("Failed to delete note:", error.message);
          });
      }
    },
    [cloud, supabase],
  );

  const importNotes = useCallback(
    async (text) => {
      const raws = parseNotesImport(text);
      await addNotes(raws);
      return raws.length;
    },
    [addNotes],
  );

  // Export shape mirrors the import shape (refs as strings) — round-trips.
  const exportNotes = useCallback(
    () =>
      notes.map((n) => ({
        id: n.id,
        title: n.title,
        book: n.book,
        chapter: n.chapter,
        verseStart: n.verseStart,
        verseEnd: n.verseEnd,
        category: n.category,
        tags: n.tags,
        body: n.body,
        refs: n.refs.map((r) => r.label ?? r.book).filter(Boolean),
        source: n.source,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    [notes],
  );

  return { notes, ready, cloud, addNotes, deleteNote, importNotes, exportNotes };
}
