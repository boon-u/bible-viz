// World English Bible (public domain) text access. Text lives as per-book JSON in
// public/bible/web/<n>.json (n = 1-based index into bibleMeta's BIBLE array),
// fetched on demand and cached in memory so the app stays light and only pulls a
// book's words the first time it's opened. No API, no keys, works offline.
//
// File shape: { book: "Genesis", chapters: [ ["v1 text", "v2 text", …], … ] }

import { BIBLE } from "../data/bibleMeta";

const cache = new Map(); // book index (1-based) -> { book, chapters }
const inflight = new Map(); // dedupe concurrent loads

export function bookIndex(bookName) {
  return BIBLE.findIndex((b) => b.name === bookName) + 1; // 0 => unknown
}

export async function loadBook(bookName) {
  const nr = bookIndex(bookName);
  if (!nr) throw new Error(`Unknown book: ${bookName}`);
  if (cache.has(nr)) return cache.get(nr);
  if (inflight.has(nr)) return inflight.get(nr);

  const p = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}bible/web/${nr}.json`);
    if (!res.ok) throw new Error(`Failed to load ${bookName} (${res.status})`);
    const data = await res.json();
    cache.set(nr, data);
    inflight.delete(nr);
    return data;
  })();
  inflight.set(nr, p);
  return p;
}

// Returns [{ verse, text }] for one chapter.
export async function getChapter(bookName, chapter) {
  const data = await loadBook(bookName);
  const verses = data.chapters[chapter - 1] ?? [];
  return verses.map((text, i) => ({ verse: i + 1, text }));
}

export const WEB_CREDIT =
  "World English Bible (public domain).";
