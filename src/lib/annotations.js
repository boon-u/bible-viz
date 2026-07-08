import { useCallback, useEffect, useMemo, useState } from "react";

// Annotations store — same dual-backend shape as useReads/useNotes: Supabase
// `annotations` scoped to a profile when configured, else localStorage. Backs
// every reader annotation kind (highlights now; ink / text boxes / arrows later).
//
// App shape:
//   { id, book, chapter, kind, color, anchor, geometry, text, transcription,
//     createdAt, updatedAt }

const LOCAL_KEY = "bible-viz:annotations:v1";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? [];
  } catch {
    return [];
  }
}
function saveLocal(list) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable; session-only
  }
}

function fromRow(r) {
  return {
    id: r.id,
    book: r.book,
    chapter: r.chapter,
    kind: r.kind,
    color: r.color,
    anchor: r.anchor,
    geometry: r.geometry,
    text: r.text,
    transcription: r.transcription,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function toRow(a, profileId) {
  return {
    id: a.id,
    profile_id: profileId,
    book: a.book,
    chapter: a.chapter,
    kind: a.kind,
    color: a.color ?? null,
    anchor: a.anchor ?? null,
    geometry: a.geometry ?? null,
    text: a.text ?? null,
    transcription: a.transcription ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

function make(input) {
  const now = new Date().toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    book: input.book,
    chapter: input.chapter,
    kind: input.kind,
    color: input.color ?? null,
    anchor: input.anchor ?? null,
    geometry: input.geometry ?? null,
    text: input.text ?? null,
    transcription: input.transcription ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function useAnnotations({ supabase, profileId } = {}) {
  const cloud = Boolean(supabase && profileId);
  const [annotations, setAnnotations] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    async function load() {
      if (cloud) {
        const { data, error } = await supabase
          .from("annotations")
          .select("*")
          .eq("profile_id", profileId);
        if (!alive) return;
        if (error) {
          console.error("Failed to load annotations:", error.message);
          setAnnotations([]);
        } else {
          setAnnotations(data.map(fromRow));
        }
      } else if (alive) {
        setAnnotations(readLocal());
      }
      if (alive) setReady(true);
    }
    load();
    return () => {
      alive = false;
    };
  }, [cloud, supabase, profileId]);

  const addAnnotation = useCallback(
    (input) => {
      const a = make(input);
      setAnnotations((prev) => {
        const next = [...prev, a];
        if (!cloud) saveLocal(next);
        return next;
      });
      if (cloud) {
        supabase
          .from("annotations")
          .insert(toRow(a, profileId))
          .then(({ error }) => error && console.error("Save annotation failed:", error.message));
      }
      return a;
    },
    [cloud, supabase, profileId],
  );

  const updateAnnotation = useCallback(
    (id, patch) => {
      const updatedAt = new Date().toISOString();
      setAnnotations((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt } : a));
        if (!cloud) saveLocal(next);
        return next;
      });
      if (cloud) {
        const row = { ...patch, updated_at: updatedAt };
        // map camel geometry/anchor/text keys straight through (same names)
        supabase
          .from("annotations")
          .update(row)
          .eq("id", id)
          .then(({ error }) => error && console.error("Update annotation failed:", error.message));
      }
    },
    [cloud, supabase],
  );

  const deleteAnnotation = useCallback(
    (id) => {
      setAnnotations((prev) => {
        const next = prev.filter((a) => a.id !== id);
        if (!cloud) saveLocal(next);
        return next;
      });
      if (cloud) {
        supabase
          .from("annotations")
          .delete()
          .eq("id", id)
          .then(({ error }) => error && console.error("Delete annotation failed:", error.message));
      }
    },
    [cloud, supabase],
  );

  const exportAnnotations = useCallback(() => annotations, [annotations]);

  return { annotations, ready, cloud, addAnnotation, updateAnnotation, deleteAnnotation, exportAnnotations };
}

// Highlights for one chapter, grouped by verse → [{start,end,color,id}] sorted.
export function highlightsByVerse(annotations, book, chapter) {
  const map = new Map();
  for (const a of annotations) {
    if (a.kind !== "highlight" || a.book !== book || a.chapter !== chapter) continue;
    const v = a.anchor?.verse;
    if (v == null) continue;
    if (!map.has(v)) map.set(v, []);
    map.get(v).push({ id: a.id, start: a.anchor.start ?? 0, end: a.anchor.end ?? 0, color: a.color });
  }
  for (const list of map.values()) list.sort((x, y) => x.start - y.start);
  return map;
}
