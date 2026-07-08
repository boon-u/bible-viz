// Highlighting helpers (range-based). A highlight spans a range within a chapter:
//   anchor = { startVerse, startOffset, endVerse, endOffset }
// Verse text is rendered inside a `.rd-vtext` container (data-ch, data-v);
// offsets are character offsets into the verse's plain text.

// Curated, calm palette (aesthetic "study" vibe, readable over the paper surface).
export const HIGHLIGHT_COLORS = [
  { name: "amber", value: "#e9b949" },
  { name: "sage", value: "#7fb685" },
  { name: "sky", value: "#6ba7e0" },
  { name: "rose", value: "#e08aa8" },
  { name: "lilac", value: "#a692d6" },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));

// --- selection → range(s) ----------------------------------------------
export function offsetInContainer(container, node, nodeOffset) {
  if (node.nodeType !== Node.TEXT_NODE) {
    let count = 0;
    for (let i = 0; i < nodeOffset && i < node.childNodes.length; i++) {
      count += node.childNodes[i].textContent.length;
    }
    return textBefore(container, node) + count;
  }
  return textBefore(container, node) + nodeOffset;
}
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

// Turn the current selection into one range per chapter it covers.
// Returns [{ chapter, startVerse, startOffset, endVerse, endOffset }].
export function selectionToRanges(sel, verseEls) {
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return [];
  const range = sel.getRangeAt(0);
  const byChapter = new Map();
  for (const el of verseEls) {
    if (!range.intersectsNode(el)) continue;
    const len = el.textContent.length;
    const elRange = document.createRange();
    elRange.selectNodeContents(el);

    let s;
    if (range.compareBoundaryPoints(Range.START_TO_START, elRange) <= 0) {
      s = 0;
    } else if (range.compareBoundaryPoints(Range.END_TO_START, elRange) >= 0) {
      s = len;
    } else {
      s = offsetInContainer(el, range.startContainer, range.startOffset);
    }

    let e;
    if (range.compareBoundaryPoints(Range.END_TO_END, elRange) >= 0) {
      e = len;
    } else if (range.compareBoundaryPoints(Range.START_TO_END, elRange) <= 0) {
      e = 0;
    } else {
      e = offsetInContainer(el, range.endContainer, range.endOffset);
    }

    if (e <= s) continue;
    const ch = Number(el.dataset.ch);
    if (!byChapter.has(ch)) byChapter.set(ch, []);
    byChapter.get(ch).push({ v: Number(el.dataset.v), s, e });
  }
  const out = [];
  for (const [chapter, verses] of byChapter) {
    verses.sort((a, b) => a.v - b.v);
    const first = verses[0];
    const last = verses[verses.length - 1];
    out.push({
      chapter,
      startVerse: first.v,
      startOffset: first.s,
      endVerse: last.v,
      endOffset: last.e,
    });
  }
  return out;
}

// --- fill rendering (inline, blends overlaps) --------------------------
// The [s,e] a fill highlight covers within one verse.
export function fillIntervalsForVerse(fillHls, verse, textLen) {
  const out = [];
  for (const a of fillHls) {
    const an = a.anchor;
    if (verse < an.startVerse || verse > an.endVerse) continue;
    const s = verse === an.startVerse ? an.startOffset : 0;
    const e = verse === an.endVerse ? an.endOffset : textLen;
    if (e > s) out.push({ id: a.id, color: a.color, s, e });
  }
  return out;
}

// Split verse text into segments given fill intervals; each segment lists the
// highlights covering it (so overlaps can blend). Returns [{text, hls|null}].
export function segmentVerseFill(text, intervals) {
  if (!intervals || intervals.length === 0) return [{ text, hls: null }];
  const len = text.length;
  const points = new Set([0, len]);
  for (const i of intervals) {
    points.add(clamp(i.s, 0, len));
    points.add(clamp(i.e, 0, len));
  }
  const cuts = [...points].sort((a, b) => a - b);
  const segs = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const s = cuts[k];
    const e = cuts[k + 1];
    if (s >= e) continue;
    const covering = intervals.filter((i) => i.s <= s && i.e >= e);
    const key = covering.map((c) => c.id).join(",");
    const piece = text.slice(s, e);
    const prev = segs[segs.length - 1];
    if (prev && prev.key === key) prev.text += piece;
    else
      segs.push({
        text: piece,
        key,
        hls: covering.length ? covering.map((c) => ({ id: c.id, color: c.color })) : null,
      });
  }
  return segs;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

// Background for a fill segment: translucent single color, or a blended average
// of several overlapping colors (kept clean).
export function blendFill(colors) {
  if (colors.length === 1) return `color-mix(in srgb, ${colors[0]} 42%, transparent)`;
  const rgbs = colors.map(hexToRgb);
  const n = rgbs.length;
  const avg = rgbs.reduce((a, c) => ({ r: a.r + c.r, g: a.g + c.g, b: a.b + c.b }), { r: 0, g: 0, b: 0 });
  return `rgba(${Math.round(avg.r / n)}, ${Math.round(avg.g / n)}, ${Math.round(avg.b / n)}, 0.5)`;
}

// --- scribble geometry --------------------------------------------------
function nodePosAt(container, offset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let count = 0;
  let n;
  while ((n = walker.nextNode())) {
    const l = n.textContent.length;
    if (count + l >= offset) return { node: n, offset: offset - count };
    count += l;
  }
  return { node: container, offset: container.childNodes.length };
}

// Rebuild a DOM Range for a stored highlight so the scribble overlay can read its
// on-screen rects. Returns a Range or null if the verses aren't rendered.
export function rangeToDomRange(root, chapter, anchor) {
  const q = (v) => root.querySelector(`.rd-vtext[data-ch="${chapter}"][data-v="${v}"]`);
  const startEl = q(anchor.startVerse);
  const endEl = q(anchor.endVerse);
  if (!startEl || !endEl) return null;
  const sp = nodePosAt(startEl, anchor.startOffset);
  const ep = nodePosAt(endEl, anchor.endOffset);
  const r = document.createRange();
  try {
    r.setStart(sp.node, sp.offset);
    r.setEnd(ep.node, ep.offset);
  } catch {
    return null;
  }
  return r;
}
