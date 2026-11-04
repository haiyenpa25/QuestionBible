import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateQuestionScore,
  evaluateSubmittedAnswer,
  isTextAnswerMatch,
  normalizeAnswerText
} from '@questionbible/shared';
import { containsProfanityVi, validateNickname } from '../moderation/badwords-vi.js';

describe('QuestionBible Core Logic & Roadmap Fixes Tests', () => {
  it('Tính điểm tốc độ và chuỗi đúng liên tiếp (streak) đúng theo mục 9.1', () => {
    const r1 = calculateQuestionScore({
      isCorrect: true,
      elapsedMs: 0,
      durationMs: 20000,
      pointsFactor: 1,
      currentStreak: 0
    });
    assert.equal(r1.basePoints, 1000);
    assert.equal(r1.streakBonus, 0);
    assert.equal(r1.points, 1000);
    assert.equal(r1.newStreak, 1);

    const r2 = calculateQuestionScore({
      isCorrect: true,
      elapsedMs: 10000,
      durationMs: 20000,
      pointsFactor: 1,
      currentStreak: 2
    });
    assert.equal(r2.basePoints, 750);
    assert.equal(r2.streakBonus, 200);
    assert.equal(r2.points, 950);
    assert.equal(r2.newStreak, 3);

    const r3 = calculateQuestionScore({
      isCorrect: true,
      elapsedMs: 20000,
      durationMs: 20000,
      pointsFactor: 2,
      currentStreak: 0
    });
    assert.equal(r3.basePoints, 1000);
    assert.equal(r3.points, 1000);

    const r4 = calculateQuestionScore({
      isCorrect: false,
      elapsedMs: 2000,
      durationMs: 20000,
      pointsFactor: 1,
      currentStreak: 5
    });
    assert.equal(r4.points, 0);
    assert.equal(r4.newStreak, 0);
  });

  it('Chế độ thiếu nhi (tắt điểm tốc độ) cho điểm cố định 1000', () => {
    const res = calculateQuestionScore({
      isCorrect: true,
      elapsedMs: 18500,
      durationMs: 20000,
      pointsFactor: 1,
      currentStreak: 0,
      speedScoring: false
    });
    assert.equal(res.basePoints, 1000);
  });

  it('Chuẩn hoá tiếng Việt cho câu hỏi gõ đáp án (Điền câu gốc / Tên riêng)', () => {
    assert.equal(normalizeAnswerText('Phi-e-rơ'), 'phi e ro');
    assert.equal(isTextAnswerMatch('Phi-e-rơ', ['Phi-e-rơ']), true);
    assert.equal(isTextAnswerMatch('phie ro', ['Phi-e-rơ']), true);
    assert.equal(isTextAnswerMatch('phiero', ['Phi-e-rơ']), true);
    assert.equal(isTextAnswerMatch('Phê-rơ', ['Phi-e-rơ']), true);
    assert.equal(isTextAnswerMatch('con mot', ['Con một|Con Độc Sanh']), true);
  });

  it('Chấm điểm câu hỏi sắp xếp thứ tự (order) và thăm dò (poll) theo đúng sửa lỗi #15, #16', () => {
    const orderQ = {
      type: 'order' as const,
      options: [
        { position: 0, content: 'Ma-thi-ơ', isCorrect: true },
        { position: 1, content: 'Mác', isCorrect: true },
        { position: 2, content: 'Lu-ca', isCorrect: true },
        { position: 3, content: 'Giăng', isCorrect: true }
      ]
    };

    const exact = evaluateSubmittedAnswer(orderQ, { order: [0, 1, 2, 3] }, false);
    assert.equal(exact.isCorrect, true);
    assert.equal(exact.partialRatio, 1);

    // Đúng 2/4 (>= 50%) được tính điểm từng phần nhưng không tăng streak
    const partialHalf = evaluateSubmittedAnswer(orderQ, { order: [0, 1, 3, 2] }, true);
    assert.equal(partialHalf.isCorrect, true);
    assert.equal(partialHalf.partialRatio, 0.5);
    const partialScore = calculateQuestionScore({
      isCorrect: partialHalf.isCorrect,
      elapsedMs: 0,
      durationMs: 20000,
      pointsFactor: 1,
      currentStreak: 3,
      partialRatio: partialHalf.partialRatio
    });
    assert.equal(partialScore.basePoints, 500);
    assert.equal(partialScore.streakBonus, 0);
    assert.equal(partialScore.newStreak, 3);

    // Đúng 1/4 (< 50%) không được tính đúng (Sửa lỗi #16)
    const onlyOne = evaluateSubmittedAnswer(orderQ, { order: [0, 2, 3, 1] }, true);
    assert.equal(onlyOne.isCorrect, false);
    assert.equal(onlyOne.partialRatio, 0);

    // Câu thăm dò (poll) luôn 0 điểm và giữ nguyên streak (Sửa lỗi #15)
    const pollQ = {
      type: 'poll' as const,
      options: [
        { position: 0, content: 'Thi Thiên 23', isCorrect: true },
        { position: 1, content: 'Giăng 3:16', isCorrect: true }
      ]
    };
    const pollEval = evaluateSubmittedAnswer(pollQ, { choice: 1 });
    assert.equal(pollEval.isPoll, true);
    const pollScore = calculateQuestionScore({
      isCorrect: pollEval.isCorrect,
      elapsedMs: 1000,
      durationMs: 20000,
      pointsFactor: 1,
      currentStreak: 4,
      isPoll: pollEval.isPoll
    });
    assert.equal(pollScore.points, 0);
    assert.equal(pollScore.newStreak, 4);
  });

  it('Bộ lọc biệt danh tiếng Việt không chặn nhầm tên thật và chặn đúng từ tục (Sửa lỗi #11)', () => {
    const cleanVietnameseNames = [
      'Đàm Vĩnh Hưng',
      'Minh Đạm',
      'Bé Lớn',
      'Các bạn trẻ',
      'Buổi sáng',
      'Đêm Thánh',
      'Bưởi',
      'Đèo Cả',
      'Vol 2',
      'Ghê-đê-ôn Dũng Cảm',
      'Phước Nguyễn',
      'Lớp Ê-xơ-tê'
    ];

    for (const name of cleanVietnameseNames) {
      assert.equal(
        containsProfanityVi(name),
        false,
        `Tên hợp lệ "${name}" không được bị chặn nhầm`
      );
      assert.equal(validateNickname(name).valid, true, `validateNickname("${name}") phải hợp lệ`);
    }

    const badNicknames = [
      'd.m',
      'd-m',
      'v.l',
      'địt mẹ',
      'cái lồn',
      'con cặc',
      'đéo chơi',
      'fuck you'
    ];

    for (const bad of badNicknames) {
      assert.equal(containsProfanityVi(bad), true, `Từ tục "${bad}" phải bị chặn`);
      assert.equal(validateNickname(bad).valid, false);
    }
  });
});
