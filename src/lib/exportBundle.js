import { topVerses } from "./aggregate";

// Universal export — one portable JSON object carrying *everything* so notes and
// their metadata can move to any other tool or AI: profile, raw reads, derived
// per-verse read counts, and notes (import-shaped, so it re-imports cleanly).
export function buildUniversalExport({ profile, reads, notes }) {
  const readCounts = topVerses(reads).map((v) => ({
    book: v.book,
    chapter: v.chapter,
    verse: v.verse,
    count: v.count,
    dates: v.dates,
  }));
  return {
    app: "bible-viz",
    format: "universal-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ? { username: profile.username } : null,
    reads,
    readCounts,
    notes,
  };
}

const fmField = (k, v) => {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) return v.length ? `${k}: [${v.join(", ")}]` : null;
  return `${k}: ${v}`;
};

// Combined Markdown export: each note as a section with YAML front-matter, so it
// drops straight into Obsidian/Notion or back into an AI prompt. Re-importable.
export function buildMarkdownExport(notes) {
  const head =
    "# Bible Viz — study notes\n\n" +
    `_Exported ${new Date().toISOString().slice(0, 10)} · ${notes.length} note${notes.length === 1 ? "" : "s"}._\n\n`;
  const body = notes
    .map((n) => {
      const fm = [
        fmField("title", n.title),
        fmField("book", n.book),
        fmField("chapter", n.chapter),
        fmField("verseStart", n.verseStart),
        fmField("verseEnd", n.verseEnd),
        fmField("category", n.category),
        fmField("tags", n.tags),
        fmField("refs", n.refs.map((r) => r.label ?? r.book).filter(Boolean)),
      ]
        .filter(Boolean)
        .join("\n");
      return `---\n${fm}\n---\n\n${n.body}\n`;
    })
    .join("\n");
  return head + body;
}
