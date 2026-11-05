import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomOptions,
  RoomState
} from '@questionbible/shared';
import { prisma, formatBibleReference } from '../db.js';
import { config } from '../config.js';
import { Room, type RoomQuestionData } from './Room.js';
import {
  markPinActive,
  releasePinActive,
  createGameSessionInMySQL,
  saveRoomSnapshotToRedis
} from './persistence.js';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export class RoomManager {
  public roomsByPin = new Map<string, Room>();
  public hostSocketToPin = new Map<string, string>();
  public playerSocketToPin = new Map<string, string>();

  // Sửa lỗi #1: Chỉ đếm số lần nhập SAI mã PIN theo IP (không bao giờ chặn 300 người cùng Wi-Fi nhập đúng PIN)
  private wrongPinAttemptsByIp = new Map<string, { count: number; resetAt: number }>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  private io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
    // Sửa lỗi #17: Tự động dọn phòng cũ định kỳ mỗi 5 phút
    this.cleanupTimer = setInterval(() => {
      void this.cleanupStaleRooms();
    }, 5 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  private generateUniquePin(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      if (!this.roomsByPin.has(pin)) {
        return pin;
      }
    }
    return String(Date.now()).slice(-6);
  }

  /**
   * Kiểm tra xem IP có đang bị khoá tạm thời do đoán mò sai PIN quá nhiều lần hay không
   */
  public isIpBlockedByWrongPin(ip: string): { blocked: boolean; error?: string } {
    const now = Date.now();
    const record = this.wrongPinAttemptsByIp.get(ip);
    if (!record || now > record.resetAt) {
      return { blocked: false };
    }
    if (record.count >= config.wrongPinRateLimitPerMin) {
      return {
        blocked: true,
        error: 'Mạng của bạn đã nhập sai mã PIN quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại.'
      };
    }
    return { blocked: false };
  }

  public recordWrongPinAttempt(ip: string): void {
    const now = Date.now();
    const record = this.wrongPinAttemptsByIp.get(ip);
    if (!record || now > record.resetAt) {
      this.wrongPinAttemptsByIp.set(ip, { count: 1, resetAt: now + 60_000 });
      return;
    }
    record.count += 1;
  }

  public instantiateRestoredRoom(params: {
    pin: string;
    quizId: number;
    quizTitle: string;
    hostId: number;
    sessionId: number | null;
    state: RoomState;
    currentQ: number;
    locked: boolean;
    questions: RoomQuestionData[];
    options?: Partial<RoomOptions>;
    remoteKey?: string;
  }): Room {
    const room = new Room({
      pin: params.pin,
      quizId: params.quizId,
      quizTitle: params.quizTitle,
      hostId: params.hostId,
      hostSocketId: null,
      questions: params.questions,
      options: params.options,
      remoteKey: params.remoteKey,
      io: this.io
    });
    room.sessionId = params.sessionId;
    room.state = params.state;
    room.currentQ = params.currentQ;
    room.locked = params.locked;
    this.roomsByPin.set(params.pin, room);
    return room;
  }

  public async createRoom(params: {
    quizId: number;
    hostId: number;
    hostSocketId: string;
    options?: Partial<RoomOptions>;
  }): Promise<{ ok: boolean; room?: Room; error?: string }> {
    const quiz = await prisma.quiz.findUnique({
      where: { id: params.quizId },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: {
            book: true,
            options: {
              orderBy: { position: 'asc' }
            }
          }
        }
      }
    });

    if (!quiz) {
      return { ok: false, error: 'Không tìm thấy bộ câu hỏi.' };
    }
    if (quiz.questions.length === 0) {
      return { ok: false, error: 'Bộ câu hỏi này chưa có câu hỏi nào.' };
    }

    const questions: RoomQuestionData[] = quiz.questions.map((q) => ({
      id: q.id,
      position: q.position,
      type: q.type,
      content: q.content,
      imageUrl: q.imageUrl,
      timeLimit: q.timeLimit,
      pointsFactor: q.pointsFactor,
      bibleReference: formatBibleReference({
        book: q.book,
        chapter: q.chapter,
        verseFrom: q.verseFrom,
        verseTo: q.verseTo
      }),
      verseText: q.verseText,
      explanation: q.explanation,
      hostNotes: q.hostNotes,
      sliderMin: q.sliderMin,
      sliderMax: q.sliderMax,
      sliderAnswer: q.sliderAnswer,
      sliderTolerance: q.sliderTolerance,
      options: q.options.map((opt) => ({
        position: opt.position,
        content: opt.content,
        isCorrect: opt.isCorrect
      }))
    }));

    const pin = this.generateUniquePin();
    const room = new Room({
      pin,
      quizId: quiz.id,
      quizTitle: quiz.title,
      hostId: params.hostId,
      hostSocketId: params.hostSocketId,
      questions,
      options: params.options,
      io: this.io
    });

    room.sessionId = await createGameSessionInMySQL(room);

    this.roomsByPin.set(pin, room);
    this.hostSocketToPin.set(params.hostSocketId, pin);

    await markPinActive(pin);
    await saveRoomSnapshotToRedis(room);

    return { ok: true, room };
  }

  public getRoomByPin(pin: string): Room | undefined {
    return this.roomsByPin.get((pin ?? '').trim());
  }

  public getRoomByHostSocket(socketId: string): Room | undefined {
    const pin = this.hostSocketToPin.get(socketId);
    if (!pin) return undefined;
    return this.roomsByPin.get(pin);
  }

  public getRoomByPlayerSocket(socketId: string): Room | undefined {
    const pin = this.playerSocketToPin.get(socketId);
    if (!pin) return undefined;
    return this.roomsByPin.get(pin);
  }

  public async closeRoom(pin: string): Promise<void> {
    const room = this.roomsByPin.get(pin);
    if (!room) return;
    room.clearTimers();
    this.roomsByPin.delete(pin);
    await releasePinActive(pin);
  }

  /**
   * Tự động dọn phòng đã kết thúc sau 30 phút hoặc phòng sảnh chờ bỏ trống sau 2 giờ (Sửa lỗi #17)
   */
  public async cleanupStaleRooms(): Promise<void> {
    const now = Date.now();
    for (const [pin, room] of this.roomsByPin.entries()) {
      if (
        (room.state === 'PODIUM' || room.state === 'ENDED') &&
        room.endedAtMs &&
        now - room.endedAtMs > THIRTY_MINUTES_MS
      ) {
        await this.closeRoom(pin);
      } else if (
        room.state === 'LOBBY' &&
        !room.hostSocketId &&
        now - room.createdAtMs > TWO_HOURS_MS
      ) {
        await this.closeRoom(pin);
      }
    }
  }
}
