import { HIGHLIGHT_COLORS } from "../lib/highlight";

// Floating picker shown at a text selection: choose a color; toggle Fill/Scribble.
// Picking a color creates the highlight in the current style.
export default function SelectionPopover({ pos, style, onStyle, onPick, onClose }) {
  return (
    <div
      className="sel-popover"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection alive
    >
      <div className="sel-styles">
        <button
          className={`sel-style${style === "fill" ? " active" : ""}`}
          onClick={() => onStyle("fill")}
          title="Highlighter"
        >
          ▬ Fill
        </button>
        <button
          className={`sel-style${style === "scribble" ? " active" : ""}`}
          onClick={() => onStyle("scribble")}
          title="Hand-drawn outline"
        >
          ◯ Scribble
        </button>
      </div>
      <div className="sel-colors">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.name}
            className="sel-color"
            style={{ background: c.value }}
            title={c.name}
            onClick={() => onPick(c.value)}
          />
        ))}
        <button className="sel-close" title="Cancel" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
