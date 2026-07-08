import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { buildGraph } from "../lib/graph";
import { parseRef } from "../lib/refs";

const nid = (x) => (typeof x === "object" && x ? x.id : x);

// Read theme colors off the CSS custom properties so the graph matches
// light/dark. Re-read whenever `theme` changes.
function readPalette() {
  const s = getComputedStyle(document.documentElement);
  const v = (name, fallback) => s.getPropertyValue(name).trim() || fallback;
  return {
    note: v("--accent", "#4f8ef7"),
    topic: v("--accent-2", "#22c55e"),
    passageWarm: ["#5c6778", "#3b82f6", "#22c55e", "#a3e635", "#facc15", "#fb923c", "#f43f5e"],
    text: v("--text", "#e6e9ef"),
    muted: v("--muted", "#8a93a3"),
    link: v("--border", "#262f3d"),
  };
}

const radiusOf = (n) => {
  if (n.type === "note") return Math.min(4 + n.degree * 0.5, 11);
  if (n.type === "topic") return Math.min(4 + n.degree * 0.7, 13);
  return Math.min(3.5 + (n.reads ?? 0) * 0.7 + n.degree * 0.3, 12); // passage
};

export default function GraphView({ notes, reads, theme, onOpenNote, onOpenRef, onOpenTopic }) {
  const wrapRef = useRef();
  const fgRef = useRef();
  const [dims, setDims] = useState({ width: 800, height: 560 });
  const [bookFilter, setBookFilter] = useState("all");
  const [hover, setHover] = useState(null);
  const palette = useMemo(() => readPalette(), [theme]);

  const books = useMemo(
    () => [...new Set(notes.flatMap((n) => [n.book, ...n.refs.map((r) => r.book)]).filter(Boolean))].sort(),
    [notes],
  );

  const graphData = useMemo(
    () => buildGraph(notes, reads, { bookFilter }),
    [notes, reads, bookFilter],
  );

  // adjacency for hover highlighting (ids as strings, tolerant of mutation)
  const adj = useMemo(() => {
    const m = new Map();
    for (const n of graphData.nodes) m.set(n.id, new Set());
    for (const l of graphData.links) {
      const a = nid(l.source);
      const b = nid(l.target);
      m.get(a)?.add(b);
      m.get(b)?.add(a);
    }
    return m;
  }, [graphData]);

  const colorOf = (n) => {
    if (n.type === "note") return palette.note;
    if (n.type === "topic") return palette.topic;
    const tier = Math.min(n.reads ?? 0, palette.passageWarm.length - 1);
    return palette.passageWarm[tier];
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Fall back to the window / a default when the container measures 0 (first
    // paint, or headless environments that don't report a viewport width) so the
    // canvas never renders at zero size.
    const measure = () => {
      const width = el.clientWidth || window.innerWidth || 800;
      const height = el.clientHeight || Math.max(window.innerHeight - 210, 420) || 520;
      setDims({ width, height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const isDim = (nodeId) => hover && hover !== nodeId && !adj.get(hover)?.has(nodeId);

  const paintNode = (node, ctx, scale) => {
    const r = radiusOf(node);
    const dim = isDim(node.id);
    const color = colorOf(node);
    ctx.globalAlpha = dim ? 0.12 : 1;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = dim ? 0 : node.id === hover ? 22 : 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    const showLabel =
      !dim && (node.id === hover || scale > 1.5 || node.type === "topic" || node.degree >= 4);
    if (showLabel) {
      const label = node.type === "note" && node.label.length > 26
        ? node.label.slice(0, 25) + "…"
        : node.label;
      ctx.font = `${node.id === hover ? 700 : 400} ${11 / scale}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = node.id === hover ? palette.text : palette.muted;
      ctx.fillText(label, node.x, node.y + r + 1.5 / scale);
    }
    ctx.globalAlpha = 1;
  };

  const paintPointer = (node, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radiusOf(node) + 2, 0, 2 * Math.PI);
    ctx.fill();
  };

  const onNodeClick = (node) => {
    if (node.type === "note") onOpenNote?.(node.noteId);
    else if (node.type === "passage") onOpenRef?.(parseRef(node.label));
    else if (node.type === "topic") onOpenTopic?.(node.label);
  };

  return (
    <main className="page graphview">
      <div className="graph-toolbar">
        <div className="graph-legend">
          <span className="glegend"><span className="gdot" style={{ background: palette.note }} /> note</span>
          <span className="glegend"><span className="gdot" style={{ background: palette.topic }} /> topic</span>
          <span className="glegend"><span className="gdot" style={{ background: palette.passageWarm[3] }} /> passage <em>(brighter = read more)</em></span>
        </div>
        <select value={bookFilter} onChange={(e) => setBookFilter(e.target.value)}>
          <option value="all">Whole map</option>
          {books.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <p className="section-hint">
        Hover a node to light up its connections. Click a note to read it, a passage
        to open the heatmap, or a topic to browse it.
      </p>

      <div className="graph-wrap" ref={wrapRef}>
        {graphData.nodes.length === 0 ? (
          <div className="empty-hint">No notes to map yet. Import some to see the web of connections.</div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={dims.width}
            height={dims.height}
            graphData={graphData}
            backgroundColor="transparent"
            cooldownTime={4000}
            d3VelocityDecay={0.35}
            nodeRelSize={5}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={paintPointer}
            linkColor={(l) =>
              hover && !(nid(l.source) === hover || nid(l.target) === hover)
                ? "rgba(120,130,150,0.06)"
                : palette.link
            }
            linkWidth={(l) => (hover && (nid(l.source) === hover || nid(l.target) === hover) ? 1.5 : 0.6)}
            onNodeHover={(node) => setHover(node ? node.id : null)}
            onNodeClick={onNodeClick}
            onEngineStop={() => fgRef.current?.zoomToFit(400, 40)}
          />
        )}
      </div>
    </main>
  );
}
