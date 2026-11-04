import crypto from 'node:crypto';
import type { PlayerSubmittedAnswer } from '@questionbible/shared';

export interface PlayerQuestionRecord {
  q: number;
  questionId: number;
  answer: PlayerSubmittedAnswer;
  isCorrect: boolean;
  isPoll?: boolean;
  responseMs: number;
  points: number;
  basePoints: number;
  streakBonus: number;
}

export class Player {
  public readonly playerId: string;
  public readonly token: string;
  public deviceId: string | null;
  public dbPlayerId: number | null = null;
  public dbReadyPromise: Promise<number> | null = null;
  public nickname: string;
  public teamName: string | null;
  public socketId: string;
  public ip: string;
  public connected = true;
  public score = 0;
  public streak = 0;
  public correctCount = 0;
  public totalCorrectTimeMs = 0;
  public rank = 1;
  public previousRank: number | null = null;
  public rttMs = 40;
  public answers = new Map<number, PlayerQuestionRecord>();

  constructor(params: {
    nickname: string;
    teamName?: string | null;
    socketId: string;
    ip: string;
    deviceId?: string | null;
    playerId?: string;
    token?: string;
  }) {
    this.playerId = params.playerId ?? crypto.randomUUID();
    this.token = params.token ?? crypto.randomBytes(24).toString('hex');
    this.deviceId = params.deviceId ?? null;
    this.nickname = params.nickname;
    this.teamName = params.teamName ?? null;
    this.socketId = params.socketId;
    this.ip = params.ip;
  }

  public updateRtt(measuredRttMs: number): void {
    if (Number.isFinite(measuredRttMs) && measuredRttMs >= 0 && measuredRttMs < 5000) {
      this.rttMs = Math.round(this.rttMs * 0.6 + measuredRttMs * 0.4);
    }
  }

  public toJSON() {
    return {
      playerId: this.playerId,
      dbPlayerId: this.dbPlayerId,
      deviceId: this.deviceId,
      nickname: this.nickname,
      teamName: this.teamName,
      score: this.score,
      streak: this.streak,
      correctCount: this.correctCount,
      totalCorrectTimeMs: this.totalCorrectTimeMs,
      rank: this.rank,
      token: this.token,
      connected: this.connected,
      answers: Array.from(this.answers.entries())
    };
  }
}
