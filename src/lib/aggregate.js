import { BIBLE, totalVerses } from "../data/bibleMeta";

// Map "chapter:verse" -> { count, dates: [] } for one book
export function bookVerseMap(reads, bookName) {
  const map = new Map();
  for (const r of reads) {
    if (r.book !== bookName) continue;
    for (let v = r.start; v <= r.end; v++) {
      const k = `${r.chapter}:${v}`;
      let e = map.get(k);
      if (!e) map.set(k, (e = { count: 0, dates: [] }));
      e.count++;
      e.dates.push(r.date);
    }
  }
  return map;
}

// Map bookName -> { unique, total, pct }
export function coverageByBook(reads) {
  const sets = new Map();
  for (const r of reads) {
    let s = sets.get(r.book);
    if (!s) sets.set(r.book, (s = new Set()));
    for (let v = r.start; v <= r.end; v++) s.add(`${r.chapter}:${v}`);
  }
  const out = new Map();
  for (const b of BIBLE) {
    const unique = sets.get(b.name)?.size ?? 0;
    const total = totalVerses(b);
    out.set(b.name, { unique, total, pct: (unique / total) * 100 });
  }
  return out;
}

// All verses ever read, sorted by count desc: [{ book, chapter, verse, count, dates }]
export function topVerses(reads) {
  const map = new Map();
  for (const r of reads) {
    for (let v = r.start; v <= r.end; v++) {
      const k = `${r.book}|${r.chapter}|${v}`;
      let e = map.get(k);
      if (!e) map.set(k, (e = { book: r.book, chapter: r.chapter, verse: v, count: 0, dates: [] }));
      e.count++;
      e.dates.push(r.date);
    }
  }
  const list = [...map.values()];
  for (const e of list) e.dates.sort();
  list.sort((a, b) => b.count - a.count || a.dates[a.dates.length - 1].localeCompare(b.dates[b.dates.length - 1]));
  return list;
}

export function overallStats(reads) {
  const coverage = coverageByBook(reads);
  let unique = 0;
  let total = 0;
  let booksTouched = 0;
  for (const { unique: u, total: t } of coverage.values()) {
    unique += u;
    total += t;
    if (u > 0) booksTouched++;
  }
  const days = new Set(reads.map((r) => r.date)).size;
  return { events: reads.length, unique, total, pct: (unique / total) * 100, booksTouched, days };
}
