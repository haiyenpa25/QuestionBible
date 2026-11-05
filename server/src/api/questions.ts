import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { verifyRequestUser, assertCanEditQuiz } from './auth.js';

interface QuestionPayloadBody {
  position?: number;
  type: 'quiz' | 'true_false' | 'type_answer' | 'order' | 'slider' | 'poll';
  content: string;
  imageUrl?: string | null;
  timeLimit?: number;
  pointsFactor?: number;
  bookId?: number | null;
  chapter?: number | null;
  verseFrom?: number | null;
  verseTo?: number | null;
  verseText?: string | null;
  explanation?: string | null;
  hostNotes?: string | null;
  difficulty?: number;
  sliderMin?: number | null;
  sliderMax?: number | null;
  sliderAnswer?: number | null;
  sliderTolerance?: number | null;
  options: Array<{
    position?: number;
    content: string;
    isCorrect: boolean;
  }>;
  tags?: string[];
}

export async function registerQuestionRoutes(app: FastifyInstance): Promise<void> {
  // Thêm câu hỏi vào bộ câu hỏi (có kiểm tra quyền sở hữu - Sửa lỗi #3)
  app.post('/api/quizzes/:quizId/questions', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const { quizId } = req.params as { quizId: string };
    const qId = Number(quizId);

    const canEdit = await assertCanEditQuiz(authUser, qId, reply);
    if (!canEdit) return;

    const quiz = await prisma.quiz.findUnique({
      where: { id: qId },
      include: { _count: { select: { questions: true } } }
    });
    if (!quiz) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ câu hỏi.' });
    }

    const body = req.body as QuestionPayloadBody;
    if (!body.content?.trim()) {
      return reply.code(400).send({ error: 'Nội dung câu hỏi không được để trống.' });
    }

    const tagIds: number[] = [];
    if (Array.isArray(body.tags)) {
      for (const rawTag of body.tags) {
        const tagName = rawTag.trim();
        if (!tagName) continue;
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName }
        });
        tagIds.push(tag.id);
      }
    }

    const position = body.position ?? quiz._count.questions + 1;
    const created = await prisma.question.create({
      data: {
        quizId: qId,
        position,
        type: body.type ?? 'quiz',
        content: body.content.trim().slice(0, 300),
        imageUrl: body.imageUrl || null,
        timeLimit: Number(body.timeLimit ?? 20),
        pointsFactor: Number(body.pointsFactor ?? 1),
        bookId: body.bookId ? Number(body.bookId) : null,
        chapter: body.chapter ? Number(body.chapter) : null,
        verseFrom: body.verseFrom ? Number(body.verseFrom) : null,
        verseTo: body.verseTo ? Number(body.verseTo) : null,
        verseText: body.verseText?.trim() || null,
        explanation: body.explanation?.trim() || null,
        hostNotes: body.hostNotes?.trim().slice(0, 2000) || null,
        difficulty: Number(body.difficulty ?? 2),
        sliderMin: body.sliderMin !== undefined && body.sliderMin !== null ? Number(body.sliderMin) : null,
        sliderMax: body.sliderMax !== undefined && body.sliderMax !== null ? Number(body.sliderMax) : null,
        sliderAnswer: body.sliderAnswer !== undefined && body.sliderAnswer !== null ? Number(body.sliderAnswer) : null,
        sliderTolerance:
          body.sliderTolerance !== undefined && body.sliderTolerance !== null
            ? Number(body.sliderTolerance)
            : null,
        options: {
          create: (body.options ?? []).map((opt, idx) => ({
            position: opt.position ?? idx,
            content: opt.content.trim().slice(0, 150),
            isCorrect: Boolean(opt.isCorrect)
          }))
        },
        questionTags: {
          create: tagIds.map((tagId) => ({ tagId }))
        }
      },
      include: {
        book: true,
        options: { orderBy: { position: 'asc' } },
        questionTags: { include: { tag: true } }
      }
    });

    return { question: created };
  });

  // Cập nhật câu hỏi (có kiểm tra quyền sở hữu - Sửa lỗi #3)
  app.put('/api/questions/:id', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const { id } = req.params as { id: string };
    const questionId = Number(id);

    const existing = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Không tìm thấy câu hỏi.' });
    }

    const canEdit = await assertCanEditQuiz(authUser, existing.quizId, reply);
    if (!canEdit) return;

    const body = req.body as QuestionPayloadBody;

    const tagIds: number[] = [];
    if (Array.isArray(body.tags)) {
      for (const rawTag of body.tags) {
        const tagName = rawTag.trim();
        if (!tagName) continue;
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName }
        });
        tagIds.push(tag.id);
      }
    }

    await prisma.questionOption.deleteMany({ where: { questionId } });
    if (Array.isArray(body.tags)) {
      await prisma.questionTag.deleteMany({ where: { questionId } });
    }

    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        position: body.position ?? existing.position,
        type: body.type ?? existing.type,
        content: body.content?.trim() ?? existing.content,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
        timeLimit: body.timeLimit !== undefined ? Number(body.timeLimit) : existing.timeLimit,
        pointsFactor:
          body.pointsFactor !== undefined ? Number(body.pointsFactor) : existing.pointsFactor,
        bookId: body.bookId !== undefined ? (body.bookId ? Number(body.bookId) : null) : existing.bookId,
        chapter:
          body.chapter !== undefined ? (body.chapter ? Number(body.chapter) : null) : existing.chapter,
        verseFrom:
          body.verseFrom !== undefined
            ? body.verseFrom
              ? Number(body.verseFrom)
              : null
            : existing.verseFrom,
        verseTo:
          body.verseTo !== undefined ? (body.verseTo ? Number(body.verseTo) : null) : existing.verseTo,
        verseText: body.verseText !== undefined ? body.verseText : existing.verseText,
        explanation: body.explanation !== undefined ? body.explanation : existing.explanation,
        hostNotes:
          body.hostNotes !== undefined
            ? body.hostNotes?.trim().slice(0, 2000) || null
            : existing.hostNotes,
        difficulty: body.difficulty !== undefined ? Number(body.difficulty) : existing.difficulty,
        sliderMin: body.sliderMin !== undefined ? body.sliderMin : existing.sliderMin,
        sliderMax: body.sliderMax !== undefined ? body.sliderMax : existing.sliderMax,
        sliderAnswer: body.sliderAnswer !== undefined ? body.sliderAnswer : existing.sliderAnswer,
        sliderTolerance:
          body.sliderTolerance !== undefined ? body.sliderTolerance : existing.sliderTolerance,
        options: {
          create: (body.options ?? []).map((opt, idx) => ({
            position: opt.position ?? idx,
            content: opt.content.trim(),
            isCorrect: Boolean(opt.isCorrect)
          }))
        },
        ...(Array.isArray(body.tags)
          ? {
              questionTags: {
                create: tagIds.map((tagId) => ({ tagId }))
              }
            }
          : {})
      },
      include: {
        book: true,
        options: { orderBy: { position: 'asc' } },
        questionTags: { include: { tag: true } }
      }
    });

    return { question: updated };
  });

  // Xoá câu hỏi (có kiểm tra quyền sở hữu - Sửa lỗi #3)
  app.delete('/api/questions/:id', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const { id } = req.params as { id: string };
    const questionId = Number(id);
    const existing = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Không tìm thấy câu hỏi.' });
    }

    const canEdit = await assertCanEditQuiz(authUser, existing.quizId, reply);
    if (!canEdit) return;

    await prisma.question.delete({ where: { id: questionId } });
    return { ok: true };
  });
}
