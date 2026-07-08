// Group verses into paragraphs and detect poetry books for reader layout.

const POETRY_BOOKS = new Set([
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Lamentations",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
]);

export function isPoetryBook(bookName) {
  return POETRY_BOOKS.has(bookName);
}

function endsSentence(text) {
  return /[.!?]["'”»]?\s*$/.test(text.trim());
}

/** Prose: group verses into paragraph blocks (study-Bible paragraph style). */
export function groupIntoParagraphs(verses, { breakBeforeVerse = null } = {}) {
  if (!verses?.length) return [];
  const paragraphs = [];
  let current = [];

  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const breakPara =
      i > 0 &&
      (endsSentence(verses[i - 1].text) || breakBeforeVerse?.has(v.verse));
    if (breakPara) {
      paragraphs.push(current);
      current = [];
    }
    current.push(v);
  }
  if (current.length) paragraphs.push(current);
  return paragraphs;
}

/** Flatten chapter into headings and verses in reading order. */
export function chapterFlow(verses, headings = []) {
  const byVerse = new Map();
  for (const [before, level, title] of headings) {
    if (!byVerse.has(before)) byVerse.set(before, []);
    byVerse.get(before).push({ level, title });
  }
  const items = [];
  for (const v of verses) {
    for (const h of byVerse.get(v.verse) ?? []) {
      items.push({ type: "heading", ...h });
    }
    items.push({ type: "verse", ...v });
  }
  return items;
}
