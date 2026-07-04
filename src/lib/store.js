import { useCallback, useEffect, useState } from "react";

const LOCAL_KEY = "bible-viz:reads:v1";

// A read event. Ranges are inclusive: { id, book, chapter, start, end, date: "YYYY-MM-DD", ts }

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function refLabel({ book, chapter, start, end }) {
  return `${book} ${chapter}:${start}${end !== start ? `–${end}` : ""}`;
}

// --- local storage helpers ---------------------------------------------
export function readLocalReads() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveLocalReads(reads) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(reads));
  } catch {
    // storage unavailable; in-memory state still works for the session
  }
}

// --- mapping between app reads and Supabase rows -----------------------
function fromRow(row) {
  return {
    id: row.id,
    book: row.book,
    chapter: row.chapter,
    start: row.verse_start,
    end: row.verse_end,
    date: row.date,
    ts: Number(row.ts),
  };
}

function toRow(read, profileId) {
  return {
    id: read.id,
    profile_id: profileId,
    book: read.book,
    chapter: read.chapter,
    verse_start: read.start,
    verse_end: read.end,
    date: read.date,
    ts: read.ts,
  };
}

function makeRead({ book, chapter, start, end, date }) {
  return { id: crypto.randomUUID(), book, chapter, start, end, date, ts: Date.now() };
}

function validate(incoming) {
  if (!Array.isArray(incoming)) throw new Error("Expected a JSON array of reads");
  for (const r of incoming) {
    if (!r.id || !r.book || !r.chapter || !r.start || !r.end || !r.date) {
      throw new Error("Each read needs id, book, chapter, start, end, date");
    }
  }
}

// `useReads({ supabase, profileId })` — when both are present, reads live in
// Supabase scoped to that profile; otherwise they live in localStorage. The
// returned API is identical either way, so views don't care which backend
// is active.
export function useReads({ supabase, profileId } = {}) {
  const cloud = Boolean(supabase && profileId);
  const [reads, setReads] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    async function load() {
      if (cloud) {
        const { data, error } = await supabase
          .from("reads")
          .select("*")
          .eq("profile_id", profileId)
          .order("ts", { ascending: true });
        if (!alive) return;
        if (error) {
          console.error("Failed to load reads:", error.message);
          setReads([]);
        } else {
          setReads(data.map(fromRow));
        }
      } else {
        if (!alive) return;
        setReads(readLocalReads());
      }
      if (alive) setReady(true);
    }
    load();
    return () => {
      alive = false;
    };
  }, [cloud, supabase, profileId]);

  const addRead = useCallback(
    (input) => {
      const read = makeRead(input);
      setReads((prev) => {
        const next = [...prev, read];
        if (!cloud) saveLocalReads(next);
        return next;
      });
      if (cloud) {
        supabase
          .from("reads")
          .insert(toRow(read, profileId))
          .then(({ error }) => {
            if (error) console.error("Failed to save read:", error.message);
          });
      }
      return read;
    },
    [cloud, supabase, profileId],
  );

  const addReads = useCallback(
    (inputs) => {
      if (!inputs.length) return [];
      const baseTs = Date.now();
      const newReads = inputs.map((input, i) =>
        makeRead({ ...input, ts: input.ts ?? baseTs + i }),
      );
      setReads((prev) => {
        const next = [...prev, ...newReads];
        if (!cloud) saveLocalReads(next);
        return next;
      });
      if (cloud) {
        supabase
          .from("reads")
          .insert(newReads.map((r) => toRow(r, profileId)))
          .then(({ error }) => {
            if (error) console.error("Failed to save reads:", error.message);
          });
      }
      return newReads;
    },
    [cloud, supabase, profileId],
  );

  const deleteRead = useCallback(
    (id) => {
      setReads((prev) => {
        const next = prev.filter((r) => r.id !== id);
        if (!cloud) saveLocalReads(next);
        return next;
      });
      if (cloud) {
        supabase
          .from("reads")
          .delete()
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("Failed to delete read:", error.message);
          });
      }
    },
    [cloud, supabase, profileId],
  );

  const importReads = useCallback(
    async (text) => {
      const incoming = JSON.parse(text);
      validate(incoming);
      setReads((prev) => {
        const byId = new Map([...prev, ...incoming].map((r) => [r.id, r]));
        const merged = [...byId.values()].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
        if (!cloud) saveLocalReads(merged);
        return merged;
      });
      if (cloud) {
        const rows = incoming.map((r) => toRow({ ...r, ts: r.ts ?? Date.now() }, profileId));
        const { error } = await supabase.from("reads").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }
      return incoming.length;
    },
    [cloud, supabase, profileId],
  );

  const exportJSON = useCallback(() => JSON.stringify(reads, null, 2), [reads]);

  return { reads, ready, cloud, addRead, addReads, deleteRead, importReads, exportJSON };
}
