import { motion, AnimatePresence } from "framer-motion";
import { modeShortLabel } from "../../game/canon";
import { canGoLeft, canGoRight, formatTime, globalBook } from "../../game/logic";

export function GameBoard({ round, elapsedMs, totalScore, highScore, onChoose, disabled }) {
  const currentBook = globalBook(round.currentIndex, round);
  const targetBook = globalBook(round.targetIndex, round);
  const leftEnabled = canGoLeft(round);
  const rightEnabled = canGoRight(round);

  const leftBook =
    leftEnabled && round.low <= round.currentIndex - 1
      ? globalBook(Math.floor((round.low + round.currentIndex - 1) / 2), round)
      : null;
  const rightBook =
    rightEnabled && round.currentIndex + 1 <= round.high
      ? globalBook(Math.floor((round.currentIndex + 1 + round.high) / 2), round)
      : null;

  return (
    <div className="game-board">
      <header className="hud">
        <div className="hud-item">
          <span className="hud-label">Score</span>
          <motion.span
            key={totalScore}
            className="hud-value score"
            initial={{ scale: 1.3, color: "#ffd166" }}
            animate={{ scale: 1, color: "#2d3436" }}
          >
            {totalScore}
          </motion.span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Time</span>
          <span className="hud-value timer">{formatTime(elapsedMs)}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Best</span>
          <span className="hud-value">{highScore}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Mode</span>
          <span className="hud-value mode-tag">{modeShortLabel(round.mode)}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Streak</span>
          <motion.span
            key={round.streak}
            className="hud-value streak"
            animate={{ scale: [1, 1.2, 1] }}
          >
            {round.streak > 0 ? `🔥 ${round.streak}` : "—"}
          </motion.span>
        </div>
      </header>

      <motion.div
        className="quest-card"
        animate={
          round.lastFeedback === "wrong"
            ? { rotate: [0, -2, 2, 0] }
            : round.lastFeedback === "correct"
              ? { y: [0, -4, 0] }
              : {}
        }
      >
        <p className="quest-eyebrow">Navigate to your target</p>
        <div className="quest-row">
          <div className="quest-block from">
            <span className="quest-tag">You are here</span>
            <motion.h2
              key={currentBook.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {currentBook.name}
            </motion.h2>
            <span className="quest-meta">
              #{round.currentIndex + 1} · {currentBook.section}
            </span>
          </div>

          <motion.div
            className="quest-arrow"
            animate={{ x: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            ➜
          </motion.div>

          <div className="quest-block to">
            <span className="quest-tag target-tag">Find this book</span>
            <h2>{targetBook.name}</h2>
            <span className="quest-meta">
              #{round.targetIndex + 1} · {targetBook.section}
            </span>
          </div>
        </div>

        <p className="quest-hint">
          Is <strong>{targetBook.name}</strong> earlier or later in the Bible than{" "}
          <strong>{currentBook.name}</strong>?
        </p>
        <p className="keyboard-hint">Use ← Earlier · Later →</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {round.lastFeedback && (
          <motion.div
            key={round.lastFeedback + round.moves}
            className={`feedback-banner ${round.lastFeedback}`}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {round.lastFeedback === "correct"
              ? "✨ Perfect direction!"
              : "😅 Wrong way — points deducted"}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="direction-controls">
        <motion.button
          type="button"
          className="dir-btn left"
          disabled={disabled || !leftEnabled}
          onClick={() => onChoose("left")}
          whileHover={{ scale: 1.03, x: -4 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="dir-icon">←</span>
          <span className="dir-label">Earlier</span>
          <span className="dir-sublabel">Go Left</span>
          {leftBook && <span className="dir-preview">toward {leftBook.abbr}</span>}
        </motion.button>

        <motion.button
          type="button"
          className="dir-btn right"
          disabled={disabled || !rightEnabled}
          onClick={() => onChoose("right")}
          whileHover={{ scale: 1.03, x: 4 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="dir-icon">→</span>
          <span className="dir-label">Later</span>
          <span className="dir-sublabel">Go Right</span>
          {rightBook && <span className="dir-preview">toward {rightBook.abbr}</span>}
        </motion.button>
      </div>

      <div className="move-stats">
        <span>Moves: {round.moves}</span>
        <span className="dot">·</span>
        <span className="correct-stat">✓ {round.correctMoves}</span>
        <span className="dot">·</span>
        <span className="wrong-stat">✗ {round.wrongMoves}</span>
      </div>
    </div>
  );
}
