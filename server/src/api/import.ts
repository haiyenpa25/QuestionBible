import type { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
import { removeVietnameseDiacritics } from '@questionbible/shared';
import { prisma } from '../db.js';
import { verifyRequestUser, assertCanEditQuiz } from './auth.js';

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/template/questions-excel', async (_req, reply) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QuestionBible';
    const sheet = workbook.addWorksheet('CauHoiKinhThanh');

    sheet.columns = [
      { header: 'Loại', key: 'type', width: 14 },
      { header: 'Câu hỏi', key: 'content', width: 45 },
      { header: 'A', key: 'optA', width: 22 },
      { header: 'B', key: 'optB', width: 22 },
      { header: 'C', key: 'optC', width: 22 },
      { header: 'D', key: 'optD', width: 22 },
      { header: 'Đáp án đúng', key: 'correct', width: 16 },
      { header: 'Thời gian', key: 'timeLimit', width: 12 },
      { header: 'Sách', key: 'book', width: 20 },
      { header: 'Chương', key: 'chapter', width: 10 },
      { header: 'Câu', key: 'verse', width: 10 },
      { header: 'Câu gốc', key: 'verseText', width: 45 },
      { header: 'Giải thích', key: 'explanation', width: 40 },
      { header: 'Độ khó', key: 'difficulty', width: 10 },
      { header: 'Chủ đề', key: 'tags', width: 25 }
    ];

    sheet.getRow(1).font = { bold: true };

    sheet.addRow({
      type: 'quiz',
      content: 'Ai đóng tàu theo lệnh Đức Chúa Trời?',
      optA: 'Áp-ra-ham',
      optB: 'Nô-ê',
      optC: 'Môi-se',
      optD: 'Đa-vít',
      correct: 'B',
      timeLimit: 20,
      book: 'Sáng Thế Ký',
      chapter: 6,
      verse: '14',
      verseText: 'Ngươi hãy đóng một chiếc tàu bằng cây gô-phe...',
      explanation: 'Nô-ê vâng lời Đức Chúa Trời đóng tàu cứu gia đình và các loài vật.',
      difficulty: 1,
      tags: 'Nhân vật; Cựu Ước'
    });

    sheet.addRow({
      type: 'true_false',
      content: 'Giô-na ở trong bụng cá 3 ngày 3 đêm.',
      optA: 'Đúng',
      optB: 'Sai',
      optC: '',
      optD: '',
      correct: 'A',
      timeLimit: 15,
      book: 'Giô-na',
      chapter: 1,
      verse: '17',
      verseText: 'Đức Giê-hô-va sắm sẵn một con cá lớn đặng nuốt Giô-na...',
      explanation: 'Giô-na ăn năn trong bụng cá và được Chúa giải cứu.',
      difficulty: 1,
      tags: 'Phép lạ; Cựu Ước'
    });

    sheet.addRow({
      type: 'type_answer',
      content: 'Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban ___ của Ngài (Giăng 3:16)',
      optA: 'Con một|Con Độc Sanh',
      optB: '',
      optC: '',
      optD: '',
      correct: 'A',
      timeLimit: 25,
      book: 'Giăng',
      chapter: 3,
      verse: '16',
      verseText: 'Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con một của Ngài...',
      explanation: 'Câu gốc nền tảng về tình yêu cứu chuộc của Đức Chúa Trời.',
      difficulty: 1,
      tags: 'Câu gốc; Tân Ước'
    });

    const buffer = await workbook.xlsx.writeBuffer();
    reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      .header('Content-Disposition', 'attachment; filename="mau-nhap-cau-hoi-questionbible.xlsx"')
      .send(Buffer.from(buffer));
  });

  // Nhập hàng loạt câu hỏi từ file Excel vào 1 bộ câu hỏi (có kiểm tra quyền sở hữu - Sửa lỗi #3)
  app.post('/api/quizzes/:quizId/import-excel', async (req, reply) => {
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

    const file = await req.file();
    if (!file) {
      return reply.code(400).send({ error: 'Vui lòng chọn file Excel (.xlsx) để tải lên.' });
    }

    const buffer = await file.toBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return reply.code(400).send({ error: 'File Excel không có sheet dữ liệu nào.' });
    }

    const allBooks = await prisma.bibleBook.findMany();
    const findBookId = (rawName: string): number | null => {
      const clean = removeVietnameseDiacritics(rawName).toLowerCase().trim();
      if (!clean) return null;
      const found = allBooks.find(
        (b) =>
          removeVietnameseDiacritics(b.nameVi).toLowerCase() === clean ||
          removeVietnameseDiacritics(b.abbrVi).toLowerCase() === clean
      );
      return found?.id ?? null;
    };

    let currentPos = quiz._count.questions;
    let importedCount = 0;
    const errors: string[] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const rawType = String(row.getCell(1).text ?? 'quiz').trim().toLowerCase();
      const content = String(row.getCell(2).text ?? '').trim();

      if (!content) continue;

      const optA = String(row.getCell(3).text ?? '').trim();
      const optB = String(row.getCell(4).text ?? '').trim();
      const optC = String(row.getCell(5).text ?? '').trim();
      const optD = String(row.getCell(6).text ?? '').trim();
      const correctRaw = String(row.getCell(7).text ?? 'A').trim().toUpperCase();
      const timeLimit = Number(row.getCell(8).text || 20) || 20;
      const bookRaw = String(row.getCell(9).text ?? '').trim();
      const chapter = Number(row.getCell(10).text || 0) || null;
      const verseRaw = String(row.getCell(11).text ?? '').trim();
      const verseText = String(row.getCell(12).text ?? '').trim() || null;
      const explanation = String(row.getCell(13).text ?? '').trim() || null;
      const difficulty = Math.min(Math.max(Number(row.getCell(14).text || 2), 1), 5);
      const tagsRaw = String(row.getCell(15).text ?? '').trim();

      const validTypes = ['quiz', 'true_false', 'type_answer', 'order', 'slider', 'poll'];
      const qType = (validTypes.includes(rawType) ? rawType : 'quiz') as
        | 'quiz'
        | 'true_false'
        | 'type_answer'
        | 'order'
        | 'slider'
        | 'poll';

      let verseFrom: number | null = null;
      let verseTo: number | null = null;
      if (verseRaw) {
        const parts = verseRaw.split('-').map((p) => Number(p.trim()));
        if (parts[0]) verseFrom = parts[0];
        if (parts[1]) verseTo = parts[1];
      }

      const rawOptions = [optA, optB, optC, optD].filter(Boolean);
      if (rawOptions.length === 0) {
        errors.push(`Dòng ${rowNumber}: Thiếu phương án trả lời.`);
        continue;
      }

      const correctLetters = new Set(
        correctRaw.split(/[,;]/).map((s) => s.trim())
      );
      const indexToLetter = ['A', 'B', 'C', 'D'];

      const optionsToCreate = rawOptions.map((optContent, idx) => ({
        position: idx,
        content: optContent,
        isCorrect:
          qType === 'type_answer' || qType === 'order'
            ? true
            : correctLetters.has(indexToLetter[idx])
      }));

      const tagIds: number[] = [];
      if (tagsRaw) {
        const tagNames = tagsRaw
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const tName of tagNames) {
          const tag = await prisma.tag.upsert({
            where: { name: tName },
            update: {},
            create: { name: tName }
          });
          tagIds.push(tag.id);
        }
      }

      currentPos += 1;
      await prisma.question.create({
        data: {
          quizId: qId,
          position: currentPos,
          type: qType,
          content,
          timeLimit,
          pointsFactor: 1,
          bookId: findBookId(bookRaw),
          chapter,
          verseFrom,
          verseTo,
          verseText,
          explanation,
          difficulty,
          options: {
            create: optionsToCreate
          },
          questionTags: {
            create: tagIds.map((tagId) => ({ tagId }))
          }
        }
      });

      importedCount += 1;
    }

    return {
      ok: true,
      importedCount,
      errors
    };
  });
}
