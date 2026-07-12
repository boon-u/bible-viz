export function verseKey(chapter, verse) {
  return `${chapter}:${verse}`;
}

export function parseVerseKey(key) {
  if (!key) return null;
  const [chapter, verse] = key.split(":").map(Number);
  if (!chapter || !verse) return null;
  return { chapter, verse };
}

export function noteCoversVerse(note, chapter, verse) {
  if (note.chapter !== chapter) return false;
  const end = note.verseEnd ?? note.verseStart;
  return verse >= note.verseStart && verse <= end;
}

export function verseKeysWithNotes(notes) {
  const set = new Set();
  for (const n of notes) {
    const end = n.verseEnd ?? n.verseStart;
    for (let v = n.verseStart; v <= end; v++) set.add(verseKey(n.chapter, v));
  }
  return set;
}
