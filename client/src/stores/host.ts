import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  RoomState,
  RoomOptions,
  LobbyPlayerItem,
  QuestionIntroHostPayload,
  QuestionRevealPayload,
  LeaderboardPayload,
  PodiumPayload
} from '@questionbible/shared';
import { getSocket } from '../socket';
import { soundManager } from '../utils/sound';

export const useHostStore = defineStore('host', () => {
  const pin = ref<string>('');
  const roomId = ref<string>('');
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
    openingPrayerOrVerse:
      '“Lời Chúa là ngọn đèn cho chân tôi, ánh sáng cho đường lối tôi.” — Thi Thiên 119:105',
    teams: ['Đội Đa-vít', 'Đội Môi-se', 'Đội Ghê-đê-ôn', 'Đội Đa-ni-ên']
  });

  const currentQuestion = ref<QuestionIntroHostPayload | null>(null);
  const remainingSeconds = ref<number>(0);
  const answeredCount = ref<number>(0);
  const totalPlayersCount = ref<number>(0);
  const revealData = ref<QuestionRevealPayload | null>(null);
  const leaderboardData = ref<LeaderboardPayload | null>(null);
  const podiumData = ref<PodiumPayload | null>(null);
  const errorMsg = ref<string | null>(null);

  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let listenersAttached = false;

  function clearCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function startCountdown(seconds: number) {
    clearCountdown();
    remainingSeconds.value = seconds;
    countdownInterval = setInterval(() => {
      if (paused.value) return;
      if (remainingSeconds.value > 0) {
        remainingSeconds.value -= 1;
        soundManager.playTick(remainingSeconds.value <= 5);
      } else {
        clearCountdown();
      }
    }, 1000);
  }

  function bindSocketListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    const socket = getSocket();

    socket.on('lobby:update', (payload) => {
      if (payload.players.length > players.value.length) {
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
      clearCountdown();
      state.value = 'QUESTION_INTRO';
      currentQuestion.value = payload;
      revealData.value = null;
      answeredCount.value = 0;
      totalPlayersCount.value = players.value.length;
    });

    socket.on('question:start', (payload) => {
      state.value = 'ANSWERING';
      paused.value = false;
      startCountdown(payload.duration);
    });

    socket.on('room:paused', (payload) => {
      paused.value = payload.paused;
      remainingSeconds.value = Math.ceil(payload.remainingMs / 1000);
    });

    socket.on('answer:count', (payload) => {
      answeredCount.value = payload.answered;
      totalPlayersCount.value = payload.total;
    });

    socket.on('question:reveal', (payload) => {
      clearCountdown();
      state.value = 'REVEAL';
      revealData.value = payload;
      soundManager.playReveal();
    });

    socket.on('leaderboard', (payload) => {
      clearCountdown();
      state.value = 'LEADERBOARD';
      leaderboardData.value = payload;
    });

    socket.on('game:podium', (payload) => {
      clearCountdown();
      state.value = 'PODIUM';
      podiumData.value = payload;
      soundManager.playPodiumFanfare();
    });

    socket.on('connect', () => {
      if (pin.value) {
        socket.emit('host:rejoin', { pin: pin.value }, (res) => {
          if (res.ok && res.lobby) {
            players.value = res.lobby.players;
            locked.value = res.lobby.locked;
            if (res.state) state.value = res.state;
          }
        });
      }
    });
  }

  function createRoom(
    quizId: number,
    customOptions?: Partial<RoomOptions>
  ): Promise<{ ok: boolean; pin?: string; error?: string }> {
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
        quizTitle.value = res.quizTitle ?? '';
        totalQuestions.value = res.totalQuestions ?? 0;
        if (res.options) options.value = res.options;
        state.value = 'LOBBY';
        players.value = [];
        revealData.value = null;
        leaderboardData.value = null;
        podiumData.value = null;
        errorMsg.value = null;
        resolve({ ok: true, pin: res.pin });
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
    pin,
    roomId,
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
    leaderboardData,
    podiumData,
    errorMsg,
    createRoom,
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

