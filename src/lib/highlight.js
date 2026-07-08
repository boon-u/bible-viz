// Helpers for word/phrase + verse highlighting in the reader.
//
// Verse text is rendered inside a `.rd-vtext` container (data-ch, data-v).
// Highlights are stored as character offsets into the verse's plain text
// ({verse, start, end}); a whole-verse highlight is start:0..end:length.

export const HIGHLIGHT_COLORS = [
  { name: "yellow", value: "#f2c14e" },
  { name: "green", value: "#5bbf7b" },
  { name: "blue", value: "#5b9bf2" },
  { name: "pink", value: "#e879b9" },
  { name: "orange", value: "#f08a4b" },
];

// Char offset of (node, nodeOffset) within `container`'s plain text.
export function offsetInContainer(container, node, nodeOffset) {
  // Endpoint landing on an element: sum text length of its first children.
  if (node.nodeType !== Node.TEXT_NODE) {
    let count = 0;
    for (let i = 0; i < nodeOffset && i < node.childNodes.length; i++) {
      count += node.childNodes[i].textContent.length;
    }
    // then add offset of `node` itself within the container
    return textBefore(container, node) + count;
  }
  return textBefore(container, node) + nodeOffset;
}

// Total text length of everything before `node` within `container`.
function textBefore(container, node) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let count = 0;
  let n;
  while ((n = walker.nextNode())) {
    if (n === node || node.contains?.(n)) return count;
    count += n.textContent.length;
  }
  return count;
}

// Given the current selection and the verse elements on screen, return the
// per-verse covered ranges: [{ chapter, verse, start, end }]. Handles selections
// that span multiple verses by clamping to each.
export function selectionToHighlights(sel, verseEls) {
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return [];
  const range = sel.getRangeAt(0);
  const out = [];
  for (const el of verseEls) {
    if (!range.intersectsNode(el)) continue;
    const len = el.textContent.length;
    const elRange = document.createRange();
    elRange.selectNodeContents(el);
    const startsBefore = range.compareBoundaryPoints(Range.START_TO_START, elRange) <= 0;
    const endsAfter = range.compareBoundaryPoints(Range.END_TO_END, elRange) >= 0;
    const start = startsBefore ? 0 : offsetInContainer(el, range.startContainer, range.startOffset);
    const end = endsAfter ? len : offsetInContainer(el, range.endContainer, range.endOffset);
    if (end > start) {
      out.push({ chapter: Number(el.dataset.ch), verse: Number(el.dataset.v), start, end });
    }
  }
  return out;
}

// Split verse text into segments given its highlights (may overlap; topmost wins).
// Returns [{ text, hl: {id,color}|null }].
export function segmentVerse(text, highlights) {
  if (!highlights || highlights.length === 0) return [{ text, hl: null }];
  const len = text.length;
  const points = new Set([0, len]);
  for (const h of highlights) {
    points.add(Math.max(0, Math.min(h.start, len)));
    points.add(Math.max(0, Math.min(h.end, len)));
  }
  const cuts = [...points].sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s = cuts[i];
    const e = cuts[i + 1];
    if (s >= e) continue;
    let cover = null;
    for (const h of highlights) if (h.start <= s && h.end >= e) cover = h; // last wins
    const piece = text.slice(s, e);
    const prev = segs[segs.length - 1];
    if (prev && (prev.hl?.id ?? null) === (cover?.id ?? null)) prev.text += piece;
    else segs.push({ text: piece, hl: cover ? { id: cover.id, color: cover.color } : null });
  }
  return segs;
}
