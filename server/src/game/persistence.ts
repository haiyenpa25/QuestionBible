import Redis from 'ioredis';
import { config } from '../config.js';
import { prisma } from '../db.js';
import type { Room, RoomQuestionData } from './Room.js';
import type { RoomManager } from './RoomManager.js';
import { Player, type PlayerQuestionRecord } from './Player.js';

const SIX_HOURS_SECONDS = 6 * 3600;

let redisClient: Redis | null = null;
let redisAvailable = false;

// Bộ nhớ dự phòng khi môi trường dev Windows chưa bật Redis
const memoryHashes = new Map<string, Map<string, string>>();
const memorySets = new Map<string, Set<string>>();

export async function initRedis(): Promise<void> {
  try {
    const client = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      connectTimeout: 1500,
      // Sửa lỗi #19: Tự động kết nối lại có backoff khi Redis rớt tạm thời
      retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 1000, 5000);
      }
    });

    client.on('error', () => {
      redisAvailable = false;
    });

    client.on('ready', () => {
      redisAvailable = true;
    });

    await client.connect();
    await client.ping();
    redisClient = client;
    redisAvailable = true;
    console.log('✅ Đã kết nối Redis thành công:', config.redisUrl);
  } catch {
    redisAvailable = false;
    if (redisClient) {
      redisClient.disconnect();
      redisClient = null;
    }
    console.log('ℹ️ Redis chưa bật trên máy local — tự động dùng bộ nhớ RAM dự phòng cho trạng thái phòng.');
  }
}

export function isRedisConnected(): boolean {
  return redisAvailable;
}

export async function markPinActive(pin: string): Promise<void> {
  try {
    if (redisAvailable && redisClient) {
      await redisClient.sadd('pin:active', pin);
    } else {
      let s = memorySets.get('pin:active');
      if (!s) {
        s = new Set();
        memorySets.set('pin:active', s);
      }
      s.add(pin);
    }
  } catch (err) {
    console.error('Lỗi markPinActive:', err);
  }
}

export async function releasePinActive(pin: string): Promise<void> {
  try {
    if (redisAvailable && redisClient) {
      await redisClient.srem('pin:active', pin);
      await redisClient.del(`room:${pin}`, `room:${pin}:players`);
    } else {
      memorySets.get('pin:active')?.delete(pin);
      memoryHashes.delete(`room:${pin}`);
      memoryHashes.delete(`room:${pin}:players`);
    }
  } catch (err) {
    console.error('Lỗi releasePinActive:', err);
  }
}

/**
 * Lưu snapshot trạng thái phòng vào Redis theo cấu trúc mục 10.3 & hỗ trợ khôi phục (sửa lỗi #8)
 */
export async function saveRoomSnapshotToRedis(room: Room): Promise<void> {
  try {
    const roomKey = `room:${room.pin}`;
    const playersKey = `room:${room.pin}:players`;

    const roomHash: Record<string, string> = {
      roomId: room.roomId,
      sessionId: String(room.sessionId ?? 0),
      quizId: String(room.quizId),
      quizTitle: room.quizTitle,
      hostId: String(room.hostId),
      hostSocket: room.hostSocketId ?? '',
      state: room.state,
      currentQ: String(room.currentQ),
      startAt: String(room.questionStartAt),
      locked: room.locked ? '1' : '0',
      options: JSON.stringify(room.options),
      questions: JSON.stringify(room.questions)
    };

    if (redisAvailable && redisClient) {
      const pipeline = redisClient.pipeline();
      pipeline.hset(roomKey, roomHash);
      pipeline.expire(roomKey, SIX_HOURS_SECONDS);

      const playerEntries: Record<string, string> = {};
      for (const player of room.players.values()) {
        playerEntries[player.playerId] = JSON.stringify(player.toJSON());
      }
      if (Object.keys(playerEntries).length > 0) {
        pipeline.hset(playersKey, playerEntries);
        pipeline.expire(playersKey, SIX_HOURS_SECONDS);
      }

      if (room.currentQ >= 0) {
        const answersKey = `room:${room.pin}:answers:${room.currentQ}`;
        const answerEntries: Record<string, string> = {};
        for (const player of room.players.values()) {
          const rec = player.answers.get(room.currentQ);
          if (rec) {
            answerEntries[player.playerId] = JSON.stringify({
              choice: rec.answer,
              ms: rec.responseMs,
              isCorrect: rec.isCorrect,
              points: rec.points
            });
          }
        }
        if (Object.keys(answerEntries).length > 0) {
          pipeline.hset(answersKey, answerEntries);
          pipeline.expire(answersKey, SIX_HOURS_SECONDS);
        }
      }

      await pipeline.exec();
    } else {
      memoryHashes.set(roomKey, new Map(Object.entries(roomHash)));
      const pMap = new Map<string, string>();
      for (const player of room.players.values()) {
        pMap.set(player.playerId, JSON.stringify(player.toJSON()));
      }
      memoryHashes.set(playersKey, pMap);
    }
  } catch (err) {
    console.error('Lỗi saveRoomSnapshotToRedis (không chặn luồng game):', err);
  }
}

/**
 * Khôi phục các phòng đang chơi từ Redis khi PM2 / Node.js khởi động lại (Sửa lỗi #8)
 */
export async function restoreRoomsFromRedis(roomManager: RoomManager): Promise<number> {
  if (!redisAvailable || !redisClient) return 0;

  try {
    const activePins = await redisClient.smembers('pin:active');
    let restoredCount = 0;

    for (const pin of activePins) {
      const roomHash = await redisClient.hgetall(`room:${pin}`);
      if (!roomHash || !roomHash.quizId || !roomHash.questions) {
        await redisClient.srem('pin:active', pin);
        continue;
      }

      if (roomHash.state === 'ENDED') {
        continue;
      }

      const questions = JSON.parse(roomHash.questions) as RoomQuestionData[];
      const options = roomHash.options ? JSON.parse(roomHash.options) : undefined;

      const room = roomManager.instantiateRestoredRoom({
        pin,
        quizId: Number(roomHash.quizId),
        quizTitle: roomHash.quizTitle || 'Đố Kinh Thánh',
        hostId: Number(roomHash.hostId || 1),
        sessionId: Number(roomHash.sessionId || 0) || null,
        state: (roomHash.state as Room['state']) || 'LOBBY',
        currentQ: Number(roomHash.currentQ ?? -1),
        locked: roomHash.locked === '1',
        questions,
        options
      });

      const playersHash = await redisClient.hgetall(`room:${pin}:players`);
      for (const rawPlayer of Object.values(playersHash)) {
        try {
          const pData = JSON.parse(rawPlayer) as {
            playerId: string;
            dbPlayerId: number | null;
            deviceId: string | null;
            nickname: string;
            teamName: string | null;
            score: number;
            streak: number;
            correctCount: number;
            totalCorrectTimeMs: number;
            rank: number;
            token: string;
            answers?: Array<[number, PlayerQuestionRecord]>;
          };

          const p = new Player({
            playerId: pData.playerId,
            token: pData.token,
            deviceId: pData.deviceId,
            nickname: pData.nickname,
            teamName: pData.teamName,
            socketId: '',
            ip: '127.0.0.1'
          });
          p.dbPlayerId = pData.dbPlayerId;
          p.score = pData.score ?? 0;
          p.streak = pData.streak ?? 0;
          p.correctCount = pData.correctCount ?? 0;
          p.totalCorrectTimeMs = pData.totalCorrectTimeMs ?? 0;
          p.rank = pData.rank ?? 1;
          p.connected = false;
          if (Array.isArray(pData.answers)) {
            p.answers = new Map(pData.answers);
          }

          room.players.set(p.playerId, p);
          room.tokenIndex.set(p.token, p.playerId);
          if (p.deviceId) {
            room.deviceIndex.set(p.deviceId, p.playerId);
          }
        } catch {
          // ignore malformed entry
        }
      }

      restoredCount += 1;
    }

    if (restoredCount > 0) {
      console.log(`♻️ Đã khôi phục ${restoredCount} phòng đang hoạt động từ Redis.`);
    }
    return restoredCount;
  } catch (err) {
    console.error('Lỗi khi khôi phục phòng từ Redis:', err);
    return 0;
  }
}

/**
 * Tạo bản ghi GameSession trong MySQL kèm snapshot câu hỏi (Sửa lỗi #20)
 */
export async function createGameSessionInMySQL(room: Room): Promise<number | null> {
  try {
    const session = await prisma.gameSession.create({
      data: {
        quizId: room.quizId,
        hostId: room.hostId,
        pin: room.pin,
        mode: room.options.mode,
        settings: {
          options: room.options,
          questionsSnapshot: room.questions.map((q) => ({
            id: q.id,
            position: q.position,
            type: q.type,
            content: q.content,
            bibleReference: q.bibleReference
          }))
        } as object,
        playerCount: 0
      }
    });
    return session.id;
  } catch (err) {
    console.error('Lỗi createGameSessionInMySQL:', err);
    return null;
  }
}

/**
 * Đảm bảo người chơi có bản ghi trong bảng game_players mà không bao giờ tạo trùng (Sửa lỗi #12)
 */
export async function ensureGamePlayerInMySQL(
  sessionId: number,
  player: Player
): Promise<number | null> {
  if (player.dbPlayerId) return player.dbPlayerId;
  if (player.dbReadyPromise) {
    try {
      return await player.dbReadyPromise;
    } catch {
      return null;
    }
  }

  player.dbReadyPromise = prisma.gamePlayer
    .create({
      data: {
        sessionId,
        nickname: player.nickname,
        teamName: player.teamName
      }
    })
    .then((created) => {
      player.dbPlayerId = created.id;
      return created.id;
    });

  try {
    return await player.dbReadyPromise;
  } catch (err) {
    player.dbReadyPromise = null;
    console.error('Lỗi ensureGamePlayerInMySQL:', err);
    return null;
  }
}

/**
 * Ghi lô (bulk insert) toàn bộ câu trả lời của 1 câu hỏi vào MySQL khi câu kết thúc (Sửa lỗi #7)
 */
export async function flushQuestionAnswersToMySQL(
  room: Room,
  questionIndex: number
): Promise<void> {
  if (!room.sessionId) return;

  try {
    const rowsToInsert: Array<{
      playerId: number;
      questionId: number;
      answer: object;
      isCorrect: boolean;
      responseMs: number;
      points: number;
    }> = [];

    for (const player of room.players.values()) {
      const rec: PlayerQuestionRecord | undefined = player.answers.get(questionIndex);
      if (!rec) continue;
      const dbPlayerId = await ensureGamePlayerInMySQL(room.sessionId, player);
      if (!dbPlayerId) continue;
      rowsToInsert.push({
        playerId: dbPlayerId,
        questionId: rec.questionId,
        answer: rec.answer as object,
        isCorrect: rec.isCorrect,
        responseMs: rec.responseMs,
        points: rec.points
      });
    }

    if (rowsToInsert.length > 0) {
      await prisma.gameAnswer.createMany({
        data: rowsToInsert
      });
    }
  } catch (err) {
    console.error('Lỗi flushQuestionAnswersToMySQL (không làm gián đoạn trận đấu):', err);
  }
}

/**
 * Cập nhật điểm cuối cùng, thứ hạng và kết thúc phiên chơi trong MySQL bằng Transaction (Sửa lỗi #18)
 */
export async function finalizeGameSessionInMySQL(room: Room): Promise<void> {
  if (!room.sessionId) return;

  try {
    const sessionId = room.sessionId;
    const playersList = Array.from(room.players.values());

    // Đảm bảo mọi người chơi đã có dbPlayerId
    await Promise.all(playersList.map((p) => ensureGamePlayerInMySQL(sessionId, p)));

    const updateOps = playersList
      .filter((p) => p.dbPlayerId !== null)
      .map((p) =>
        prisma.gamePlayer.update({
          where: { id: p.dbPlayerId! },
          data: {
            finalScore: p.score,
            finalRank: p.rank,
            correctCount: p.correctCount
          }
        })
      );

    await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          playerCount: room.players.size,
          startedAt: room.startedAt ?? new Date(),
          endedAt: new Date()
        }
      }),
      ...updateOps
    ]);
  } catch (err) {
    console.error('Lỗi finalizeGameSessionInMySQL:', err);
  }
}
