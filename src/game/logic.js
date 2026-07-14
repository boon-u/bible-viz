import { BIBLE_BOOKS } from "../data/bibleBooks";
import { getActiveIndices, toGlobalIndex } from "./canon";

// Bible Blitz round logic: pick a start and target book, then narrow a
// binary-search range by choosing "earlier" (left) or "later" (right).

export const SCORE = {
  CORRECT_MOVE: 25,
  WRONG_PENALTY: 15,
  ROUND_COMPLETE: 50,
  PERFECT_BONUS: 30,
  STREAK_BONUS: 5,
};

export function globalBook(localIndex, state) {
  return BIBLE_BOOKS[toGlobalIndex(state.activeIndices, localIndex)];
}

export function optimalMoves(start, target, bookCount) {
  if (start === target) return 0;
  let low = 0;
  let high = bookCount - 1;
  let current = start;
  let moves = 0;

  while (current !== target && moves < 20) {
    if (target < current) {
      high = current - 1;
    } else {
      low = current + 1;
    }
    if (low > high) break;
    current = Math.floor((low + high) / 2);
    moves++;
  }

  return moves;
}

export function createRound(mode) {
  const activeIndices = getActiveIndices(mode);
  const bookCount = activeIndices.length;

  let start = Math.floor(Math.random() * bookCount);
  let target = Math.floor(Math.random() * bookCount);

  while (target === start) {
    target = Math.floor(Math.random() * bookCount);
  }

  let attempts = 0;
  while (optimalMoves(start, target, bookCount) < 3 && attempts < 30) {
    start = Math.floor(Math.random() * bookCount);
    target = Math.floor(Math.random() * bookCount);
    while (target === start) {
      target = Math.floor(Math.random() * bookCount);
    }
    attempts++;
  }

  return {
    mode,
    activeIndices,
    startIndex: start,
    targetIndex: target,
    currentIndex: start,
    low: 0,
    high: bookCount - 1,
    moves: 0,
    correctMoves: 0,
    wrongMoves: 0,
    roundScore: 0,
    streak: 0,
    startedAt: Date.now(),
    finished: false,
    failed: false,
    lastFeedback: null,
  };
}

export function canGoLeft(state) {
  return state.currentIndex > state.low;
}

export function canGoRight(state) {
  return state.currentIndex < state.high;
}

export function isTargetInRange(state) {
  return state.targetIndex >= state.low && state.targetIndex <= state.high;
}

export function isStuck(state) {
  if (state.finished) return false;
  if (!isTargetInRange(state)) return true;
  return state.low === state.high && state.currentIndex !== state.targetIndex;
}

export function isCorrectDirection(current, target, direction) {
  if (target < current) return direction === "left";
  if (target > current) return direction === "right";
  return true;
}

export function applyMove(state, direction) {
  if (state.finished) return state;

  const correct = isCorrectDirection(state.currentIndex, state.targetIndex, direction);

  let { low, high, currentIndex } = state;
  let roundScore = state.roundScore;
  let streak = state.streak;
  let correctMoves = state.correctMoves;
  let wrongMoves = state.wrongMoves;

  if (correct) {
    roundScore += SCORE.CORRECT_MOVE + streak * SCORE.STREAK_BONUS;
    streak += 1;
    correctMoves += 1;
  } else {
    roundScore = Math.max(0, roundScore - SCORE.WRONG_PENALTY);
    streak = 0;
    wrongMoves += 1;
  }

  const navLow = direction === "left" ? low : currentIndex + 1;
  const navHigh = direction === "left" ? currentIndex - 1 : high;

  if (correct) {
    if (direction === "left") {
      high = currentIndex - 1;
    } else {
      low = currentIndex + 1;
    }
  }

  let finished = false;
  let failed = false;

  if (navLow <= navHigh) {
    currentIndex = Math.floor((navLow + navHigh) / 2);

    if (currentIndex === state.targetIndex) {
      finished = true;
      roundScore += SCORE.ROUND_COMPLETE;
      const optimal = optimalMoves(
        state.startIndex,
        state.targetIndex,
        state.activeIndices.length,
      );
      if (wrongMoves === 0 && state.moves + 1 <= optimal + 1) {
        roundScore += SCORE.PERFECT_BONUS;
      }
    } else {
      const nextState = {
        ...state,
        low,
        high,
        currentIndex,
      };
      if (isStuck(nextState) || !isTargetInRange(nextState)) {
        finished = true;
        failed = true;
      }
    }
  } else {
    finished = true;
    failed = true;
  }

  return {
    ...state,
    low,
    high,
    currentIndex,
    moves: state.moves + 1,
    correctMoves,
    wrongMoves,
    roundScore,
    streak,
    finished,
    failed,
    lastFeedback: correct ? "correct" : "wrong",
  };
}

export function timeBonus(elapsedMs) {
  const seconds = elapsedMs / 1000;
  return Math.max(0, Math.round(300 - seconds * 8));
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${seconds}.${tenths}s`;
}

export const HIGH_SCORE_KEY = "bible-blitz-highscore";

export function getHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  try {
    const current = getHighScore();
    if (score > current) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    }
  } catch {
    // ignore
  }
}
