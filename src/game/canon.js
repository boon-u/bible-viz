import { BIBLE_BOOKS } from "../data/bibleBooks";

// A "canon mode" is which slice of the 66 books a round draws from:
// 'all' (whole Bible), 'ot' (Old Testament), or 'nt' (New Testament).

export function getActiveIndices(mode) {
  return BIBLE_BOOKS.reduce((acc, book, index) => {
    if (mode === "all") acc.push(index);
    else if (mode === "ot" && book.testament === "OT") acc.push(index);
    else if (mode === "nt" && book.testament === "NT") acc.push(index);
    return acc;
  }, []);
}

export function toGlobalIndex(activeIndices, localIndex) {
  return activeIndices[localIndex];
}

export function modeLabel(mode) {
  switch (mode) {
    case "ot":
      return "Old Testament";
    case "nt":
      return "New Testament";
    default:
      return "Whole Bible";
  }
}

export function modeShortLabel(mode) {
  switch (mode) {
    case "ot":
      return "OT";
    case "nt":
      return "NT";
    default:
      return "All 66";
  }
}

export function modeDescription(mode) {
  const count = getActiveIndices(mode).length;
  return `${modeLabel(mode)} · ${count} books`;
}
