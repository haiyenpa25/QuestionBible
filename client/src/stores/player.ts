import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  RoomState,
  RoomOptions,
  QuestionIntroPlayerPayload,
  PlayerResultPayload,
  PodiumPayload,
  PlayerAnswerPayload,
  ScripturePayload
} from '@questionbible/shared';
import { getSocket } from '../socket';
import { createServerCountdown } from '../utils/serverClock';

const STORAGE_PIN_KEY = 'qb_player_pin';
const STORAGE_TOKEN_KEY = 'qb_player_token';
const STORAGE_NICK_KEY = 'qb_player_nickname';
const STORAGE_DEVICE_KEY = 'qb_device_id';

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(STORAGE_DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_DEVICE_KEY, id);
  }
  return id;
}

export const usePlayerStore = defineStore('player', () => {
  const deviceId = ref(getOrCreateDeviceId());
  const joined = ref(false);
  const pin = ref(localStorage.getItem(STORAGE_PIN_KEY) ?? '');
  const token = ref(localStorage.getItem(STORAGE_TOKEN_KEY) ?? '');
  const playerId = ref('');
  const nickname = ref(localStorage.getItem(STORAGE_NICK_KEY) ?? '');
  const teamName = ref<string | null>(null);
  const quizTitle = ref('');
  const state = ref<RoomState>('LOBBY');
  const options = ref<RoomOptions | null>(null);
  const paused = ref(false);

  const score = ref(0);
  const streak = ref(0);
  const rank = ref<number | null>(1);

  const currentQuestion = ref<QuestionIntroPlayerPayload | null>(null);
  // Đồng hồ theo giờ server: tắt màn hình / chuyển app rồi mở lại vẫn hiện đúng số giây
  const countdown = createServerCountdown();
  const remainingSeconds = countdown.remainingSeconds;
  const scriptureData = ref<ScripturePayload | null>(null);
  const hasSubmitted = ref(false);
  const lastResult = ref<PlayerResultPayload | null>(null);
  const podiumData = ref<PodiumPayload | null>(null);
  const kickedReason = ref<string | null>(null);
  const errorMsg = ref<string | null>(null);
  const nameSuggestions = ref<string[]>([]);

  let listenersAttached = false;
  let wakeLockSentinel: WakeLockSentinel | null = null;

  function vibrate(pattern: number | number[]) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // ignore
    }
  }

  async function requestWakeLock() {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
      }
    } catch {
      // ignore
    }
  }

  function clearTimer() {
    countdown.stop();
  }

  function bindSocketListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    const socket = getSocket();

    socket.on('question:intro', (payload) => {
      if (!('n' in payload)) return;
      clearTimer();
      paused.value = false;
      state.value = 'QUESTION_INTRO';
      currentQuestion.value = payload;
      hasSubmitted.value = false;
      lastResult.value = null;
      scriptureData.value = null;
      vibrate(40);
    });

    socket.on('question:start', (payload) => {
      state.value = 'ANSWERING';
      paused.value = false;
      if (currentQuestion.value && payload.options) {
        currentQuestion.value.options = payload.options;
      }
      countdown.start(payload.endsAt ?? Date.now() + payload.duration * 1000);
      vibrate([50, 40, 50]);
    });

    // Sửa lỗi #13: Đồng bộ trạng thái tạm dừng từ Host xuống điện thoại người chơi
    socket.on('room:paused', (payload) => {
      paused.value = payload.paused;
      if (payload.paused || !payload.endsAt) countdown.freeze(payload.remainingMs);
      else countdown.start(payload.endsAt);
    });

    socket.on('scripture:show', (payload) => {
      clearTimer();
      state.value = 'SCRIPTURE';
      scriptureData.value = payload;
      vibrate(30);
    });

    socket.on('answer:ack', (payload) => {
      if (payload.received) {
        hasSubmitted.value = true;
      }
    });

    socket.on('player:result', (payload) => {
      clearTimer();
      paused.value = false;
      state.value = 'REVEAL';
      lastResult.value = payload;
      score.value = payload.total;
      streak.value = payload.streak;
      rank.value = payload.rank;
      vibrate(payload.correct ? [60, 50, 90] : [180]);
    });

    socket.on('game:podium', (payload) => {
      clearTimer();
      paused.value = false;
      state.value = 'PODIUM';
      podiumData.value = payload;
      // Giữ token để tải lại trang vẫn xem lại được kết quả cá nhân; xoá khi bấm "Chơi trận khác"
      vibrate([100, 60, 100, 60, 200]);
    });

    socket.on('player:kicked', (payload) => {
      clearTimer();
      joined.value = false;
      kickedReason.value = payload.reason;
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    });

    socket.on('connect', () => {
      if (joined.value && pin.value && token.value) {
        socket.emit(
          'player:rejoin',
          { pin: pin.value, token: token.value, deviceId: deviceId.value },
          (res) => {
            if (res.ok) {
              if (res.state) state.value = res.state;
              if (typeof res.score === 'number') score.value = res.score;
              if (typeof res.streak === 'number') streak.value = res.streak;
            }
          }
        );
      }
    });
  }

  function joinRoom(params: {
    pin: string;
    nickname: string;
    teamName?: string;
  }): Promise<{ ok: boolean; suggestions?: string[]; error?: string }> {
    bindSocketListeners();
    const socket = getSocket();

    return new Promise((resolve) => {
      socket.emit(
        'player:join',
        {
          ...params,
          deviceId: deviceId.value
        },
        (res) => {
          if (!res.ok || !res.token || !res.playerId) {
            errorMsg.value = res.error ?? 'Không thể tham gia phòng.';
            nameSuggestions.value = res.suggestions ?? [];
            resolve({
              ok: false,
              suggestions: res.suggestions,
              error: errorMsg.value
            });
            return;
          }

          joined.value = true;
          pin.value = params.pin.trim();
          token.value = res.token;
          playerId.value = res.playerId;
          nickname.value = res.nickname ?? params.nickname;
          teamName.value = res.teamName ?? null;
          quizTitle.value = res.quizTitle ?? '';
          state.value = res.state ?? 'LOBBY';
          options.value = res.options ?? null;
          score.value = res.score ?? 0;
          streak.value = res.streak ?? 0;
          kickedReason.value = null;
          errorMsg.value = null;
          nameSuggestions.value = [];

          localStorage.setItem(STORAGE_PIN_KEY, pin.value);
          localStorage.setItem(STORAGE_TOKEN_KEY, token.value);
          localStorage.setItem(STORAGE_NICK_KEY, nickname.value);

          void requestWakeLock();
          resolve({ ok: true });
        }
      );
    });
  }

  function tryAutoRejoin(): Promise<boolean> {
    bindSocketListeners();
    if (!pin.value || !token.value) return Promise.resolve(false);
    const socket = getSocket();

    return new Promise((resolve) => {
      socket.emit(
        'player:rejoin',
        { pin: pin.value, token: token.value, deviceId: deviceId.value },
        (res) => {
          if (!res.ok || !res.playerId) {
            localStorage.removeItem(STORAGE_TOKEN_KEY);
            resolve(false);
            return;
          }
          joined.value = true;
          playerId.value = res.playerId;
          nickname.value = res.nickname ?? nickname.value;
          teamName.value = res.teamName ?? null;
          quizTitle.value = res.quizTitle ?? '';
          state.value = res.state ?? 'LOBBY';
          options.value = res.options ?? null;
          score.value = res.score ?? 0;
          streak.value = res.streak ?? 0;
          void requestWakeLock();
          resolve(true);
        }
      );
    });
  }

  function submitAnswer(payload: Omit<PlayerAnswerPayload, 'q'>) {
    if (!currentQuestion.value || hasSubmitted.value || paused.value) return;
    hasSubmitted.value = true;
    vibrate(30);
    getSocket().emit(
      'player:answer',
      {
        q: currentQuestion.value.q,
        ...payload
      },
      (res) => {
        if (!res.received) {
          hasSubmitted.value = false;
        }
      }
    );
  }

  function leaveRoom() {
    clearTimer();
    joined.value = false;
    token.value = '';
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    if (wakeLockSentinel) {
      void wakeLockSentinel.release().catch(() => {});
      wakeLockSentinel = null;
    }
  }

  return {
    deviceId,
    joined,
    pin,
    token,
    playerId,
    nickname,
    teamName,
    quizTitle,
    state,
    options,
    paused,
    score,
    streak,
    rank,
    currentQuestion,
    remainingSeconds,
    scriptureData,
    hasSubmitted,
    lastResult,
    podiumData,
    kickedReason,
    errorMsg,
    nameSuggestions,
    joinRoom,
    tryAutoRejoin,
    submitAnswer,
    leaveRoom
  };
});
