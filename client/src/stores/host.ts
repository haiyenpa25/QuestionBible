import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  RoomState,
  RoomOptions,
  LobbyPlayerItem,
  QuestionIntroHostPayload,
  QuestionRevealPayload,
  LeaderboardPayload,
  PodiumPayload,
  ScripturePayload,
  RemoteAnswerKeyPayload,
  HostSyncPayload
} from '@questionbible/shared';
import { getSocket } from '../socket';
import { soundManager } from '../utils/sound';
import { createServerCountdown } from '../utils/serverClock';

/**
 * control: bảng điều khiển trên laptop người dẫn (tạo phòng, đầy đủ nút bấm)
 * screen:  màn chiếu riêng cho máy chiếu (chỉ hình ảnh, không đáp án trước, không nút)
 * remote:  điện thoại điều khiển từ xa (ghép bằng QR chứa khoá bí mật)
 */
export type HostViewMode = 'control' | 'screen' | 'remote';

export const useHostStore = defineStore('host', () => {
  const viewMode = ref<HostViewMode>('control');
  const pin = ref<string>('');
  const roomId = ref<string>('');
  const remoteKey = ref<string>('');
  const quizTitle = ref<string>('');
  const totalQuestions = ref<number>(0);
  const state = ref<RoomState>('LOBBY');
  const locked = ref<boolean>(false);
  const paused = ref<boolean>(false);
  const players = ref<LobbyPlayerItem[]>([]);
  const options = ref<RoomOptions>({
    mode: 'classic',
    speedScoring: true,
    streakEnabled: true,
    friendlyMode: true,
    showQuestionOnPlayer: false,
    partialOrderScoring: true,
    randomBibleNickname: false,
    scriptureStep: true,
    openingPrayerOrVerse:
      '“Lời Chúa là ngọn đèn cho chân tôi, ánh sáng cho đường lối tôi.” — Thi Thiên 119:105',
    teams: ['Đội Đa-vít', 'Đội Môi-se', 'Đội Ghê-đê-ôn', 'Đội Đa-ni-ên']
  });

  const currentQuestion = ref<QuestionIntroHostPayload | null>(null);
  const answeredCount = ref<number>(0);
  const totalPlayersCount = ref<number>(0);
  const revealData = ref<QuestionRevealPayload | null>(null);
  const scriptureData = ref<ScripturePayload | null>(null);
  const leaderboardData = ref<LeaderboardPayload | null>(null);
  const podiumData = ref<PodiumPayload | null>(null);
  const answerKey = ref<RemoteAnswerKeyPayload | null>(null);
  const errorMsg = ref<string | null>(null);
  const attached = ref<boolean>(false);

  // Đồng hồ theo giờ server: không bị lệch khi tab/màn hình bị ngủ
  const countdown = createServerCountdown((sec) => {
    if (viewMode.value === 'remote') return; // Điện thoại điều khiển không phát tiếng tích tắc
    if (state.value === 'ANSWERING' && !paused.value && sec > 0) {
      soundManager.playTick(sec <= 5);
    }
  });
  const remainingSeconds = countdown.remainingSeconds;

  let listenersAttached = false;

  function applySync(sync: HostSyncPayload) {
    pin.value = sync.pin;
    quizTitle.value = sync.quizTitle;
    totalQuestions.value = sync.totalQuestions;
    state.value = sync.state;
    paused.value = sync.paused;
    players.value = sync.lobby.players;
    locked.value = sync.lobby.locked;
    options.value = sync.lobby.options;
    currentQuestion.value = sync.intro;
    revealData.value = sync.reveal;
    scriptureData.value = sync.scripture;
    leaderboardData.value = sync.leaderboard;
    podiumData.value = sync.podium;
    answeredCount.value = sync.answered;
    totalPlayersCount.value = sync.totalPlayers;
    if (sync.answerKey !== undefined) answerKey.value = sync.answerKey;

    if (sync.state === 'ANSWERING') {
      if (sync.paused || !sync.endsAt) countdown.freeze(sync.remainingMs);
      else countdown.start(sync.endsAt);
    } else {
      countdown.stop();
    }
  }

  function bindSocketListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    const socket = getSocket();
    const isAudible = () => viewMode.value !== 'remote';

    socket.on('lobby:update', (payload) => {
      if (isAudible() && payload.players.length > players.value.length) {
        soundManager.playPlayerJoin();
      }
      pin.value = payload.pin;
      quizTitle.value = payload.quizTitle;
      locked.value = payload.locked;
      players.value = payload.players;
      options.value = payload.options;
    });

    socket.on('question:intro', (payload) => {
      if (!('content' in payload) || !('introDurationMs' in payload)) return;
      soundManager.stopLobbyMusic();
      countdown.stop();
      state.value = 'QUESTION_INTRO';
      currentQuestion.value = payload;
      totalQuestions.value = payload.totalQuestions;
      revealData.value = null;
      scriptureData.value = null;
      answeredCount.value = 0;
      totalPlayersCount.value = players.value.length;
    });

    socket.on('remote:answer-key', (payload) => {
      answerKey.value = payload;
    });

    socket.on('question:start', (payload) => {
      state.value = 'ANSWERING';
      paused.value = false;
      countdown.start(payload.endsAt ?? Date.now() + payload.duration * 1000);
    });

    socket.on('room:paused', (payload) => {
      paused.value = payload.paused;
      if (payload.paused || !payload.endsAt) countdown.freeze(payload.remainingMs);
      else countdown.start(payload.endsAt);
    });

    socket.on('answer:count', (payload) => {
      answeredCount.value = payload.answered;
      totalPlayersCount.value = payload.total;
    });

    socket.on('question:reveal', (payload) => {
      countdown.stop();
      state.value = 'REVEAL';
      revealData.value = payload;
      if (isAudible()) soundManager.playReveal();
    });

    socket.on('scripture:show', (payload) => {
      countdown.stop();
      state.value = 'SCRIPTURE';
      scriptureData.value = payload;
    });

    socket.on('leaderboard', (payload) => {
      countdown.stop();
      state.value = 'LEADERBOARD';
      leaderboardData.value = payload;
    });

    socket.on('game:podium', (payload) => {
      countdown.stop();
      state.value = 'PODIUM';
      podiumData.value = payload;
      if (isAudible()) soundManager.playPodiumFanfare();
    });

    // Rớt mạng rồi kết nối lại: gắn lại đúng vai trò cũ & đồng bộ toàn bộ màn hình
    socket.on('connect', () => {
      if (!pin.value || !attached.value) return;
      if (viewMode.value === 'remote') {
        void attachAsRemote(pin.value, remoteKey.value);
      } else {
        void rejoin(pin.value, viewMode.value);
      }
    });
  }

  function resetGameData() {
    revealData.value = null;
    scriptureData.value = null;
    leaderboardData.value = null;
    podiumData.value = null;
    currentQuestion.value = null;
    answerKey.value = null;
  }

  function createRoom(
    quizId: number,
    customOptions?: Partial<RoomOptions>
  ): Promise<{ ok: boolean; pin?: string; error?: string }> {
    viewMode.value = 'control';
    bindSocketListeners();
    const socket = getSocket();

    return new Promise((resolve) => {
      socket.emit('host:create', { quizId, options: customOptions }, (res) => {
        if (!res.ok || !res.pin) {
          errorMsg.value = res.error ?? 'Không thể tạo phòng.';
          resolve({ ok: false, error: errorMsg.value });
          return;
        }
        pin.value = res.pin;
        roomId.value = res.roomId ?? '';
        remoteKey.value = res.remoteKey ?? '';
        quizTitle.value = res.quizTitle ?? '';
        totalQuestions.value = res.totalQuestions ?? 0;
        if (res.options) options.value = res.options;
        state.value = 'LOBBY';
        players.value = [];
        resetGameData();
        errorMsg.value = null;
        attached.value = true;
        resolve({ ok: true, pin: res.pin });
      });
    });
  }

  /** Bảng điều khiển tải lại / màn chiếu riêng: gắn vào phòng đang có bằng tài khoản đăng nhập */
  function rejoin(roomPin: string, mode: 'control' | 'screen'): Promise<{ ok: boolean; error?: string }> {
    viewMode.value = mode;
    bindSocketListeners();
    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit('host:rejoin', { pin: roomPin, role: mode }, (res) => {
        if (!res.ok) {
          errorMsg.value = res.error ?? 'Không thể kết nối lại phòng.';
          resolve({ ok: false, error: errorMsg.value });
          return;
        }
        roomId.value = res.roomId ?? roomId.value;
        if (res.remoteKey) remoteKey.value = res.remoteKey;
        if (res.sync) applySync(res.sync);
        errorMsg.value = null;
        attached.value = true;
        resolve({ ok: true });
      });
    });
  }

  /** Điện thoại điều khiển: ghép bằng PIN + khoá bí mật từ mã QR */
  function attachAsRemote(roomPin: string, key: string): Promise<{ ok: boolean; error?: string }> {
    viewMode.value = 'remote';
    bindSocketListeners();
    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit('remote:attach', { pin: roomPin, key }, (res) => {
        if (!res.ok || !res.sync) {
          errorMsg.value = res.error ?? 'Không thể ghép điện thoại điều khiển.';
          resolve({ ok: false, error: errorMsg.value });
          return;
        }
        remoteKey.value = key;
        applySync(res.sync);
        errorMsg.value = null;
        attached.value = true;
        resolve({ ok: true });
      });
    });
  }

  function updateOptions(partial: Partial<RoomOptions>) {
    options.value = { ...options.value, ...partial };
    getSocket().emit('host:update-options', { options: partial });
  }

  function toggleLock() {
    getSocket().emit('host:lock', { locked: !locked.value });
  }

  function kickPlayer(playerId: string) {
    getSocket().emit('host:kick', { playerId });
  }

  function startGame() {
    getSocket().emit('host:start', { pin: pin.value });
  }

  function nextPhase() {
    getSocket().emit('host:next', { pin: pin.value });
  }

  function skipPhase() {
    getSocket().emit('host:skip', { pin: pin.value });
  }

  function togglePause() {
    getSocket().emit('host:pause', { pin: pin.value });
  }

  function endGameEarly() {
    getSocket().emit('host:end', { pin: pin.value });
  }

  return {
    viewMode,
    pin,
    roomId,
    remoteKey,
    quizTitle,
    totalQuestions,
    state,
    locked,
    paused,
    players,
    options,
    currentQuestion,
    remainingSeconds,
    answeredCount,
    totalPlayersCount,
    revealData,
    scriptureData,
    leaderboardData,
    podiumData,
    answerKey,
    errorMsg,
    attached,
    createRoom,
    rejoin,
    attachAsRemote,
    updateOptions,
    toggleLock,
    kickPlayer,
    startGame,
    nextPhase,
    skipPhase,
    togglePause,
    endGameEarly
  };
});
