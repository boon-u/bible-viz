/** Display helpers for Notion-style study note cards. */

export const CATEGORY_META = {
  intro: { icon: "📋", label: "Overview", dot: "#787774", bg: "#f1f1ef" },
  background: { icon: "🏛", label: "Background", dot: "#9065b0", bg: "#f6f3f9" },
  history: { icon: "📜", label: "History", dot: "#d9730d", bg: "#faf3e8" },
  "word-study": { icon: "🔤", label: "Word study", dot: "#2383e2", bg: "#eef6fd" },
  application: { icon: "💡", label: "Application", dot: "#0f7b6c", bg: "#edf7f6" },
  sermon: { icon: "🎙", label: "Teaching", dot: "#64473a", bg: "#f4eeee" },
  "cross-ref": { icon: "🔗", label: "Cross-ref", dot: "#dfab01", bg: "#fbf8e7" },
  topic: { icon: "🏷", label: "Theme", dot: "#529cca", bg: "#eef5fa" },
  general: { icon: "📝", label: "Note", dot: "#787774", bg: "#f1f1ef" },
};

export function categoryMeta(category) {
  return CATEGORY_META[category] ?? CATEGORY_META.general;
}

export function formatScriptureRef(note, fallbackBook) {
  const book = note.book ?? fallbackBook;
  if (!note.chapter) return book ?? "—";
  let ref = `${book} ${note.chapter}:${note.verseStart ?? "?"}`;
  if (note.verseEnd && note.verseEnd !== note.verseStart) {
    ref += `–${note.verseEnd}`;
  }
  return ref;
}

export function formatNoteDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** Study depth hint: body + refs + tags (0–100). */
export function studyDepth(note) {
  let score = 0;
  if (note.body?.trim()) score += Math.min(50, note.body.trim().length / 20);
  score += Math.min(30, (note.refs?.length ?? 0) * 10);
  score += Math.min(20, (note.tags?.length ?? 0) * 5);
  return Math.round(Math.min(100, score));
}

export function crossRefLabel(note) {
  const n = note.refs?.length ?? 0;
  if (!n) return null;
  const first = note.refs[0];
  const label = first.label ?? (first.book ? `${first.book}${first.chapter ? ` ${first.chapter}:${first.verseStart ?? ""}` : ""}` : "");
  if (n === 1) return label || "1 reference";
  return `${label || "References"} +${n - 1}`;
}
