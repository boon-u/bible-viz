import { refLabel } from "./store";

export function versesInRead(read) {
  return read.end - read.start + 1;
}

// date (YYYY-MM-DD) -> { verseCount, reads[] }
export function aggregateByDate(reads) {
  const map = new Map();
  for (const r of reads) {
    let day = map.get(r.date);
    if (!day) map.set(r.date, (day = { verseCount: 0, reads: [] }));
    day.verseCount += versesInRead(r);
    day.reads.push(r);
  }
  for (const day of map.values()) {
    day.reads.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  }
  return map;
}

export function readingYears(reads) {
  const years = new Set([new Date().getFullYear()]);
  for (const r of reads) {
    years.add(Number(r.date.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// GitHub-style grid: columns = weeks, rows = Sun–Sat.
export function buildYearGrid(year, byDate) {
  const dec31 = new Date(year, 11, 31);
  const cursor = new Date(year, 0, 1);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const weeks = [];
  while (true) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = toISO(cursor);
      const inYear = cursor.getFullYear() === year;
      const stats = byDate.get(date);
      week.push({
        date,
        inYear,
        verseCount: inYear ? (stats?.verseCount ?? 0) : 0,
        reads: inYear ? (stats?.reads ?? []) : [],
        month: cursor.getMonth(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    const lastCell = week[6];
    const lastDate = new Date(lastCell.date.replace(/-/g, "/"));
    if (lastDate >= dec31 && lastDate.getDay() === 6) break;
    if (weeks.length > 55) break;
  }
  return weeks;
}

export function maxVerseCountInYear(reads, year) {
  const prefix = `${year}-`;
  let max = 0;
  const byDate = aggregateByDate(reads.filter((r) => r.date.startsWith(prefix)));
  for (const { verseCount } of byDate.values()) {
    if (verseCount > max) max = verseCount;
  }
  return max;
}

export function tierForVerseCount(count, maxInYear) {
  if (count <= 0) return 0;
  if (maxInYear <= 0) return 1;
  const r = count / maxInYear;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

export function yearSummary(reads, year) {
  const prefix = `${year}-`;
  const yearReads = reads.filter((r) => r.date.startsWith(prefix));
  const byDate = aggregateByDate(yearReads);
  let verses = 0;
  for (const { verseCount } of byDate.values()) verses += verseCount;
  return {
    days: byDate.size,
    verses,
    logs: yearReads.length,
  };
}

export function formatDayRefs(reads) {
  return reads.map((r) => refLabel(r)).join(", ");
}
