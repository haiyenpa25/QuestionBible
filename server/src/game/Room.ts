import crypto from 'node:crypto';
import type { Server } from 'socket.io';
import {
  calculateQuestionScore,
  evaluateSubmittedAnswer,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type RoomState,
  type RoomOptions,
  type QuizQuestionType,
  type LobbyUpdatePayload,
  type QuestionIntroHostPayload,
  type QuestionIntroPlayerPayload,
  type QuestionRevealPayload,
  type LeaderboardEntry,
  type TeamLeaderboardEntry,
  type LeaderboardPayload,
  type PodiumPayload,
  type PlayerAnswerPayload,
  type QuestionOptionView,
  type PlayerResultPayload,
  type ScripturePayload,
  type RemoteAnswerKeyPayload,
  type HostSyncPayload,
  type PersonalReviewItem
} from '@questionbible/shared';
import { Player, type PlayerQuestionRecord } from './Player.js';
import { normalizeNicknameKey } from '../moderation/badwords-vi.js';
import {
  saveRoomSnapshotToRedis,
  flushQuestionAnswersToMySQL,
  finalizeGameSessionInMySQL,
  ensureGamePlayerInMySQL
} from './persistence.js';

export interface RoomQuestionData {
  id: number;
  position: number;
  type: QuizQuestionType;
  content: string;
  imageUrl?: string | null;
  timeLimit: number;
  pointsFactor: number;
  bibleReference?: string | null;
  verseText?: string | null;
  explanation?: string | null;
  hostNotes?: string | null;
  sliderMin?: number | null;
  sliderMax?: number | null;
  sliderAnswer?: number | null;
  sliderTolerance?: number | null;
  options: Array<{
    position: number;
    content: string;
    isCorrect: boolean;
  }>;
}

const GRACE_PERIOD_MS = 500;
const SUGGESTION_VIRTUES = ['Trung Tín', 'Dũng Cảm', 'Vui Mừng', 'Bình An', 'Khôn Ngoan'];

export class Room {
  public readonly roomId: string;
  public readonly pin: string;
  public readonly quizId: number;
  public readonly quizTitle: string;
  public readonly hostId: number;
  public readonly createdAtMs = Date.now();
  public endedAtMs: number | null = null;
  public sessionId: number | null = null;
  public hostSocketId: string | null = null;
  // Điện thoại điều khiển từ xa: ghép bằng khoá bí mật remoteKey (không cần đăng nhập trên điện thoại)
  public readonly remoteKey: string;
  public remoteSockets = new Set<string>();
  public state: RoomState = 'LOBBY';
  public locked = false;
  public options: RoomOptions;
  public questions: RoomQuestionData[];
  public currentQ = -1;
  public startedAt: Date | null = null;

  public players = new Map<string, Player>(); // playerId -> Player
  public tokenIndex = new Map<string, string>(); // token -> playerId
  public socketIndex = new Map<string, string>(); // socketId -> playerId
  public deviceIndex = new Map<string, string>(); // deviceId -> playerId (Sửa lỗi #1 & mục 6.3)
  public kickedNicknames = new Set<string>();
  public bannedDevices = new Set<string>();

  public questionStartAt = 0;
  public questionDurationMs = 20000;
  public paused = false;
  public pausedAt = 0;
  public totalPausedMs = 0;

  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private introTimer: NodeJS.Timeout | null = null;
  private answerTimer: NodeJS.Timeout | null = null;
  private lobbyThrottleTimer: NodeJS.Timeout | null = null;
  private answerCountThrottleTimer: NodeJS.Timeout | null = null;
  private currentShuffledOptions: QuestionOptionView[] = [];
  // Ánh xạ mã token hiển thị trên client -> thứ tự thật trên server cho câu sắp xếp (Sửa lỗi #6)
  private orderTokenToRealPosition = new Map<number, number>();
  // Bộ nhớ đệm các màn gần nhất để đồng bộ lại màn chiếu / điều khiển khi vào giữa trận
  private lastHostIntro: QuestionIntroHostPayload | null = null;
  private lastReveal: QuestionRevealPayload | null = null;
  private lastScripture: ScripturePayload | null = null;
  private lastLeaderboard: LeaderboardPayload | null = null;
  private lastPodium: PodiumPayload | null = null;

  constructor(params: {
    pin: string;
    quizId: number;
    quizTitle: string;
    hostId: number;
    hostSocketId: string | null;
    questions: RoomQuestionData[];
    options?: Partial<RoomOptions>;
    remoteKey?: string;
    io: Server<ClientToServerEvents, ServerToClientEvents>;
  }) {
    this.roomId = crypto.randomUUID();
    this.remoteKey = params.remoteKey || crypto.randomBytes(16).toString('hex');
    this.pin = params.pin;
    this.quizId = params.quizId;
    this.quizTitle = params.quizTitle;
    this.hostId = params.hostId;
    this.hostSocketId = params.hostSocketId;
    this.questions = params.questions;
    this.io = params.io;

    this.options = {
      mode: params.options?.mode ?? 'classic',
      speedScoring: params.options?.speedScoring ?? true,
      streakEnabled: params.options?.streakEnabled ?? true,
      friendlyMode: params.options?.friendlyMode ?? true,
      showQuestionOnPlayer: params.options?.showQuestionOnPlayer ?? false,
      partialOrderScoring: params.options?.partialOrderScoring ?? true,
      randomBibleNickname: params.options?.randomBibleNickname ?? false,
      scriptureStep: params.options?.scriptureStep ?? true,
      openingPrayerOrVerse:
        params.options?.openingPrayerOrVerse ??
        '“Lời Chúa là ngọn đèn cho chân tôi, ánh sáng cho đường lối tôi.” — Thi Thiên 119:105',
      teams: params.options?.teams ?? [
        'Đội Đa-vít',
        'Đội Môi-se',
        'Đội Ghê-đê-ôn',
        'Đội Đa-ni-ên'
      ]
    };
  }

  public get socketRoomName(): string {
    return `room:${this.pin}`;
  }

  public get hostRoomName(): string {
    return `host:${this.pin}`;
  }

  /** Phòng Socket.IO riêng cho điện thoại điều khiển: nhận đáp án trước & ghi chú người dẫn */
  public get remoteRoomName(): string {
    return `remote:${this.pin}`;
  }

  /** Socket có quyền điều khiển nhịp trận: máy chủ phòng hoặc điện thoại điều khiển đã ghép */
  public canControl(socketId: string): boolean {
    return this.hostSocketId === socketId || this.remoteSockets.has(socketId);
  }

  public isRemoteKeyValid(key: unknown): boolean {
    if (typeof key !== 'string' || key.length !== this.remoteKey.length) return false;
    return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(this.remoteKey));
  }

  /** Mốc giờ server hết giờ trả lời (không tính thời gian ân hạn) */
  public getAnswerEndsAt(): number {
    return this.questionStartAt + this.totalPausedMs + this.questionDurationMs;
  }

  public getRemainingAnswerMs(): number {
    if (this.state !== 'ANSWERING') return 0;
    const now = this.paused ? this.pausedAt : Date.now();
    return Math.max(this.questionDurationMs - (now - this.questionStartAt - this.totalPausedMs), 0);
  }

  public countAnsweredCurrent(): number {
    let answered = 0;
    for (const p of this.players.values()) {
      if (p.answers.has(this.currentQ)) answered++;
    }
    return answered;
  }

  /** Diễn giải đáp án đúng thành chữ cho điện thoại điều khiển & màn xem lại cá nhân */
  private describeCorrectAnswer(qData: RoomQuestionData): string {
    switch (qData.type) {
      case 'poll':
        return 'Câu thăm dò — không có đáp án đúng/sai';
      case 'order':
        return [...qData.options]
          .sort((a, b) => a.position - b.position)
          .map((o) => o.content)
          .join(' → ');
      case 'slider': {
        const tol = qData.sliderTolerance ? ` (±${qData.sliderTolerance})` : '';
        return `${qData.sliderAnswer ?? '?'}${tol}`;
      }
      case 'type_answer':
        return qData.options.map((o) => o.content).join(' / ');
      default:
        return (
          qData.options
            .filter((o) => o.isCorrect)
            .map((o) => o.content)
            .join(' / ') || '(chưa đánh dấu đáp án đúng)'
        );
    }
  }

  private describePlayerAnswer(qData: RoomQuestionData, rec: PlayerQuestionRecord): string {
    const optionText = (pos: number) =>
      qData.options.find((o) => o.position === pos)?.content ?? `Phương án ${pos + 1}`;
    const a = rec.answer;
    if (qData.type === 'order' && Array.isArray(a.order)) {
      return a.order.map((pos) => optionText(pos)).join(' → ');
    }
    if (qData.type === 'type_answer') return String(a.text ?? '');
    if (qData.type === 'slider') return String(a.value ?? '');
    if (typeof a.choice === 'number') return optionText(a.choice);
    if (Array.isArray(a.choice)) return a.choice.map((c) => optionText(c)).join(' / ');
    return '';
  }

  private buildAnswerKey(): RemoteAnswerKeyPayload | null {
    const qData = this.questions[this.currentQ];
    if (!qData) return null;
    return {
      q: this.currentQ,
      type: qData.type,
      correctText: this.describeCorrectAnswer(qData),
      hostNotes: qData.hostNotes ?? null
    };
  }

  /** Gói đồng bộ đầy đủ cho màn chiếu / bảng điều khiển / điện thoại điều khiển */
  public getHostSyncPayload(includeAnswerKey: boolean): HostSyncPayload {
    const inQuestion = this.currentQ >= 0 && this.state !== 'LOBBY';
    return {
      pin: this.pin,
      quizTitle: this.quizTitle,
      totalQuestions: this.questions.length,
      state: this.state,
      paused: this.paused,
      remainingMs: this.getRemainingAnswerMs(),
      endsAt: this.state === 'ANSWERING' && !this.paused ? this.getAnswerEndsAt() : null,
      answered: inQuestion ? this.countAnsweredCurrent() : 0,
      totalPlayers: this.players.size,
      lobby: this.getLobbyPayload(),
      intro: inQuestion ? this.lastHostIntro : null,
      reveal: this.state === 'REVEAL' || this.state === 'SCRIPTURE' ? this.lastReveal : null,
      scripture: this.state === 'SCRIPTURE' ? this.lastScripture : null,
      leaderboard: this.state === 'LEADERBOARD' ? this.lastLeaderboard : null,
      podium: this.state === 'PODIUM' || this.state === 'ENDED' ? this.lastPodium : null,
      answerKey: includeAnswerKey && inQuestion ? this.buildAnswerKey() : undefined
    };
  }

  public getCurrentShuffledOptions(): QuestionOptionView[] {
    if (this.currentShuffledOptions.length === 0 && this.currentQ >= 0) {
      const qData = this.questions[this.currentQ];
      if (qData) {
        this.currentShuffledOptions = this.prepareOptionsView(qData);
      }
    }
    return this.currentShuffledOptions;
  }

  public updateOptions(partial: Partial<RoomOptions>): void {
    if (this.state !== 'LOBBY') return;
    this.options = {
      ...this.options,
      ...partial
    };
    this.scheduleLobbyUpdate(true);
    void saveRoomSnapshotToRedis(this);
  }

  public getLobbyPayload(): LobbyUpdatePayload {
    const players = Array.from(this.players.values()).map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      teamName: p.teamName,
      connected: p.connected
    }));

    return {
      pin: this.pin,
      quizTitle: this.quizTitle,
      locked: this.locked,
      playerCount: players.length,
      players,
      options: this.options
    };
  }

  public scheduleLobbyUpdate(immediate = false): void {
    if (immediate) {
      if (this.lobbyThrottleTimer) {
        clearTimeout(this.lobbyThrottleTimer);
        this.lobbyThrottleTimer = null;
      }
      this.io.to(this.hostRoomName).emit('lobby:update', this.getLobbyPayload());
      return;
    }

    if (this.lobbyThrottleTimer) return;
    this.lobbyThrottleTimer = setTimeout(() => {
      this.lobbyThrottleTimer = null;
      this.io.to(this.hostRoomName).emit('lobby:update', this.getLobbyPayload());
    }, 500);
  }

  public scheduleAnswerCountUpdate(immediate = false): void {
    const emitCount = () => {
      const answered = this.countAnsweredCurrent();
      this.io.to(this.hostRoomName).emit('answer:count', {
        q: this.currentQ,
        answered,
        total: this.players.size
      });
    };

    if (immediate) {
      if (this.answerCountThrottleTimer) {
        clearTimeout(this.answerCountThrottleTimer);
        this.answerCountThrottleTimer = null;
      }
      emitCount();
      return;
    }

    if (this.answerCountThrottleTimer) return;
    this.answerCountThrottleTimer = setTimeout(() => {
      this.answerCountThrottleTimer = null;
      emitCount();
    }, 250);
  }

  private generateNicknameSuggestions(baseNickname: string, usedKeys: Set<string>): string[] {
    const suggestions: string[] = [];
    const trimmed = baseNickname.slice(0, 14).trim();

    for (let num = 2; num <= 99; num++) {
      const candidate = `${trimmed} ${num}`;
      if (!usedKeys.has(normalizeNicknameKey(candidate))) {
        suggestions.push(candidate);
        break;
      }
    }

    for (const virtue of SUGGESTION_VIRTUES) {
      const candidate = `${trimmed} ${virtue}`.slice(0, 24);
      if (!usedKeys.has(normalizeNicknameKey(candidate))) {
        suggestions.push(candidate);
        if (suggestions.length >= 3) break;
      }
    }

    while (suggestions.length < 3) {
      const rand = crypto.randomInt(10, 99);
      const candidate = `${trimmed} ${rand}`;
      if (!usedKeys.has(normalizeNicknameKey(candidate))) {
        suggestions.push(candidate);
      }
    }

    return suggestions.slice(0, 3);
  }

  public addPlayer(params: {
    nickname: string;
    teamName?: string;
    socketId: string;
    ip: string;
    deviceId?: string;
  }): { ok: boolean; player?: Player; suggestions?: string[]; error?: string } {
    const cleanDeviceId = params.deviceId?.trim() || null;

    if (cleanDeviceId && this.bannedDevices.has(cleanDeviceId)) {
      return { ok: false, error: 'Thiết bị của bạn đã bị người dẫn từ chối khỏi phòng này.' };
    }

    // Mục 6.3 & 6.4 roadmaps.md: Nếu cùng một thiết bị (deviceId) vào lại phòng -> nối lại đúng chỗ cũ, giữ nguyên điểm!
    if (cleanDeviceId && this.deviceIndex.has(cleanDeviceId)) {
      const existingPlayerId = this.deviceIndex.get(cleanDeviceId)!;
      const existingPlayer = this.players.get(existingPlayerId);
      if (existingPlayer) {
        if (existingPlayer.socketId) {
          this.socketIndex.delete(existingPlayer.socketId);
        }
        existingPlayer.socketId = params.socketId;
        existingPlayer.ip = params.ip;
        existingPlayer.connected = true;
        this.socketIndex.set(params.socketId, existingPlayer.playerId);
        this.scheduleLobbyUpdate();
        return { ok: true, player: existingPlayer };
      }
    }

    if (this.locked) {
      return { ok: false, error: 'Phòng hiện đã khóa, không nhận thêm người chơi mới.' };
    }
    if (this.state === 'ENDED' || this.state === 'PODIUM') {
      return { ok: false, error: 'Trận đấu đã kết thúc.' };
    }

    const normKey = normalizeNicknameKey(params.nickname);
    if (this.kickedNicknames.has(normKey)) {
      return { ok: false, error: 'Biệt danh này đã bị người dẫn từ chối khỏi phòng.' };
    }

    const usedKeys = new Set<string>();
    for (const existing of this.players.values()) {
      usedKeys.add(normalizeNicknameKey(existing.nickname));
    }

    // Nếu trùng tên với người chơi khác trong phòng -> gợi ý 3 tên 1-chạm (mục 6.4 roadmaps.md)
    if (usedKeys.has(normKey)) {
      const suggestions = this.generateNicknameSuggestions(params.nickname, usedKeys);
      return {
        ok: false,
        suggestions,
        error: `Tên "${params.nickname}" đã có người dùng trong phòng. Bấm chọn nhanh 1 tên gợi ý bên dưới:`
      };
    }

    let assignedTeam = params.teamName ?? null;
    if (this.options.mode === 'team' && !assignedTeam && this.options.teams?.length) {
      const counts = new Map<string, number>();
      for (const t of this.options.teams) counts.set(t, 0);
      for (const p of this.players.values()) {
        if (p.teamName && counts.has(p.teamName)) {
          counts.set(p.teamName, (counts.get(p.teamName) ?? 0) + 1);
        }
      }
      assignedTeam = [...counts.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
    }

    const player = new Player({
      nickname: params.nickname,
      teamName: assignedTeam,
      socketId: params.socketId,
      ip: params.ip,
      deviceId: cleanDeviceId
    });

    this.players.set(player.playerId, player);
    this.tokenIndex.set(player.token, player.playerId);
    this.socketIndex.set(params.socketId, player.playerId);
    if (cleanDeviceId) {
      this.deviceIndex.set(cleanDeviceId, player.playerId);
    }

    // Tự động bật hiển thị chữ đáp án trên điện thoại khi phòng đông trên 100 người (mục 7.2 roadmaps.md)
    if (this.players.size >= 100 && !this.options.showQuestionOnPlayer) {
      this.options.showQuestionOnPlayer = true;
    }

    if (this.sessionId) {
      void ensureGamePlayerInMySQL(this.sessionId, player);
    }

    this.scheduleLobbyUpdate();
    void saveRoomSnapshotToRedis(this);

    return { ok: true, player };
  }

  public rejoinPlayer(params: {
    token: string;
    deviceId?: string;
    socketId: string;
    ip: string;
  }): { ok: boolean; player?: Player; error?: string } {
    let playerId = this.tokenIndex.get(params.token);
    if (!playerId && params.deviceId) {
      playerId = this.deviceIndex.get(params.deviceId);
    }
    if (!playerId) {
      return { ok: false, error: 'Không tìm thấy phiên chơi trước đó. Vui lòng tham gia lại.' };
    }
    const player = this.players.get(playerId);
    if (!player) {
      return { ok: false, error: 'Người chơi không còn trong phòng.' };
    }

    if (player.socketId) {
      this.socketIndex.delete(player.socketId);
    }
    player.socketId = params.socketId;
    player.ip = params.ip;
    player.connected = true;
    this.socketIndex.set(params.socketId, player.playerId);

    this.scheduleLobbyUpdate();
    return { ok: true, player };
  }

  public kickPlayer(playerId: string, banDevice = false): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    this.kickedNicknames.add(normalizeNicknameKey(player.nickname));
    if (player.deviceId) {
      this.deviceIndex.delete(player.deviceId);
      if (banDevice) {
        this.bannedDevices.add(player.deviceId);
      }
    }
    if (player.socketId) {
      this.io.to(player.socketId).emit('player:kicked', {
        reason: 'Người dẫn chương trình đã mời bạn rời khỏi phòng.'
      });
      this.socketIndex.delete(player.socketId);
    }
    this.tokenIndex.delete(player.token);
    this.players.delete(playerId);
    this.scheduleLobbyUpdate(true);
    void saveRoomSnapshotToRedis(this);
    return true;
  }

  public handleDisconnect(socketId: string): void {
    if (this.hostSocketId === socketId) {
      this.hostSocketId = null;
      return;
    }
    if (this.remoteSockets.delete(socketId)) {
      return;
    }

    const playerId = this.socketIndex.get(socketId);
    if (!playerId) return;
    this.socketIndex.delete(socketId);
    const player = this.players.get(playerId);
    if (player) {
      player.connected = false;
      this.scheduleLobbyUpdate();
    }
  }

  public startGame(): void {
    if (this.state !== 'LOBBY') return;
    if (this.questions.length === 0) return;
    this.startedAt = new Date();
    this.currentQ = -1;
    this.advanceToNextQuestion();
  }

  /**
   * Tính thời gian đọc câu hỏi tự động theo độ dài văn bản & ảnh (Mục 4.3 roadmaps.md)
   */
  private computeIntroDurationMs(qData: RoomQuestionData): number {
    const raw = 2000 + qData.content.length * 45 + (qData.imageUrl ? 1500 : 0);
    return Math.min(Math.max(raw, 3000), 8000);
  }

  public advanceToNextQuestion(): void {
    this.clearTimers();

    if (this.currentQ + 1 >= this.questions.length) {
      void this.showPodium();
      return;
    }

    this.currentQ += 1;
    this.state = 'QUESTION_INTRO';
    this.paused = false;
    this.totalPausedMs = 0;

    const qData = this.questions[this.currentQ];
    this.currentShuffledOptions = this.prepareOptionsView(qData);
    const introDurationMs = this.computeIntroDurationMs(qData);

    const hostIntro: QuestionIntroHostPayload = {
      q: this.currentQ,
      totalQuestions: this.questions.length,
      type: qData.type,
      content: qData.content,
      imageUrl: qData.imageUrl,
      timeLimit: qData.timeLimit,
      pointsFactor: qData.pointsFactor,
      bibleReference: qData.bibleReference,
      introDurationMs,
      options: this.currentShuffledOptions,
      sliderMin: qData.sliderMin,
      sliderMax: qData.sliderMax
    };

    const playerIntro: QuestionIntroPlayerPayload = {
      q: this.currentQ,
      totalQuestions: this.questions.length,
      type: qData.type,
      n: qData.options.length,
      t: qData.timeLimit,
      pointsFactor: qData.pointsFactor,
      content: this.options.showQuestionOnPlayer ? qData.content : undefined,
      options:
        qData.type === 'order' || qData.type === 'poll' || this.options.showQuestionOnPlayer
          ? this.currentShuffledOptions
          : undefined,
      sliderMin: qData.sliderMin,
      sliderMax: qData.sliderMax
    };

    this.lastHostIntro = hostIntro;
    this.lastReveal = null;
    this.lastScripture = null;
    this.lastLeaderboard = null;

    this.io.to(this.hostRoomName).emit('question:intro', hostIntro);
    this.io.to(this.socketRoomName).emit('question:intro', playerIntro);
    const answerKey = this.buildAnswerKey();
    if (answerKey) {
      this.io.to(this.remoteRoomName).emit('remote:answer-key', answerKey);
    }

    void saveRoomSnapshotToRedis(this);

    this.introTimer = setTimeout(() => {
      this.openAnsweringPhase();
    }, introDurationMs);
  }

  /**
   * Xáo trộn bằng Fisher-Yates với crypto.randomInt & dùng mã token ẩn thứ tự thật (Sửa lỗi #6 & #23)
   */
  private prepareOptionsView(qData: RoomQuestionData): QuestionOptionView[] {
    this.orderTokenToRealPosition.clear();
    const base = qData.options.map((o) => ({
      position: o.position,
      content: o.content
    }));

    if (qData.type === 'order' && base.length > 1) {
      const shuffled = [...base];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (shuffled.every((item, idx) => item.position === base[idx].position)) {
        shuffled.reverse();
      }

      // Gán mã token hiển thị 0..n-1 đã ẩn hoàn toàn thứ tự thật (DevTools không thể biết thứ tự gốc)
      return shuffled.map((item, displayIdx) => {
        const opaqueToken = displayIdx;
        this.orderTokenToRealPosition.set(opaqueToken, item.position);
        return {
          position: opaqueToken,
          content: item.content
        };
      });
    }

    return base;
  }

  public openAnsweringPhase(): void {
    this.clearTimers();
    const qData = this.questions[this.currentQ];
    if (!qData) return;

    this.state = 'ANSWERING';
    this.questionStartAt = Date.now();
    this.questionDurationMs = qData.timeLimit * 1000;
    this.paused = false;
    this.totalPausedMs = 0;

    const startPayload = {
      q: this.currentQ,
      duration: qData.timeLimit,
      serverTime: this.questionStartAt,
      endsAt: this.getAnswerEndsAt(),
      options:
        qData.type === 'order' || qData.type === 'poll' || this.options.showQuestionOnPlayer
          ? this.currentShuffledOptions
          : undefined
    };

    this.io.to(this.hostRoomName).emit('question:start', startPayload);
    this.io.to(this.socketRoomName).emit('question:start', startPayload);
    this.scheduleAnswerCountUpdate(true);

    this.answerTimer = setTimeout(() => {
      void this.revealCurrentQuestion();
    }, this.questionDurationMs + GRACE_PERIOD_MS);
  }

  public togglePause(): void {
    if (this.state !== 'ANSWERING') return;

    if (!this.paused) {
      this.paused = true;
      this.pausedAt = Date.now();
      if (this.answerTimer) {
        clearTimeout(this.answerTimer);
        this.answerTimer = null;
      }
      const elapsed = this.pausedAt - this.questionStartAt - this.totalPausedMs;
      const remainingMs = Math.max(this.questionDurationMs - elapsed, 0);
      this.io.to(this.hostRoomName).emit('room:paused', { paused: true, remainingMs });
      this.io.to(this.socketRoomName).emit('room:paused', { paused: true, remainingMs });
    } else {
      const pauseDelta = Date.now() - this.pausedAt;
      this.totalPausedMs += pauseDelta;
      this.paused = false;
      const elapsed = Date.now() - this.questionStartAt - this.totalPausedMs;
      const remainingMs = Math.max(this.questionDurationMs - elapsed, 0);

      const endsAt = this.getAnswerEndsAt();
      this.io.to(this.hostRoomName).emit('room:paused', { paused: false, remainingMs, endsAt });
      this.io.to(this.socketRoomName).emit('room:paused', { paused: false, remainingMs, endsAt });

      this.answerTimer = setTimeout(() => {
        void this.revealCurrentQuestion();
      }, remainingMs + GRACE_PERIOD_MS);
    }
  }

  public skipCurrentPhase(): void {
    if (this.state === 'QUESTION_INTRO') {
      this.openAnsweringPhase();
    } else if (this.state === 'ANSWERING') {
      void this.revealCurrentQuestion();
    } else if (this.state === 'REVEAL' || this.state === 'SCRIPTURE' || this.state === 'LEADERBOARD') {
      this.nextPhase();
    }
  }

  /** Nút "Tiếp" của người dẫn: Đáp án → (Chia sẻ Lời Chúa) → Bảng xếp hạng → Câu tiếp theo */
  public nextPhase(): void {
    if (this.state === 'REVEAL') {
      const qData = this.questions[this.currentQ];
      if (this.options.scriptureStep && qData && (qData.verseText || qData.explanation)) {
        this.showScripture();
      } else {
        this.showLeaderboard();
      }
    } else if (this.state === 'SCRIPTURE') {
      this.showLeaderboard();
    } else if (this.state === 'LEADERBOARD') {
      this.advanceToNextQuestion();
    }
  }

  /** Bước "Chia sẻ Lời Chúa": chiếu câu gốc toàn màn hình & gửi xuống điện thoại mọi người */
  public showScripture(): void {
    if (this.state !== 'REVEAL') return;
    const qData = this.questions[this.currentQ];
    if (!qData) return;
    this.state = 'SCRIPTURE';
    const payload: ScripturePayload = {
      q: this.currentQ,
      content: qData.content,
      bibleReference: qData.bibleReference,
      verseText: qData.verseText,
      explanation: qData.explanation
    };
    this.lastScripture = payload;
    this.io.to(this.hostRoomName).emit('scripture:show', payload);
    this.io.to(this.socketRoomName).emit('scripture:show', payload);
    void saveRoomSnapshotToRedis(this);
  }

  public submitPlayerAnswer(
    socketId: string,
    payload: PlayerAnswerPayload
  ): { received: boolean; error?: string } {
    if (this.state !== 'ANSWERING') {
      return { received: false, error: 'Đã hết thời gian nhận câu trả lời.' };
    }
    if (this.paused) {
      return { received: false, error: 'Trận đấu đang tạm dừng.' };
    }
    if (payload.q !== this.currentQ) {
      return { received: false, error: 'Câu hỏi không khớp.' };
    }

    const playerId = this.socketIndex.get(socketId);
    if (!playerId) {
      return { received: false, error: 'Không tìm thấy người chơi.' };
    }
    const player = this.players.get(playerId);
    if (!player) {
      return { received: false, error: 'Không tìm thấy người chơi.' };
    }

    if (player.answers.has(this.currentQ)) {
      return { received: false, error: 'Bạn đã gửi câu trả lời cho câu này rồi.' };
    }

    const now = Date.now();
    const rawElapsed = now - this.questionStartAt - this.totalPausedMs;
    if (rawElapsed > this.questionDurationMs + GRACE_PERIOD_MS) {
      return { received: false, error: 'Câu trả lời đến quá thời gian cho phép.' };
    }

    const rttCompensation = Math.min(Math.max(Math.round(player.rttMs / 2), 0), 300);
    const compensatedElapsed =
      rawElapsed > this.questionDurationMs
        ? this.questionDurationMs
        : Math.max(0, rawElapsed - rttCompensation);

    const qData = this.questions[this.currentQ];

    // Ánh xạ lại mã token ẩn của câu sắp xếp sang thứ tự thật trước khi chấm điểm (Sửa lỗi #6)
    let normalizedOrder = payload.order;
    if (qData.type === 'order' && Array.isArray(payload.order) && this.orderTokenToRealPosition.size > 0) {
      normalizedOrder = payload.order.map((tok) => this.orderTokenToRealPosition.get(tok) ?? -1);
    }

    const evaluation = evaluateSubmittedAnswer(
      qData,
      {
        ...payload,
        order: normalizedOrder
      },
      this.options.partialOrderScoring
    );

    const scoreResult = calculateQuestionScore({
      isCorrect: evaluation.isCorrect,
      elapsedMs: compensatedElapsed,
      durationMs: this.questionDurationMs,
      pointsFactor: qData.pointsFactor,
      currentStreak: player.streak,
      speedScoring: this.options.speedScoring,
      streakEnabled: this.options.streakEnabled,
      partialRatio: evaluation.partialRatio,
      isPoll: evaluation.isPoll
    });

    player.answers.set(this.currentQ, {
      q: this.currentQ,
      questionId: qData.id,
      answer: {
        choice: payload.choice,
        text: payload.text,
        order: normalizedOrder,
        value: payload.value
      },
      isCorrect: evaluation.isCorrect,
      isPoll: evaluation.isPoll,
      responseMs: compensatedElapsed,
      points: scoreResult.points,
      basePoints: scoreResult.basePoints,
      streakBonus: scoreResult.streakBonus
    });

    this.io.to(socketId).emit('answer:ack', {
      received: true,
      q: this.currentQ
    });

    this.scheduleAnswerCountUpdate();

    let allConnectedAnswered = this.players.size > 0;
    for (const p of this.players.values()) {
      if (p.connected && !p.answers.has(this.currentQ)) {
        allConnectedAnswered = false;
        break;
      }
    }

    if (allConnectedAnswered) {
      if (this.answerTimer) {
        clearTimeout(this.answerTimer);
      }
      this.answerTimer = setTimeout(() => {
        void this.revealCurrentQuestion();
      }, 350);
    }

    return { received: true };
  }

  public buildPlayerResultPayload(player: Player, questionIndex: number): PlayerResultPayload {
    const qData = this.questions[questionIndex];
    const rec = player.answers.get(questionIndex);
    const totalPlayers = this.players.size;

    // Mục 7.1 & lỗi #21: Chế độ thân thiện (friendlyMode) ẩn thứ hạng thấp để các em không ngại
    const hideLowRank = this.options.friendlyMode && player.rank > 5;
    const friendlyRankText = hideLowRank
      ? player.rank <= 10
        ? 'Trong Top 10 — Cố lên!'
        : 'Hãy tiếp tục cố gắng!'
      : null;

    return {
      q: questionIndex,
      correct: rec?.isCorrect ?? false,
      isPoll: qData?.type === 'poll',
      points: rec?.points ?? 0,
      basePoints: rec?.basePoints ?? 0,
      streakBonus: rec?.streakBonus ?? 0,
      total: player.score,
      rank: hideLowRank ? null : player.rank,
      friendlyRankText,
      totalPlayers,
      streak: player.streak,
      bibleReference: qData?.bibleReference,
      verseText: qData?.verseText,
      explanation: qData?.explanation
    };
  }

  public async revealCurrentQuestion(): Promise<void> {
    if (this.state !== 'ANSWERING') return;
    this.clearTimers();
    this.state = 'REVEAL';

    const qData = this.questions[this.currentQ];
    const optionCounts = new Array<number>(qData.options.length).fill(0);
    let totalAnswered = 0;

    for (const player of this.players.values()) {
      const rec = player.answers.get(this.currentQ);
      if (!rec) {
        if (qData.type !== 'poll') {
          player.streak = 0;
        }
        continue;
      }

      totalAnswered++;
      if (typeof rec.answer.choice === 'number' && rec.answer.choice < optionCounts.length) {
        optionCounts[rec.answer.choice]++;
      } else if (Array.isArray(rec.answer.choice)) {
        for (const c of rec.answer.choice) {
          if (c >= 0 && c < optionCounts.length) optionCounts[c]++;
        }
      } else if (rec.isCorrect && optionCounts.length > 0) {
        optionCounts[0]++;
      }

      // Lỗi #15: Câu thăm dò (poll) không cộng điểm, không tăng streak/correctCount
      if (qData.type === 'poll') {
        continue;
      }

      if (rec.isCorrect) {
        player.score += rec.points;
        // Chỉ tăng streak khi đạt điểm tối đa câu sắp xếp hoặc đúng câu thường (lỗi #16)
        if (qData.type !== 'order' || rec.points > 0) {
          player.streak = rec.streakBonus > 0 || player.streak === 0 ? player.streak + 1 : player.streak;
        }
        player.correctCount += 1;
        player.totalCorrectTimeMs += rec.responseMs;
      } else {
        player.streak = 0;
      }
    }

    this.recalculateRanks();

    const correctPositions = qData.options
      .filter((o) => o.isCorrect)
      .map((o) => o.position);

    const orderedCorrectContents =
      qData.type === 'order'
        ? [...qData.options].sort((a, b) => a.position - b.position).map((o) => o.content)
        : undefined;

    const revealPayload: QuestionRevealPayload = {
      q: this.currentQ,
      type: qData.type,
      content: qData.content,
      correctPositions,
      orderedCorrectContents,
      acceptedTexts:
        qData.type === 'type_answer' ? qData.options.map((o) => o.content) : undefined,
      sliderAnswer: qData.sliderAnswer,
      sliderTolerance: qData.sliderTolerance,
      optionCounts,
      totalAnswered,
      bibleReference: qData.bibleReference,
      verseText: qData.verseText,
      explanation: qData.explanation
    };

    this.lastReveal = revealPayload;
    this.io.to(this.hostRoomName).emit('question:reveal', revealPayload);

    for (const player of this.players.values()) {
      if (!player.socketId || !player.connected) continue;
      this.io.to(player.socketId).emit(
        'player:result',
        this.buildPlayerResultPayload(player, this.currentQ)
      );
    }

    // Ghi DB và Redis không chặn luồng sự kiện (Sửa lỗi #7)
    void Promise.allSettled([
      flushQuestionAnswersToMySQL(this, this.currentQ),
      saveRoomSnapshotToRedis(this)
    ]);
  }

  private recalculateRanks(): void {
    const sorted = Array.from(this.players.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.totalCorrectTimeMs - b.totalCorrectTimeMs;
    });

    sorted.forEach((player, index) => {
      player.previousRank = player.rank;
      player.rank = index + 1;
    });
  }

  public getLeaderboardEntries(limit = 5): LeaderboardEntry[] {
    const sorted = Array.from(this.players.values()).sort((a, b) => a.rank - b.rank);
    return sorted.slice(0, limit).map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      teamName: p.teamName,
      score: p.score,
      streak: p.streak,
      rank: p.rank,
      previousRank: p.previousRank,
      rankDelta: p.previousRank !== null ? p.previousRank - p.rank : 0
    }));
  }

  public getTeamStandings(): TeamLeaderboardEntry[] {
    const teamGroups = new Map<string, { total: number; count: number }>();
    for (const p of this.players.values()) {
      const tName = p.teamName || 'Chưa phân đội';
      const cur = teamGroups.get(tName) ?? { total: 0, count: 0 };
      cur.total += p.score;
      cur.count += 1;
      teamGroups.set(tName, cur);
    }

    const entries: TeamLeaderboardEntry[] = Array.from(teamGroups.entries())
      .map(([teamName, data]) => ({
        teamName,
        totalScore: data.total,
        averageScore: data.count > 0 ? Math.round(data.total / data.count) : 0,
        memberCount: data.count,
        rank: 1
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    entries.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });
    return entries;
  }

  public showLeaderboard(): void {
    if (this.currentQ + 1 >= this.questions.length) {
      void this.showPodium();
      return;
    }

    this.state = 'LEADERBOARD';

    let topClimber: { nickname: string; climbed: number } | null = null;
    for (const p of this.players.values()) {
      if (p.previousRank !== null) {
        const climbed = p.previousRank - p.rank;
        if (climbed > 0 && (!topClimber || climbed > topClimber.climbed)) {
          topClimber = { nickname: p.nickname, climbed };
        }
      }
    }

    const payload: LeaderboardPayload = {
      q: this.currentQ,
      totalQuestions: this.questions.length,
      topPlayers: this.getLeaderboardEntries(5),
      topClimber,
      teamStandings: this.options.mode === 'team' ? this.getTeamStandings() : undefined
    };

    this.lastLeaderboard = payload;
    this.io.to(this.hostRoomName).emit('leaderboard', payload);
    void saveRoomSnapshotToRedis(this);
  }

  /**
   * Sửa lỗi #18: Không cho showPodium chạy trùng lặp, phát bục vinh danh ngay lập tức cho 300 người
   * rồi mới ghi kết quả xuống MySQL ở nền.
   */
  public async showPodium(): Promise<void> {
    if (this.state === 'PODIUM' || this.state === 'ENDED') return;
    this.clearTimers();
    this.recalculateRanks();
    this.state = 'PODIUM';
    this.endedAtMs = Date.now();

    const top3 = this.getLeaderboardEntries(3);
    const top5 = this.getLeaderboardEntries(5);
    const teamStandings = this.options.mode === 'team' ? this.getTeamStandings() : undefined;

    const hostPodium: PodiumPayload = {
      sessionId: this.sessionId ?? 0,
      quizTitle: this.quizTitle,
      top3,
      top5,
      teamStandings,
      totalPlayers: this.players.size,
      totalQuestions: this.questions.length
    };

    this.lastPodium = hostPodium;
    this.io.to(this.hostRoomName).emit('game:podium', hostPodium);

    for (const player of this.players.values()) {
      if (!player.socketId || !player.connected) continue;
      this.io.to(player.socketId).emit('game:podium', this.buildPlayerPodiumPayload(player));
    }

    // Lưu MySQL & Redis bất đồng bộ, có bắt lỗi đầy đủ (Sửa lỗi #7 & #18)
    void Promise.allSettled([
      finalizeGameSessionInMySQL(this),
      saveRoomSnapshotToRedis(this)
    ]);
  }

  /** Gói bục vinh danh riêng từng người: kèm thứ hạng thân thiện & màn xem lại từng câu */
  public buildPlayerPodiumPayload(player: Player): PodiumPayload {
    const base: PodiumPayload = this.lastPodium ?? {
      sessionId: this.sessionId ?? 0,
      quizTitle: this.quizTitle,
      top3: this.getLeaderboardEntries(3),
      top5: this.getLeaderboardEntries(5),
      totalPlayers: this.players.size,
      totalQuestions: this.questions.length
    };
    const hideLowRank = this.options.friendlyMode && player.rank > 5;
    return {
      ...base,
      personalResult: {
        rank: hideLowRank ? null : player.rank,
        friendlyRankText: hideLowRank
          ? player.rank <= 10
            ? 'Trong Top 10 Chung Cuộc!'
            : 'Hoàn thành xuất sắc!'
          : null,
        score: player.score,
        correctCount: player.correctCount,
        totalQuestions: this.questions.length
      },
      review: this.buildPersonalReview(player)
    };
  }

  /** Màn xem lại cá nhân: chỉ gồm các câu đã thực sự được hỏi trong trận */
  public buildPersonalReview(player: Player): PersonalReviewItem[] {
    const lastAsked = Math.min(this.currentQ, this.questions.length - 1);
    const items: PersonalReviewItem[] = [];
    for (let i = 0; i <= lastAsked; i++) {
      const qData = this.questions[i];
      if (!qData) continue;
      const rec = player.answers.get(i);
      const isPoll = qData.type === 'poll';
      items.push({
        q: i,
        type: qData.type,
        content: qData.content,
        answered: Boolean(rec),
        correct: Boolean(rec?.isCorrect) && !isPoll,
        isPoll,
        points: rec?.points ?? 0,
        yourAnswer: rec ? this.describePlayerAnswer(qData, rec) : null,
        correctAnswer: this.describeCorrectAnswer(qData),
        bibleReference: qData.bibleReference,
        verseText: qData.verseText,
        explanation: qData.explanation
      });
    }
    return items;
  }

  public clearTimers(): void {
    if (this.introTimer) {
      clearTimeout(this.introTimer);
      this.introTimer = null;
    }
    if (this.answerTimer) {
      clearTimeout(this.answerTimer);
      this.answerTimer = null;
    }
    if (this.lobbyThrottleTimer) {
      clearTimeout(this.lobbyThrottleTimer);
      this.lobbyThrottleTimer = null;
    }
    if (this.answerCountThrottleTimer) {
      clearTimeout(this.answerCountThrottleTimer);
      this.answerCountThrottleTimer = null;
    }
  }
}
