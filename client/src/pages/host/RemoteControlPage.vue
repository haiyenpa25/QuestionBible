<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHostStore } from '../../stores/host';

/**
 * Điện thoại điều khiển (remote): người dẫn đứng trên bục cầm điện thoại bấm "Tiếp",
 * xem trước đáp án & ghi chú riêng. Máy chiếu chỉ hiện màn chiếu sạch.
 */
const route = useRoute();
const router = useRouter();
const host = useHostStore();

const connecting = ref(true);
const confirmEnd = ref(false);
const pin = String(route.params.pin ?? '');
const STORAGE_KEY = `qb_remote_key_${pin}`;

const phaseLabel = computed(() => {
  switch (host.state) {
    case 'LOBBY':
      return 'Sảnh chờ';
    case 'QUESTION_INTRO':
      return 'Đang đọc câu hỏi';
    case 'ANSWERING':
      return host.paused ? 'Đang tạm dừng' : 'Đang trả lời';
    case 'REVEAL':
      return 'Đã mở đáp án';
    case 'SCRIPTURE':
      return 'Chia sẻ Lời Chúa';
    case 'LEADERBOARD':
      return 'Bảng xếp hạng';
    default:
      return 'Đã kết thúc';
  }
});

const isLastQuestion = computed(() =>
  host.currentQuestion ? host.currentQuestion.q + 1 >= host.currentQuestion.totalQuestions : false
);

const primaryAction = computed<{ label: string; run: () => void; disabled?: boolean } | null>(() => {
  switch (host.state) {
    case 'LOBBY':
      return {
        label: `▶ Bắt đầu (${host.players.length} người)`,
        run: () => host.startGame(),
        disabled: host.players.length === 0
      };
    case 'QUESTION_INTRO':
      return { label: 'Mở trả lời ngay →', run: () => host.skipPhase() };
    case 'ANSWERING':
      return { label: 'Hiện đáp án →', run: () => host.skipPhase() };
    case 'REVEAL': {
      const hasScripture = Boolean(host.revealData?.verseText || host.revealData?.explanation);
      if (host.options.scriptureStep && hasScripture) {
        return { label: '📖 Chia sẻ Lời Chúa →', run: () => host.nextPhase() };
      }
      return { label: isLastQuestion.value ? '🏆 Bục vinh danh →' : 'Bảng xếp hạng →', run: () => host.nextPhase() };
    }
    case 'SCRIPTURE':
      return { label: isLastQuestion.value ? '🏆 Bục vinh danh →' : 'Bảng xếp hạng →', run: () => host.nextPhase() };
    case 'LEADERBOARD':
      return { label: 'Câu tiếp theo →', run: () => host.nextPhase() };
    default:
      return null;
  }
});

function vibrate() {
  try {
    navigator.vibrate?.(30);
  } catch {
    // ignore
  }
}

function runPrimary() {
  if (!primaryAction.value || primaryAction.value.disabled) return;
  vibrate();
  primaryAction.value.run();
}

function endGame() {
  if (!confirmEnd.value) {
    confirmEnd.value = true;
    setTimeout(() => (confirmEnd.value = false), 4000);
    return;
  }
  confirmEnd.value = false;
  host.endGameEarly();
}

onMounted(async () => {
  let key = typeof route.query.key === 'string' ? route.query.key : '';
  try {
    if (key) sessionStorage.setItem(STORAGE_KEY, key);
    else key = sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // ignore
  }
  // Xoá khoá khỏi thanh địa chỉ để không bị lộ khi đưa máy cho người khác xem
  if (route.query.key) void router.replace({ query: {} });

  if (!key) {
    host.errorMsg = 'Thiếu mã điều khiển. Hãy quét lại mã QR trên máy người dẫn.';
    connecting.value = false;
    return;
  }
  await host.attachAsRemote(pin, key);
  connecting.value = false;
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100 select-none">
    <header class="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <span class="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-black text-xs">📱 ĐIỀU KHIỂN</span>
        <span class="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-black text-xs">PIN {{ pin }}</span>
      </div>
      <span class="text-xs font-bold text-slate-300">👥 {{ host.players.length }}</span>
    </header>

    <main v-if="connecting" class="flex-1 flex items-center justify-center p-6 text-slate-400">
      Đang ghép với phòng chơi...
    </main>

    <main v-else-if="!host.attached" class="flex-1 flex items-center justify-center p-6">
      <div role="alert" class="max-w-sm rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-semibold text-red-200 text-center">
        {{ host.errorMsg || 'Không thể ghép điện thoại điều khiển.' }}
      </div>
    </main>

    <main v-else class="flex-1 flex flex-col p-4 gap-3">
      <!-- Trạng thái + đồng hồ -->
      <div class="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 px-4 py-3">
        <div>
          <p class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{{ phaseLabel }}</p>
          <p v-if="host.currentQuestion && host.state !== 'LOBBY'" class="text-lg font-black text-white">
            Câu {{ host.currentQuestion.q + 1 }} / {{ host.currentQuestion.totalQuestions }}
          </p>
          <p v-else class="text-lg font-black text-white truncate">{{ host.quizTitle }}</p>
        </div>
        <div class="text-right">
          <p
            v-if="host.state === 'ANSWERING'"
            class="text-3xl font-black"
            :class="host.paused ? 'text-amber-300' : host.remainingSeconds <= 5 ? 'text-red-400' : 'text-amber-400'"
          >
            {{ host.paused ? '⏸' : '' }}{{ host.remainingSeconds }}s
          </p>
          <p v-if="host.state === 'QUESTION_INTRO' || host.state === 'ANSWERING'" class="text-xs font-bold text-slate-300">
            Đã trả lời {{ host.answeredCount }}/{{ host.totalPlayersCount }}
          </p>
        </div>
      </div>

      <!-- Nội dung câu hỏi + đáp án trước + ghi chú người dẫn -->
      <div
        v-if="host.currentQuestion && host.state !== 'LOBBY' && host.state !== 'PODIUM'"
        class="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3"
      >
        <p class="text-base font-bold text-white leading-snug">{{ host.currentQuestion.content }}</p>
        <p
          v-if="host.answerKey && host.answerKey.q === host.currentQuestion.q"
          class="rounded-lg bg-emerald-950/70 border border-emerald-500/40 p-3 text-sm text-emerald-200"
        >
          <strong>✓ Đáp án:</strong> {{ host.answerKey.correctText }}
        </p>
        <p
          v-if="host.answerKey?.hostNotes && host.answerKey.q === host.currentQuestion.q"
          class="rounded-lg bg-sky-950/70 border border-sky-500/40 p-3 text-sm text-sky-100 whitespace-pre-line"
        >
          <strong>📝 Ghi chú:</strong> {{ host.answerKey.hostNotes }}
        </p>
        <p
          v-if="host.state === 'REVEAL' && host.revealData"
          class="text-xs font-semibold text-slate-300"
        >
          {{ host.revealData.totalAnswered }} người đã trả lời câu này.
        </p>
      </div>

      <!-- Câu gốc đang chiếu -->
      <div
        v-if="host.state === 'SCRIPTURE' && host.scriptureData"
        class="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-2"
      >
        <p v-if="host.scriptureData.bibleReference" class="text-xs font-extrabold text-amber-300 uppercase">
          📖 {{ host.scriptureData.bibleReference }}
        </p>
        <p v-if="host.scriptureData.verseText" class="font-serif italic text-sm text-amber-50">
          “{{ host.scriptureData.verseText }}”
        </p>
        <p v-if="host.scriptureData.explanation" class="text-xs text-slate-200">💡 {{ host.scriptureData.explanation }}</p>
      </div>

      <!-- Top 5 -->
      <div
        v-if="host.state === 'LEADERBOARD' && host.leaderboardData"
        class="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1.5"
      >
        <div
          v-for="item in host.leaderboardData.topPlayers"
          :key="item.playerId"
          class="flex items-center justify-between text-sm"
        >
          <span class="font-bold text-white truncate">#{{ item.rank }} {{ item.nickname }}</span>
          <span class="font-black text-amber-400">{{ item.score.toLocaleString('vi-VN') }}</span>
        </div>
      </div>

      <div
        v-if="host.state === 'PODIUM' && host.podiumData"
        class="rounded-xl bg-slate-900 border border-amber-500/40 p-4 space-y-1.5 text-center"
      >
        <p class="text-sm font-bold text-amber-300">🏆 Trận đấu đã kết thúc</p>
        <p v-for="(item, idx) in host.podiumData.top3" :key="item.playerId" class="text-base font-bold text-white">
          {{ ['🥇', '🥈', '🥉'][idx] }} {{ item.nickname }} — {{ item.score.toLocaleString('vi-VN') }}
        </p>
      </div>

      <div class="flex-1" />

      <!-- Nút phụ -->
      <div class="grid grid-cols-2 gap-3">
        <button
          v-if="host.state === 'LOBBY'"
          type="button"
          class="rounded-xl border py-3 text-sm font-bold"
          :class="host.locked ? 'border-red-500/50 bg-red-500/20 text-red-200' : 'border-slate-700 bg-slate-800 text-slate-200'"
          @click="host.toggleLock()"
        >
          {{ host.locked ? '🔒 Đã khoá phòng' : '🔓 Khoá phòng' }}
        </button>
        <button
          v-if="host.state === 'ANSWERING'"
          type="button"
          class="rounded-xl border border-amber-500/40 bg-amber-500/15 py-3 text-sm font-bold text-amber-200"
          @click="host.togglePause()"
        >
          {{ host.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng' }}
        </button>
        <button
          v-if="host.state !== 'LOBBY' && host.state !== 'PODIUM'"
          type="button"
          class="rounded-xl border py-3 text-sm font-bold"
          :class="confirmEnd ? 'border-red-400 bg-red-600 text-white' : 'border-red-500/40 bg-red-500/10 text-red-300'"
          @click="endGame"
        >
          {{ confirmEnd ? 'Bấm lần nữa để kết thúc' : 'Kết thúc sớm' }}
        </button>
      </div>

      <!-- Nút chính: to, dễ bấm bằng ngón cái -->
      <button
        v-if="primaryAction"
        type="button"
        :disabled="primaryAction.disabled"
        class="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-300 disabled:opacity-40 py-7 text-2xl font-black text-slate-950 shadow-xl"
        @click="runPrimary"
      >
        {{ primaryAction.label }}
      </button>
    </main>
  </div>
</template>
