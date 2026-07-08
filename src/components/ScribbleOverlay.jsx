import { useCallback, useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { rangeToDomRange } from "../lib/highlight";

// Stable per-highlight seed so redraws look identical.
function seedOf(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// SVG layer over the reader text that draws hand-drawn (rough.js) outlines for
// scribble-style highlights, following the on-screen text rects. Pointer-events
// off so clicks fall through to the text (the reader hit-tests highlight clicks).
export default function ScribbleOverlay({ containerRef, scribbles, revision }) {
  const svgRef = useRef();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const draw = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;
    setSize({ w: container.clientWidth, h: container.clientHeight });
    const cRect = container.getBoundingClientRect();
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);

    for (const s of scribbles) {
      const range = rangeToDomRange(container, s.chapter, s.anchor);
      if (!range) continue;
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      const singleWord = rects.length === 1 && rects[0].width < rects[0].height * 3.2;
      rects.forEach((r, i) => {
        const x = r.left - cRect.left;
        const y = r.top - cRect.top;
        const pad = 3;
        const opts = {
          stroke: s.color,
          roughness: 1.7,
          strokeWidth: 2,
          seed: seedOf(s.id) + i,
        };
        const node = singleWord
          ? rc.ellipse(x + r.width / 2, y + r.height / 2, r.width + pad * 5, r.height + pad * 2.5, opts)
          : rc.rectangle(x - pad, y - pad, r.width + pad * 2, r.height + pad * 2, opts);
        svg.appendChild(node);
      });
    }
  }, [containerRef, scribbles]);

  // Redraw on mount, when scribbles change, and when the text/layout changes.
  useEffect(() => {
    draw();
  }, [draw, revision]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    window.addEventListener("resize", draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [containerRef, draw]);

  return (
    <svg
      ref={svgRef}
      className="scribble-overlay"
      width={size.w}
      height={size.h}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    />
  );
}
