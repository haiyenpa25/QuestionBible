import { isTextAnswerMatch } from './normalize.js';

export interface ScoreCalculationInput {
  isCorrect: boolean;
  elapsedMs: number;
  durationMs: number;
  pointsFactor: number; // 0 = không tính điểm, 1 = chuẩn, 2 = gấp đôi
  currentStreak: number; // streak trước câu này
  speedScoring?: boolean; // mặc định true; false = chế độ thiếu nhi (đúng = 1000 * hệ_số)
  streakEnabled?: boolean; // mặc định true
  partialRatio?: number; // 0..1 dùng cho câu sắp xếp chấm từng phần
  isPoll?: boolean; // câu thăm dò ý kiến không cộng điểm và không thay đổi streak (lỗi #15)
}

export interface ScoreCalculationResult {
  points: number;
  basePoints: number;
  streakBonus: number;
  newStreak: number;
}

/**
 * Công thức tính điểm theo mục 9 của phuong-an.md & đã sửa lỗi #15, #16 trong roadmaps.md
 */
export function calculateQuestionScore(input: ScoreCalculationInput): ScoreCalculationResult {
  const {
    isCorrect,
    elapsedMs,
    durationMs,
    pointsFactor,
    currentStreak,
    speedScoring = true,
    streakEnabled = true,
    partialRatio = 1,
    isPoll = false
  } = input;

  // Lỗi #15: Câu thăm dò (poll) luôn 0 điểm và giữ nguyên streak
  if (isPoll) {
    return {
      points: 0,
      basePoints: 0,
      streakBonus: 0,
      newStreak: currentStreak
    };
  }

  if (!isCorrect || partialRatio <= 0) {
    return {
      points: 0,
      basePoints: 0,
      streakBonus: 0,
      newStreak: 0
    };
  }

  // Lỗi #16: Chỉ tăng streak khi đúng hoàn toàn (partialRatio === 1)
  const isFullCorrect = partialRatio >= 1;
  const newStreak = isFullCorrect ? currentStreak + 1 : currentStreak;

  if (pointsFactor === 0) {
    return {
      points: 0,
      basePoints: 0,
      streakBonus: 0,
      newStreak
    };
  }

  const safeDuration = Math.max(durationMs, 1000);
  const timeRatio = Math.min(Math.max(elapsedMs / safeDuration, 0), 1);

  const rawBase = speedScoring
    ? (1 - timeRatio / 2) * 1000 * pointsFactor
    : 1000 * pointsFactor;

  const basePoints = Math.round(rawBase * partialRatio);
  const streakBonus =
    streakEnabled && isFullCorrect
      ? Math.min(Math.max(newStreak - 1, 0), 5) * 100
      : 0;

  return {
    points: basePoints + streakBonus,
    basePoints,
    streakBonus,
    newStreak
  };
}

export interface EvaluateAnswerQuestion {
  type: 'quiz' | 'true_false' | 'type_answer' | 'order' | 'slider' | 'poll';
  options: Array<{
    position: number;
    content: string;
    isCorrect: boolean;
  }>;
  sliderMin?: number | null;
  sliderMax?: number | null;
  sliderAnswer?: number | null;
  sliderTolerance?: number | null;
}

export interface PlayerSubmittedAnswer {
  choice?: number | number[];
  text?: string;
  order?: number[];
  value?: number;
}

export function evaluateSubmittedAnswer(
  question: EvaluateAnswerQuestion,
  submitted: PlayerSubmittedAnswer,
  partialOrderScoring = false
): { isCorrect: boolean; partialRatio: number; isPoll?: boolean } {
  switch (question.type) {
    case 'poll': {
      const hasChoice =
        typeof submitted.choice === 'number' &&
        submitted.choice >= 0 &&
        submitted.choice < question.options.length;
      return { isCorrect: hasChoice, partialRatio: 0, isPoll: true };
    }

    case 'quiz':
    case 'true_false': {
      const correctPositions = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.position);

      if (typeof submitted.choice === 'number') {
        const isCorrect = correctPositions.includes(submitted.choice);
        return { isCorrect, partialRatio: isCorrect ? 1 : 0 };
      }

      if (Array.isArray(submitted.choice) && submitted.choice.length > 0) {
        const chosenSet = new Set(submitted.choice);
        const allCorrect =
          chosenSet.size === correctPositions.length &&
          correctPositions.every((pos) => chosenSet.has(pos));
        return { isCorrect: allCorrect, partialRatio: allCorrect ? 1 : 0 };
      }

      return { isCorrect: false, partialRatio: 0 };
    }

    case 'type_answer': {
      const accepted = question.options.map((o) => o.content);
      const isCorrect = isTextAnswerMatch(submitted.text ?? '', accepted);
      return { isCorrect, partialRatio: isCorrect ? 1 : 0 };
    }

    case 'order': {
      if (!Array.isArray(submitted.order) || submitted.order.length !== question.options.length) {
        return { isCorrect: false, partialRatio: 0 };
      }
      const expectedOrder = [...question.options]
        .sort((a, b) => a.position - b.position)
        .map((o) => o.position);

      let matchedCount = 0;
      for (let i = 0; i < expectedOrder.length; i++) {
        if (submitted.order[i] === expectedOrder[i]) {
          matchedCount++;
        }
      }

      const exact = matchedCount === expectedOrder.length;
      if (exact) {
        return { isCorrect: true, partialRatio: 1 };
      }
      // Lỗi #16: Chấm từng phần chỉ tính khi đúng >= 50% vị trí
      const ratio = matchedCount / expectedOrder.length;
      if (partialOrderScoring && ratio >= 0.5) {
        return {
          isCorrect: true,
          partialRatio: ratio
        };
      }
      return { isCorrect: false, partialRatio: 0 };
    }

    case 'slider': {
      if (typeof submitted.value !== 'number' || typeof question.sliderAnswer !== 'number') {
        return { isCorrect: false, partialRatio: 0 };
      }
      const tolerance = question.sliderTolerance ?? 0;
      const diff = Math.abs(submitted.value - question.sliderAnswer);
      const isCorrect = diff <= tolerance;
      return { isCorrect: !Number.isNaN(diff) && isCorrect, partialRatio: isCorrect ? 1 : 0 };
    }

    default:
      return { isCorrect: false, partialRatio: 0 };
  }
}
