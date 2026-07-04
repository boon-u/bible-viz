import { bookByName } from "../data/bibleMeta";

export function normalizeRange({ startChapter, startVerse, endChapter, endVerse }) {
  let sc = startChapter;
  let sv = startVerse;
  let ec = endChapter;
  let ev = endVerse;

  if (sc > ec || (sc === ec && sv > ev)) {
    [sc, sv, ec, ev] = [ec, ev, sc, sv];
  }

  return { startChapter: sc, startVerse: sv, endChapter: ec, endVerse: ev };
}

export function formatRangeLabel({ book, startChapter, startVerse, endChapter, endVerse }) {
  const { startChapter: sc, startVerse: sv, endChapter: ec, endVerse: ev } = normalizeRange({
    startChapter,
    startVerse,
    endChapter,
    endVerse,
  });

  if (sc === ec && sv === ev) return `${book} ${sc}:${sv}`;
  if (sc === ec) return `${book} ${sc}:${sv}–${ev}`;
  return `${book} ${sc}:${sv}–${ec}:${ev}`;
}

// Split a cross-chapter selection into one read event per chapter (inclusive).
export function expandRangeToReads({ book, startChapter, startVerse, endChapter, endVerse, date, ts }) {
  const b = bookByName(book);
  if (!b) throw new Error(`Unknown book: ${book}`);

  const { startChapter: sc, startVerse: sv, endChapter: ec, endVerse: ev } = normalizeRange({
    startChapter,
    startVerse,
    endChapter,
    endVerse,
  });

  const baseTs = ts ?? Date.now();
  const reads = [];

  for (let ch = sc; ch <= ec; ch++) {
    const maxV = b.chapters[ch - 1];
    const start = ch === sc ? sv : 1;
    const end = ch === ec ? ev : maxV;
    reads.push({ book, chapter: ch, start, end, date, ts: baseTs });
  }

  return reads;
}

export function chapterRangeBounds(range, chapter, book) {
  if (!range) return null;

  const { startChapter: sc, startVerse: sv, endChapter: ec, endVerse: ev } = normalizeRange({
    startChapter: range.startChapter,
    startVerse: range.startVerse,
    endChapter: range.endChapter,
    endVerse: range.endVerse,
  });

  if (chapter < sc || chapter > ec) return null;

  return {
    start: chapter === sc ? sv : 1,
    end: chapter === ec ? ev : book.chapters[chapter - 1],
  };
}
