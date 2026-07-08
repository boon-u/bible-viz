// Reference parsing: turn a human string like "Rom 8:28-30" or "1 Cor 13" into a
// structured { book, chapter, verseStart, verseEnd } using the canonical book
// names in bibleMeta plus common abbreviations. Powers clickable cross-references
// and note import. Unresolvable strings still return a best-effort object with
// `book: null` so nothing is silently dropped.

import { BIBLE } from "../data/bibleMeta";

// Extra abbreviations → canonical name. Canonical names and their no-space /
// lowercase forms are added automatically below, so only list the irregular ones.
const ALIASES = {
  gen: "Genesis", ge: "Genesis", gn: "Genesis",
  ex: "Exodus", exo: "Exodus", exod: "Exodus",
  lev: "Leviticus", lv: "Leviticus",
  num: "Numbers", nm: "Numbers", nu: "Numbers",
  deut: "Deuteronomy", dt: "Deuteronomy",
  josh: "Joshua", jos: "Joshua",
  judg: "Judges", jdg: "Judges",
  "1sam": "1 Samuel", "1sa": "1 Samuel", "1sm": "1 Samuel",
  "2sam": "2 Samuel", "2sa": "2 Samuel", "2sm": "2 Samuel",
  "1kgs": "1 Kings", "1ki": "1 Kings", "1kg": "1 Kings",
  "2kgs": "2 Kings", "2ki": "2 Kings", "2kg": "2 Kings",
  "1chr": "1 Chronicles", "1ch": "1 Chronicles",
  "2chr": "2 Chronicles", "2ch": "2 Chronicles",
  neh: "Nehemiah", est: "Esther", ps: "Psalms", psa: "Psalms",
  psalm: "Psalms", psm: "Psalms", pss: "Psalms",
  prov: "Proverbs", prv: "Proverbs", pr: "Proverbs",
  eccl: "Ecclesiastes", ecc: "Ecclesiastes", qoh: "Ecclesiastes",
  song: "Song of Solomon", sos: "Song of Solomon", canticles: "Song of Solomon",
  "songofsongs": "Song of Solomon",
  isa: "Isaiah", is: "Isaiah",
  jer: "Jeremiah", lam: "Lamentations", ezek: "Ezekiel", eze: "Ezekiel", ezk: "Ezekiel",
  dan: "Daniel", dn: "Daniel", hos: "Hosea", obad: "Obadiah", oba: "Obadiah",
  jon: "Jonah", mic: "Micah", nah: "Nahum", hab: "Habakkuk", zeph: "Zephaniah",
  zep: "Zephaniah", hag: "Haggai", zech: "Zechariah", zec: "Zechariah", mal: "Malachi",
  matt: "Matthew", mt: "Matthew", mk: "Mark", mrk: "Mark",
  lk: "Luke", luk: "Luke", jn: "John", joh: "John",
  rom: "Romans", ro: "Romans",
  "1cor": "1 Corinthians", "1co": "1 Corinthians",
  "2cor": "2 Corinthians", "2co": "2 Corinthians",
  gal: "Galatians", eph: "Ephesians", ephes: "Ephesians",
  phil: "Philippians", php: "Philippians", pp: "Philippians",
  col: "Colossians",
  "1thess": "1 Thessalonians", "1th": "1 Thessalonians", "1thes": "1 Thessalonians",
  "2thess": "2 Thessalonians", "2th": "2 Thessalonians", "2thes": "2 Thessalonians",
  "1tim": "1 Timothy", "1ti": "1 Timothy",
  "2tim": "2 Timothy", "2ti": "2 Timothy",
  tit: "Titus", phlm: "Philemon", phm: "Philemon", heb: "Hebrews",
  jas: "James", jm: "James",
  "1pet": "1 Peter", "1pe": "1 Peter", "1pt": "1 Peter",
  "2pet": "2 Peter", "2pe": "2 Peter", "2pt": "2 Peter",
  "1jn": "1 John", "1jo": "1 John", "1john": "1 John",
  "2jn": "2 John", "2jo": "2 John", "2john": "2 John",
  "3jn": "3 John", "3jo": "3 John", "3john": "3 John",
  jud: "Jude", rev: "Revelation", rv: "Revelation", apoc: "Revelation",
};

const norm = (s) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");

// canonical lookup: normalized name/alias → canonical book name
const BOOK_LOOKUP = (() => {
  const m = new Map();
  for (const b of BIBLE) m.set(norm(b.name), b.name);
  for (const [alias, name] of Object.entries(ALIASES)) m.set(norm(alias), name);
  return m;
})();

export function resolveBook(raw) {
  return BOOK_LOOKUP.get(norm(raw)) ?? null;
}

// Parse "Book Chapter:VerseStart-VerseEnd" (chapter/verses optional).
// Examples: "John 3:16", "Rom 8:28-30", "1 Cor 13", "Psalm 23", "Genesis".
export function parseRef(input) {
  if (!input || typeof input !== "string") return null;
  const s = input.trim();
  // book part = leading number? + letters/spaces; then the numeric tail.
  const m = s.match(/^\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z.\s]*?)\s*(\d.*)?$/);
  if (!m) return null;
  const book = resolveBook(m[1]);
  const rest = (m[2] ?? "").trim();
  let chapter = null;
  let verseStart = null;
  let verseEnd = null;
  if (rest) {
    const cm = rest.match(/^(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?/);
    if (cm) {
      chapter = Number(cm[1]);
      if (cm[2] != null) {
        verseStart = Number(cm[2]);
        verseEnd = cm[3] != null ? Number(cm[3]) : verseStart;
      }
    }
  }
  return { book, chapter, verseStart, verseEnd, label: s };
}

// A canonical display label for a structured ref/anchor.
export function refLabelOf({ book, chapter, verseStart, verseEnd }) {
  if (!book) return "";
  let out = book;
  if (chapter != null) {
    out += ` ${chapter}`;
    if (verseStart != null) {
      out += `:${verseStart}`;
      if (verseEnd != null && verseEnd !== verseStart) out += `–${verseEnd}`;
    }
  }
  return out;
}

// Does structured `ref` cover book/chapter/verse `target`? Used to find notes
// attached to or referencing a specific verse. A book-level ref (no chapter)
// covers the whole book; a chapter-level ref covers the whole chapter.
export function refCoversVerse(ref, target) {
  if (!ref.book || ref.book !== target.book) return false;
  if (ref.chapter == null) return true;
  if (ref.chapter !== target.chapter) return false;
  if (ref.verseStart == null) return true;
  const end = ref.verseEnd ?? ref.verseStart;
  return target.verse >= ref.verseStart && target.verse <= end;
}

// Rewrite inline [[Book C:V]] tokens into Markdown links with a `ref:` scheme so
// react-markdown renders them; NoteReader intercepts `ref:` hrefs to make them
// clickable cross-references.
export function inlineRefsToMarkdown(body) {
  return body.replace(/\[\[([^\]]+)\]\]/g, (_, r) => `[${r}](ref:${encodeURIComponent(r.trim())})`);
}

// Split note body into text + inline [[reference]] tokens for clickable rendering.
// Returns an array of { type: 'text', value } | { type: 'ref', value, ref }.
const INLINE_REF = /\[\[([^\]]+)\]\]/g;
export function splitInlineRefs(body) {
  const parts = [];
  let last = 0;
  let m;
  INLINE_REF.lastIndex = 0;
  while ((m = INLINE_REF.exec(body)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: body.slice(last, m.index) });
    parts.push({ type: "ref", value: m[1], ref: parseRef(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ type: "text", value: body.slice(last) });
  return parts;
}
