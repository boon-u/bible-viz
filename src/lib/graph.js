import { refLabelOf } from "./refs";
import { readStatsForAnchor } from "./aggregate";
import { noteAnchor } from "./notes";

// Build a force-graph { nodes, links } from notes + reads.
//   node types: 'note' | 'topic' | 'passage'
//   links:      note→anchor passage, note→cross-ref passage, note→topic(tag)
// Passage nodes carry `reads` (how often that passage was read) so the graph
// view can size/brighten them — tying the notebook to the reading tracker.
// Returns fresh plain objects every call (react-force-graph mutates link
// endpoints in place, so callers must not reuse a previous result).
export function buildGraph(notes, reads, { bookFilter = "all" } = {}) {
  const nodes = new Map();
  const links = [];

  const ensurePassage = (r) => {
    if (!r.book) return null;
    const id = `psg:${refLabelOf(r)}`;
    if (!nodes.has(id)) {
      const stats = readStatsForAnchor(reads, r);
      nodes.set(id, {
        id,
        type: "passage",
        label: refLabelOf(r),
        book: r.book,
        reads: stats.events,
        degree: 0,
      });
    }
    return id;
  };

  const ensureTopic = (t) => {
    const id = `topic:${t}`;
    if (!nodes.has(id)) nodes.set(id, { id, type: "topic", label: t, degree: 0 });
    return id;
  };

  for (const n of notes) {
    const noteId = `note:${n.id}`;
    nodes.set(noteId, {
      id: noteId,
      type: "note",
      label: n.title,
      noteId: n.id,
      category: n.category,
      book: n.book,
      degree: 0,
    });
    const anchor = noteAnchor(n);
    if (anchor.book) {
      const pk = ensurePassage(anchor);
      if (pk) links.push({ source: noteId, target: pk, kind: "anchor" });
    }
    for (const r of n.refs) {
      const pk = ensurePassage(r);
      if (pk) links.push({ source: noteId, target: pk, kind: "xref" });
    }
    for (const t of n.tags) links.push({ source: noteId, target: ensureTopic(t), kind: "topic" });
  }

  for (const l of links) {
    nodes.get(l.source).degree++;
    nodes.get(l.target).degree++;
  }

  let result = { nodes: [...nodes.values()], links };
  if (bookFilter && bookFilter !== "all") result = filterByBook(result, bookFilter);
  return result;
}

// Keep everything connected to one book: its passage nodes, notes anchored to or
// referencing them, and topics on those notes.
function filterByBook(graph, book) {
  const keep = new Set();
  for (const n of graph.nodes) if (n.type === "passage" && n.book === book) keep.add(n.id);
  // notes linked to a kept passage
  for (const l of graph.links) {
    if (keep.has(l.target) && l.source.startsWith("note:")) keep.add(l.source);
  }
  // topics on kept notes
  for (const l of graph.links) {
    if (l.kind === "topic" && keep.has(l.source)) keep.add(l.target);
  }
  const nodes = graph.nodes.filter((n) => keep.has(n.id));
  const links = graph.links.filter((l) => keep.has(l.source) && keep.has(l.target));
  return { nodes, links };
}
