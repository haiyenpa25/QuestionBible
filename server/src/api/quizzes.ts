import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma, formatBibleReference } from '../db.js';
import { verifyRequestUser, getOptionalRequestUser } from './auth.js';
import { config } from '../config.js';

/**
 * Kiểm tra magic bytes thực sự của file ảnh (Sửa lỗi #9: chặn SVG / HTML giả dạng ảnh gây XSS)
 */
function detectSafeImageExtension(buf: Buffer): '.jpg' | '.png' | '.webp' | '.gif' | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return '.jpg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return '.png';
  }
  // GIF: GIF87a hoặc GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return '.gif';
  }
  // WEBP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp';
  }
  return null;
}

export async function registerQuizRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/bible-books', async () => {
    const books = await prisma.bibleBook.findMany({
      orderBy: { id: 'asc' }
    });
    return { books };
  });

  app.get('/api/tags', async () => {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    return { tags };
  });

  app.get('/api/quizzes', async (req) => {
    const authUser = await getOptionalRequestUser(req);
    const query = req.query as {
      audience?: string;
      status?: string;
      search?: string;
      bookId?: string;
      testament?: 'OT' | 'NT';
      tagId?: string;
    };

    const where: Record<string, unknown> = {};

    if (!authUser) {
      where.visibility = 'public';
      where.status = 'approved';
    } else if (authUser.role === 'host') {
      where.OR = [
        { ownerId: authUser.userId },
        { visibility: { in: ['public', 'church'] } }
      ];
    }

    if (query.audience && query.audience !== 'all') {
      where.audience = query.audience;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      where.title = { contains: query.search.trim() };
    }
    if (query.bookId) {
      where.questions = { some: { bookId: Number(query.bookId) } };
    } else if (query.testament) {
      where.questions = { some: { book: { testament: query.testament } } };
    }
    if (query.tagId) {
      where.questions = {
        some: {
          questionTags: { some: { tagId: Number(query.tagId) } }
        }
      };
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: {
          select: { id: true, displayName: true, churchName: true }
        },
        _count: {
          select: { questions: true, gameSessions: true }
        }
      }
    });

    return { quizzes };
  });

  app.get('/api/quizzes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const quiz = await prisma.quiz.findUnique({
      where: { id: Number(id) },
      include: {
        owner: {
          select: { id: true, displayName: true, churchName: true }
        },
        questions: {
          orderBy: { position: 'asc' },
          include: {
            book: true,
            options: { orderBy: { position: 'asc' } },
            questionTags: { include: { tag: true } }
          }
        }
      }
    });

    if (!quiz) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ câu hỏi.' });
    }

    const formattedQuestions = quiz.questions.map((q) => ({
      ...q,
      bibleReference: formatBibleReference({
        book: q.book,
        chapter: q.chapter,
        verseFrom: q.verseFrom,
        verseTo: q.verseTo
      }),
      tags: q.questionTags.map((qt) => qt.tag.name)
    }));

    return {
      quiz: {
        ...quiz,
        questions: formattedQuestions
      }
    };
  });

  app.post('/api/quizzes', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const body = req.body as {
      title?: string;
      description?: string;
      coverImage?: string;
      audience?: 'kids' | 'teens' | 'youth' | 'adults' | 'all';
      visibility?: 'private' | 'church' | 'public';
    };

    const title = (body.title ?? '').trim();
    if (!title) {
      return reply.code(400).send({ error: 'Vui lòng nhập tiêu đề bộ câu hỏi.' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        ownerId: authUser.userId,
        title,
        description: body.description?.trim() || null,
        coverImage: body.coverImage || null,
        audience: body.audience ?? 'all',
        visibility: body.visibility ?? 'public',
        status: authUser.role === 'admin' || authUser.role === 'editor' ? 'approved' : 'draft'
      }
    });

    return { quiz };
  });

  app.put('/api/quizzes/:id', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const { id } = req.params as { id: string };
    const quizId = Number(id);
    const existing = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ câu hỏi.' });
    }

    if (
      existing.ownerId !== authUser.userId &&
      authUser.role !== 'admin' &&
      authUser.role !== 'editor'
    ) {
      return reply.code(403).send({ error: 'Bạn không có quyền chỉnh sửa bộ câu hỏi này.' });
    }

    const body = req.body as {
      title?: string;
      description?: string;
      coverImage?: string | null;
      audience?: 'kids' | 'teens' | 'youth' | 'adults' | 'all';
      visibility?: 'private' | 'church' | 'public';
      status?: 'draft' | 'review' | 'approved';
    };

    let nextStatus = existing.status;
    if (body.status) {
      if (body.status === 'approved' && authUser.role === 'host') {
        nextStatus = 'review';
      } else {
        nextStatus = body.status;
      }
    }

    const updated = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: body.title?.trim() ?? existing.title,
        description: body.description !== undefined ? body.description : existing.description,
        coverImage: body.coverImage !== undefined ? body.coverImage : existing.coverImage,
        audience: body.audience ?? existing.audience,
        visibility: body.visibility ?? existing.visibility,
        status: nextStatus
      }
    });

    return { quiz: updated };
  });

  app.delete('/api/quizzes/:id', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const { id } = req.params as { id: string };
    const quizId = Number(id);
    const existing = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ câu hỏi.' });
    }

    if (existing.ownerId !== authUser.userId && authUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Bạn không có quyền xoá bộ câu hỏi này.' });
    }

    await prisma.quiz.delete({ where: { id: quizId } });
    return { ok: true };
  });

  app.post('/api/quizzes/generate-random', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const body = req.body as {
      title?: string;
      testament?: 'OT' | 'NT' | 'ALL';
      bookId?: number;
      tagName?: string;
      maxDifficulty?: number;
      count?: number;
    };

    const questionWhere: Record<string, unknown> = {};
    if (body.bookId) {
      questionWhere.bookId = Number(body.bookId);
    } else if (body.testament === 'OT' || body.testament === 'NT') {
      questionWhere.book = { testament: body.testament };
    }
    if (body.maxDifficulty) {
      questionWhere.difficulty = { lte: Number(body.maxDifficulty) };
    }
    if (body.tagName) {
      questionWhere.questionTags = {
        some: { tag: { name: body.tagName } }
      };
    }

    const candidates = await prisma.question.findMany({
      where: questionWhere,
      include: {
        options: { orderBy: { position: 'asc' } },
        questionTags: true
      }
    });

    if (candidates.length === 0) {
      return reply.code(400).send({
        error: 'Không tìm thấy câu hỏi nào khớp với bộ lọc đã chọn trong kho.'
      });
    }

    const count = Math.min(Math.max(Number(body.count ?? 10), 1), candidates.length);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, count);

    const newQuiz = await prisma.quiz.create({
      data: {
        ownerId: authUser.userId,
        title: body.title?.trim() || `Đố Kinh Thánh Ngẫu Nhiên (${count} câu)`,
        description: 'Bộ câu hỏi được trích ngẫu nhiên từ ngân hàng câu hỏi Kinh Thánh.',
        audience: 'all',
        visibility: 'church',
        status: 'approved',
        questions: {
          create: shuffled.map((q, idx) => ({
            position: idx + 1,
            type: q.type,
            content: q.content,
            imageUrl: q.imageUrl,
            timeLimit: q.timeLimit,
            pointsFactor: q.pointsFactor,
            bookId: q.bookId,
            chapter: q.chapter,
            verseFrom: q.verseFrom,
            verseTo: q.verseTo,
            verseText: q.verseText,
            explanation: q.explanation,
            difficulty: q.difficulty,
            sliderMin: q.sliderMin,
            sliderMax: q.sliderMax,
            sliderAnswer: q.sliderAnswer,
            sliderTolerance: q.sliderTolerance,
            options: {
              create: q.options.map((opt) => ({
                position: opt.position,
                content: opt.content,
                isCorrect: opt.isCorrect
              }))
            }
          }))
        }
      }
    });

    return { quiz: newQuiz, count };
  });

  // Upload ảnh câu hỏi an toàn: Bỏ SVG, kiểm tra magic bytes thực sự (Sửa lỗi #9)
  app.post('/api/upload', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const file = await req.file();
    if (!file) {
      return reply.code(400).send({ error: 'Không có file nào được tải lên.' });
    }

    const buffer = await file.toBuffer();
    const safeExt = detectSafeImageExtension(buffer);
    if (!safeExt) {
      return reply.code(400).send({
        error: 'Chỉ chấp nhận file ảnh bitmap an toàn (JPG, PNG, WebP, GIF). Không cho phép SVG.'
      });
    }

    await fs.mkdir(config.uploadsDir, { recursive: true });
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    const filePath = path.join(config.uploadsDir, fileName);
    await fs.writeFile(filePath, buffer);

    return { url: `/uploads/${fileName}` };
  });
}
