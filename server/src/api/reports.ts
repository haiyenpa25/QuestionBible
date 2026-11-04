import type { FastifyInstance } from 'fastify';
import os from 'node:os';
import ExcelJS from 'exceljs';
import { prisma, formatBibleReference } from '../db.js';
import { verifyRequestUser } from './auth.js';
import type { RoomManager } from '../game/RoomManager.js';
import { isRedisConnected } from '../game/persistence.js';

export async function registerReportRoutes(
  app: FastifyInstance,
  roomManager: RoomManager
): Promise<void> {
  // Healthcheck kiểm tra cả MySQL và Redis (Mục 7.4 roadmaps.md)
  app.get('/api/health', async (_req, reply) => {
    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
    const status = dbOk ? 'ok' : 'degraded';
    return reply.code(dbOk ? 200 : 503).send({
      status,
      timestamp: new Date().toISOString(),
      mysqlConnected: dbOk,
      redisConnected: isRedisConnected(),
      activeRooms: roomManager.roomsByPin.size
    });
  });

  // Sửa lỗi #5: Chỉ Admin mới xem được trạng thái toàn bộ phòng đang chạy
  app.get('/api/admin/status', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;
    if (authUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Chỉ quản trị viên mới có quyền truy cập trang trạng thái hệ thống.' });
    }

    const mem = process.memoryUsage();
    const rooms = Array.from(roomManager.roomsByPin.values()).map((r) => ({
      pin: r.pin,
      quizTitle: r.quizTitle,
      state: r.state,
      playerCount: r.players.size,
      currentQ: r.currentQ + 1,
      totalQuestions: r.questions.length,
      locked: r.locked
    }));

    return {
      uptimeSeconds: Math.round(process.uptime()),
      activeRoomCount: rooms.length,
      activePlayerSockets: roomManager.playerSocketToPin.size,
      redisConnected: isRedisConnected(),
      memoryMb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
      },
      cpuLoad: os.loadavg(),
      rooms
    };
  });

  app.get('/api/reports', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const where = authUser.role === 'admin' ? {} : { hostId: authUser.userId };

    const sessions = await prisma.gameSession.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 50,
      include: {
        quiz: {
          select: { id: true, title: true }
        },
        host: {
          select: { id: true, displayName: true }
        },
        _count: {
          select: { players: true }
        }
      }
    });

    return { sessions };
  });

  // Sửa lỗi #3 (IDOR): Kiểm tra quyền sở hữu phiên chơi trước khi trả báo cáo chi tiết
  app.get('/api/reports/:sessionId', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const { sessionId } = req.params as { sessionId: string };
    const sId = Number(sessionId);

    const session = await prisma.gameSession.findUnique({
      where: { id: sId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { position: 'asc' },
              include: { book: true }
            }
          }
        },
        host: {
          select: { id: true, displayName: true }
        },
        players: {
          orderBy: [{ finalScore: 'desc' }, { finalRank: 'asc' }],
          include: {
            answers: true
          }
        }
      }
    });

    if (!session) {
      return reply.code(404).send({ error: 'Không tìm thấy báo cáo trận đấu.' });
    }

    if (session.hostId !== authUser.userId && authUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Bạn không có quyền xem báo cáo của người dẫn khác.' });
    }

    const questionStats = session.quiz.questions.map((q) => {
      let totalAnswers = 0;
      let correctAnswers = 0;
      let totalTimeMs = 0;

      for (const player of session.players) {
        const ans = player.answers.find((a) => a.questionId === q.id);
        if (ans) {
          totalAnswers++;
          totalTimeMs += ans.responseMs;
          if (ans.isCorrect) correctAnswers++;
        }
      }

      const accuracyPercent =
        totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
      const avgResponseMs = totalAnswers > 0 ? Math.round(totalTimeMs / totalAnswers) : 0;

      return {
        questionId: q.id,
        position: q.position,
        content: q.content,
        type: q.type,
        bibleReference: formatBibleReference({
          book: q.book,
          chapter: q.chapter,
          verseFrom: q.verseFrom,
          verseTo: q.verseTo
        }),
        totalAnswers,
        correctAnswers,
        accuracyPercent,
        avgResponseMs
      };
    });

    return {
      session: {
        id: session.id,
        pin: session.pin,
        mode: session.mode,
        playerCount: session.players.length,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        quizTitle: session.quiz.title,
        hostName: session.host.displayName
      },
      players: session.players.map((p, idx) => ({
        id: p.id,
        nickname: p.nickname,
        teamName: p.teamName,
        finalScore: p.finalScore,
        finalRank: p.finalRank ?? idx + 1,
        correctCount: p.correctCount,
        totalQuestions: session.quiz.questions.length
      })),
      questionStats
    };
  });

  // Xuất kết quả trận đấu ra file Excel (có kiểm tra quyền sở hữu - Sửa lỗi #3)
  app.get('/api/reports/:sessionId/export', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const { sessionId } = req.params as { sessionId: string };
    const sId = Number(sessionId);

    const session = await prisma.gameSession.findUnique({
      where: { id: sId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { position: 'asc' },
              include: { book: true }
            }
          }
        },
        players: {
          orderBy: [{ finalScore: 'desc' }, { finalRank: 'asc' }],
          include: { answers: true }
        }
      }
    });

    if (!session) {
      return reply.code(404).send({ error: 'Không tìm thấy báo cáo trận đấu.' });
    }

    if (session.hostId !== authUser.userId && authUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Bạn không có quyền xuất báo cáo của người dẫn khác.' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QuestionBible';

    const rankSheet = workbook.addWorksheet('BangXepHang');
    rankSheet.columns = [
      { header: 'Hạng', key: 'rank', width: 10 },
      { header: 'Biệt danh', key: 'nickname', width: 28 },
      { header: 'Đội / Ban', key: 'teamName', width: 22 },
      { header: 'Tổng điểm', key: 'score', width: 15 },
      { header: 'Số câu đúng', key: 'correct', width: 15 },
      { header: 'Tổng số câu', key: 'totalQ', width: 15 },
      { header: 'Tỉ lệ đúng (%)', key: 'accuracy', width: 16 }
    ];
    rankSheet.getRow(1).font = { bold: true };

    const totalQ = session.quiz.questions.length || 1;
    session.players.forEach((p, idx) => {
      rankSheet.addRow({
        rank: p.finalRank ?? idx + 1,
        nickname: p.nickname,
        teamName: p.teamName ?? '-',
        score: p.finalScore,
        correct: p.correctCount,
        totalQ: session.quiz.questions.length,
        accuracy: Math.round((p.correctCount / totalQ) * 100)
      });
    });

    const qSheet = workbook.addWorksheet('ThongKeCauHoi');
    qSheet.columns = [
      { header: 'Câu số', key: 'pos', width: 10 },
      { header: 'Nội dung câu hỏi', key: 'content', width: 48 },
      { header: 'Tham chiếu Kinh Thánh', key: 'ref', width: 22 },
      { header: 'Số người trả lời', key: 'answered', width: 18 },
      { header: 'Số người đúng', key: 'correct', width: 16 },
      { header: 'Tỉ lệ đúng (%)', key: 'rate', width: 16 },
      { header: 'Thời gian TB (ms)', key: 'avgMs', width: 18 }
    ];
    qSheet.getRow(1).font = { bold: true };

    for (const q of session.quiz.questions) {
      let answered = 0;
      let correct = 0;
      let totalMs = 0;
      for (const p of session.players) {
        const ans = p.answers.find((a) => a.questionId === q.id);
        if (ans) {
          answered++;
          totalMs += ans.responseMs;
          if (ans.isCorrect) correct++;
        }
      }
      qSheet.addRow({
        pos: q.position,
        content: q.content,
        ref:
          formatBibleReference({
            book: q.book,
            chapter: q.chapter,
            verseFrom: q.verseFrom,
            verseTo: q.verseTo
          }) ?? '-',
        answered,
        correct,
        rate: answered > 0 ? Math.round((correct / answered) * 100) : 0,
        avgMs: answered > 0 ? Math.round(totalMs / answered) : 0
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      .header(
        'Content-Disposition',
        `attachment; filename="ket-qua-questionbible-pin-${session.pin}.xlsx"`
      )
      .send(Buffer.from(buffer));
  });
}
