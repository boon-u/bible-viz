import { motion } from "framer-motion";
import { BIBLE_BOOKS } from "../../data/bibleBooks";
import { toGlobalIndex } from "../../game/canon";

export function BibleTimeline({ round, showTarget, feedback }) {
  const { activeIndices, low, high, currentIndex, targetIndex, mode } = round;
  const activeSet = new Set(activeIndices);
  const currentGlobal = toGlobalIndex(activeIndices, currentIndex);
  const targetGlobal = toGlobalIndex(activeIndices, targetIndex);
  const lowGlobal = toGlobalIndex(activeIndices, low);
  const highGlobal = toGlobalIndex(activeIndices, high);

  const showOtNtLabels = mode === "all";

  return (
    <div className="timeline-wrapper">
      {showOtNtLabels && (
        <div className="timeline-labels">
          <span className="timeline-label">Old Testament</span>
          <span className="timeline-label">New Testament</span>
        </div>
      )}

      <motion.div
        className={`timeline ${feedback ?? ""}`}
        animate={
          feedback === "wrong"
            ? { x: [0, -8, 8, -6, 6, 0] }
            : feedback === "correct"
              ? { scale: [1, 1.02, 1] }
              : {}
        }
        transition={{ duration: 0.4 }}
      >
        {BIBLE_BOOKS.map((book, i) => {
          const inCanon = activeSet.has(i);
          const inRange = inCanon && i >= lowGlobal && i <= highGlobal;
          const isCurrent = i === currentGlobal;
          const isTarget = i === targetGlobal;

          return (
            <motion.div
              key={book.name}
              className={[
                "timeline-segment",
                book.testament.toLowerCase(),
                !inCanon ? "outside-canon" : inRange ? "in-range" : "out-of-range",
                isCurrent ? "current" : "",
                isTarget && showTarget ? "target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--book-color": book.color }}
              title={book.name}
              initial={false}
              animate={{
                opacity: !inCanon ? 0.08 : inRange ? 1 : 0.15,
                scale: isCurrent ? 1.8 : isTarget && showTarget ? 1.4 : 1,
                y: isCurrent ? -6 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            />
          );
        })}

        <motion.div
          className="timeline-cursor"
          layout
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            left: `${((currentGlobal + 0.5) / BIBLE_BOOKS.length) * 100}%`,
          }}
        >
          <span className="cursor-emoji">📖</span>
        </motion.div>
      </motion.div>

      <div className="timeline-range">
        <motion.span
          key={`${low}-${high}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Searching books {low + 1}–{high + 1} of {activeIndices.length}
        </motion.span>
      </div>
    </div>
  );
}
