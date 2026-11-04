export type QuizQuestionType =
  | 'quiz'
  | 'true_false'
  | 'type_answer'
  | 'order'
  | 'slider'
  | 'poll';

export type RoomState =
  | 'LOBBY'
  | 'QUESTION_INTRO'
  | 'ANSWERING'
  | 'REVEAL'
  | 'LEADERBOARD'
  | 'PODIUM'
  | 'ENDED';

export type GameMode = 'classic' | 'team' | 'self_paced';

export interface RoomOptions {
  mode: GameMode;
  speedScoring: boolean; // Tắt điểm tốc độ (chế độ thiếu nhi)
  streakEnabled: boolean; // Bật/tắt chuỗi đúng liên tiếp
  friendlyMode: boolean; // Chỉ hiện top 5, người ngoài top 5 nhận lời khích lệ thân thiện
  showQuestionOnPlayer: boolean; // Hiện nội dung câu hỏi trên điện thoại cho người ngồi xa
  partialOrderScoring: boolean; // Chấm điểm từng phần cho câu sắp xếp (>= 50% vị trí đúng)
  randomBibleNickname: boolean; // Bắt buộc / gợi ý biệt danh nhân vật Kinh Thánh
  openingPrayerOrVerse?: string; // Câu Kinh Thánh / lời cầu nguyện mở đầu ở sảnh chờ
  teams?: string[];
}

export interface LobbyPlayerItem {
  playerId: string;
  nickname: string;
  teamName?: string | null;
  connected: boolean;
}

export interface LobbyUpdatePayload {
  pin: string;
  quizTitle: string;
  locked: boolean;
  playerCount: number;
  players: LobbyPlayerItem[];
  options: RoomOptions;
}

export interface QuestionOptionView {
  position: number; // Với câu order, đây là mã token tạm thời đã ẩn thứ tự thật (sửa lỗi #6)
  content: string;
}

export interface QuestionIntroHostPayload {
  q: number;
  totalQuestions: number;
  type: QuizQuestionType;
  content: string;
  imageUrl?: string | null;
  timeLimit: number;
  pointsFactor: number;
  bibleReference?: string | null;
  introDurationMs: number;
  options: QuestionOptionView[];
  sliderMin?: number | null;
  sliderMax?: number | null;
}

export interface QuestionIntroPlayerPayload {
  q: number;
  totalQuestions: number;
  type: QuizQuestionType;
  n: number;
  t: number;
  pointsFactor: number;
  content?: string;
  options?: QuestionOptionView[];
  sliderMin?: number | null;
  sliderMax?: number | null;
}

export interface QuestionStartPayload {
  q: number;
  duration: number;
  serverTime: number;
  options?: QuestionOptionView[];
}

export interface AnswerCountPayload {
  q: number;
  answered: number;
  total: number;
}

export interface QuestionRevealPayload {
  q: number;
  type: QuizQuestionType;
  content: string;
  correctPositions: number[];
  orderedCorrectContents?: string[]; // Thứ tự đúng cho câu order để hiển thị trên màn Host
  acceptedTexts?: string[];
  sliderAnswer?: number | null;
  sliderTolerance?: number | null;
  optionCounts: number[];
  totalAnswered: number;
  bibleReference?: string | null;
  verseText?: string | null;
  explanation?: string | null;
}

export interface PlayerResultPayload {
  q: number;
  correct: boolean;
  isPoll?: boolean;
  points: number;
  basePoints: number;
  streakBonus: number;
  total: number;
  rank: number | null; // null nếu friendlyMode ẩn thứ hạng thấp
  friendlyRankText?: string | null;
  totalPlayers: number;
  streak: number;
  bibleReference?: string | null;
  verseText?: string | null;
  explanation?: string | null;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  teamName?: string | null;
  score: number;
  streak: number;
  rank: number;
  previousRank?: number | null;
  rankDelta?: number;
}

export interface TeamLeaderboardEntry {
  teamName: string;
  averageScore: number;
  totalScore: number;
  memberCount: number;
  rank: number;
}

export interface LeaderboardPayload {
  q: number;
  totalQuestions: number;
  topPlayers: LeaderboardEntry[];
  topClimber?: {
    nickname: string;
    climbed: number;
  } | null;
  teamStandings?: TeamLeaderboardEntry[];
}

export interface PodiumPayload {
  sessionId: number;
  quizTitle: string;
  top3: LeaderboardEntry[];
  top5: LeaderboardEntry[];
  teamStandings?: TeamLeaderboardEntry[];
  totalPlayers: number;
  totalQuestions: number;
  personalResult?: {
    rank: number | null;
    friendlyRankText?: string | null;
    score: number;
    correctCount: number;
    totalQuestions: number;
  };
}

export interface HostCreateAck {
  ok: boolean;
  pin?: string;
  roomId?: string;
  quizTitle?: string;
  totalQuestions?: number;
  options?: RoomOptions;
  error?: string;
}

export interface PlayerJoinAck {
  ok: boolean;
  playerId?: string;
  token?: string;
  nickname?: string;
  teamName?: string | null;
  quizTitle?: string;
  state?: RoomState;
  options?: RoomOptions;
  score?: number;
  streak?: number;
  suggestions?: string[]; // Gợi ý 3 tên khi bị trùng biệt danh (mục 6.4 roadmaps.md)
  error?: string;
}

export interface PlayerAnswerPayload {
  q: number;
  choice?: number | number[];
  text?: string;
  order?: number[];
  value?: number;
}

export interface ClientToServerEvents {
  'host:create': (
    data: { quizId: number; options?: Partial<RoomOptions> },
    ack: (res: HostCreateAck) => void
  ) => void;
  'host:rejoin': (
    data: { pin: string },
    ack: (res: HostCreateAck & { state?: RoomState; lobby?: LobbyUpdatePayload }) => void
  ) => void;
  'host:start': (data: { pin?: string }) => void;
  'host:next': (data: { pin?: string }) => void;
  'host:skip': (data: { pin?: string }) => void;
  'host:pause': (data: { pin?: string }) => void;
  'host:end': (data: { pin?: string }) => void;
  'host:kick': (data: { playerId: string; banDevice?: boolean }) => void;
  'host:lock': (data: { locked: boolean }) => void;
  'host:update-options': (data: { options: Partial<RoomOptions> }) => void;

  'player:join': (
    data: { pin: string; nickname: string; teamName?: string; deviceId?: string },
    ack: (res: PlayerJoinAck) => void
  ) => void;
  'player:rejoin': (
    data: { pin: string; token: string; deviceId?: string },
    ack: (res: PlayerJoinAck) => void
  ) => void;
  'player:answer': (
    data: PlayerAnswerPayload,
    ack?: (res: { received: boolean; error?: string }) => void
  ) => void;

  'rtt:ping': (clientTimestamp: number, ack: (serverTimestamp: number) => void) => void;
}

export interface ServerToClientEvents {
  'lobby:update': (payload: LobbyUpdatePayload) => void;
  'question:intro': (payload: QuestionIntroHostPayload | QuestionIntroPlayerPayload) => void;
  'question:start': (payload: QuestionStartPayload) => void;
  'room:paused': (payload: { paused: boolean; remainingMs: number }) => void;
  'answer:count': (payload: AnswerCountPayload) => void;
  'answer:ack': (payload: { received: boolean; q: number }) => void;
  'question:reveal': (payload: QuestionRevealPayload) => void;
  'player:result': (payload: PlayerResultPayload) => void;
  'leaderboard': (payload: LeaderboardPayload) => void;
  'game:podium': (payload: PodiumPayload) => void;
  'player:kicked': (payload: { reason: string }) => void;
  'room:error': (payload: { message: string }) => void;
  'server:rtt-ping': (sentAt: number, ack: () => void) => void;
}
