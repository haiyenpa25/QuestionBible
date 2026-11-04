<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { useHostStore } from '../../stores/host';
import { soundManager } from '../../utils/sound';
import ShapeIcon from '../../components/ShapeIcon.vue';
import ScriptureSpotlightModal from '../../components/ScriptureSpotlightModal.vue';

const route = useRoute();
const router = useRouter();
const host = useHostStore();

const qrDataUrl = ref<string>('');
const soundMuted = ref<boolean>(soundManager.muted);
const showSettingsPanel = ref<boolean>(false);
const showScriptureModal = ref<boolean>(false);
const playJoinUrl = ref<string>('');

const TILE_COLORS = [
  'bg-answer-red border-red-800',
  'bg-answer-blue border-blue-800',
  'bg-answer-amber border-amber-800',
  'bg-answer-green border-green-800'
];

async function generateQrForPin(pin: string) {
  if (!pin) return;
  const url = `${window.location.origin}/play?pin=${pin}`;
  playJoinUrl.value = url;
  try {
    qrDataUrl.value = await QRCode.toDataURL(url, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      }
    });
  } catch {
    qrDataUrl.value = '';
  }
}

watch(
  () => host.pin,
  (newPin) => {
    if (newPin) {
      void generateQrForPin(newPin);
    }
  },
  { immediate: true }
);

watch(
  () => host.state,
  (newState) => {
    if (newState === 'PODIUM') {
      try {
        confetti({
          particleCount: 110,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore
      }
    }
  }
);

function toggleSound() {
  soundMuted.value = soundManager.toggleMute();
  if (!soundMuted.value && host.state === 'LOBBY') {
    soundManager.startLobbyMusic();
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen().catch(() => {});
  } else {
    void document.exitFullscreen().catch(() => {});
  }
}

function downloadExcelReport() {
  const sessionId = host.podiumData?.sessionId;
  if (!sessionId) return;
  window.open(`/api/reports/${sessionId}/export`, '_blank');
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showScriptureModal.value) {
    showScriptureModal.value = false;
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  const quizId = Number(route.params.quizId);
  if (quizId) {
    const res = await host.createRoom(quizId);
    if (res.ok && !soundMuted.value) {
      soundManager.startLobbyMusic();
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  soundManager.stopLobbyMusic();
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
    <!-- Thanh điều khiển Người Dẫn (Host Control Bar) -->
    <header class="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
      <div class="flex items-center gap-4 min-w-0">
        <router-link
          to="/studio"
          class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 shrink-0"
        >
          ← Kho câu hỏi
        </router-link>

        <div v-if="host.pin" class="flex items-center gap-2.5 shrink-0">
          <span class="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-sm tracking-wider">
            PIN: {{ host.pin }}
          </span>
          <span class="px-3 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold text-xs">
            👥 {{ host.players.length }} người chơi
          </span>
        </div>

        <h1 class="hidden lg:block text-sm font-bold text-slate-300 truncate">
          {{ host.quizTitle }}
        </h1>
      </div>

      <!-- Các nút điều khiển nhịp trận đấu -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          @click="toggleSound"
        >
          {{ soundMuted ? '🔇 Bật âm' : '🔊 Đang bật âm' }}
        </button>

        <button
          v-if="host.state === 'LOBBY'"
          type="button"
          class="px-3 py-2 rounded-lg border text-xs font-bold transition-colors"
          :class="host.locked ? 'border-red-500/50 bg-red-500/20 text-red-300' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'"
          @click="host.toggleLock()"
        >
          {{ host.locked ? '🔒 Đã khóa phòng' : '🔓 Khóa phòng' }}
        </button>

        <button
          type="button"
          class="hidden sm:inline-flex px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          @click="toggleFullscreen"
        >
          ⛶ Toàn màn hình
        </button>

        <!-- Nút điều khiển theo trạng thái -->
        <button
          v-if="host.state === 'LOBBY'"
          type="button"
          :disabled="host.players.length === 0"
          class="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-sm transition-colors"
          @click="host.startGame()"
        >
          ▶ Bắt Đầu Trận Đấu
        </button>

        <template v-else-if="host.state === 'QUESTION_INTRO' || host.state === 'ANSWERING'">
          <button
            v-if="host.state === 'ANSWERING'"
            type="button"
            class="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-300 text-xs font-bold"
            @click="host.togglePause()"
          >
            {{ host.paused ? '▶ Tiếp tục đếm giờ' : '⏸ Tạm dừng' }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs"
            @click="host.skipPhase()"
          >
            {{ host.state === 'QUESTION_INTRO' ? 'Mở Đáp Án Ngay →' : 'Hiện Đáp Án (Bỏ qua giờ) →' }}
          </button>
        </template>

        <template v-else-if="host.state === 'REVEAL' || host.state === 'LEADERBOARD'">
          <button
            type="button"
            class="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm"
            @click="host.nextPhase()"
          >
            {{ host.state === 'REVEAL' ? 'Bảng Xếp Hạng →' : 'Câu Tiếp Theo →' }}
          </button>
        </template>

        <button
          v-if="host.state !== 'LOBBY' && host.state !== 'PODIUM'"
          type="button"
          class="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold"
          @click="host.endGameEarly()"
        >
          Kết thúc sớm
        </button>
      </div>
    </header>

    <!-- 1. SẢNH CHỜ (LOBBY) -->
    <main
      v-if="host.state === 'LOBBY'"
      class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col gap-6"
    >
      <!-- Banner PIN + QR Code + Lời Cầu Nguyện / Câu Kinh Thánh Mở Đầu -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div class="lg:col-span-8 rounded-2xl border-2 border-amber-500/40 bg-slate-900 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span class="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold uppercase tracking-wider">
                Bước 1: Mở điện thoại truy cập {{ playJoinUrl || '/play' }}
              </span>
              <button
                type="button"
                class="text-xs font-bold text-amber-400 hover:text-amber-300 underline"
                @click="showSettingsPanel = !showSettingsPanel"
              >
                ⚙️ {{ showSettingsPanel ? 'Ẩn cấu hình phòng' : 'Tuỳ chỉnh chế độ chơi & mục vụ' }}
              </button>
            </div>

            <p class="text-sm text-slate-400 uppercase font-bold tracking-widest">
              Mã PIN Tham Gia Phòng Chơi:
            </p>
            <div class="text-6xl sm:text-8xl font-black tracking-[0.18em] text-amber-400 my-2 select-all">
              {{ host.pin || '------' }}
            </div>
          </div>

          <!-- Câu Kinh Thánh / Lời cầu nguyện mở đầu -->
          <div class="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
              📖 Câu gốc / Tâm tình mở đầu buổi sinh hoạt:
            </p>
            <p class="font-serif italic text-base sm:text-xl text-amber-50">
              {{ host.options.openingPrayerOrVerse }}
            </p>
          </div>
        </div>

        <!-- QR Code quét nhanh -->
        <div class="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col items-center justify-center text-center">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
            Hoặc Quét Mã QR Để Vào Ngay
          </p>
          <div v-if="qrDataUrl" class="p-3 bg-white rounded-2xl shadow-lg">
            <img :src="qrDataUrl" alt="QR Code vào phòng chơi" class="w-48 h-48" />
          </div>
          <p class="text-xs text-slate-400 mt-3">
            Không cần cài ứng dụng — Hỗ trợ 4G & Wi-Fi
          </p>
        </div>
      </div>

      <!-- Bảng tuỳ chỉnh chế độ chơi (Thiếu nhi, Đội, Thân thiện...) -->
      <div
        v-if="showSettingsPanel"
        class="rounded-2xl border border-amber-500/30 bg-slate-900 p-6 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="!host.options.speedScoring"
            class="mt-1 w-4 h-4 accent-amber-500"
            @change="host.updateOptions({ speedScoring: !host.options.speedScoring })"
          />
          <div>
            <span class="block text-sm font-bold text-white">Chế độ Thiếu nhi (Tắt điểm tốc độ)</span>
            <span class="text-xs text-slate-400">Trả lời đúng nhận đủ 1.000 điểm, giúp các em không bị áp lực thời gian.</span>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="host.options.showQuestionOnPlayer"
            class="mt-1 w-4 h-4 accent-amber-500"
            @change="host.updateOptions({ showQuestionOnPlayer: !host.options.showQuestionOnPlayer })"
          />
          <div>
            <span class="block text-sm font-bold text-white">Hiện câu hỏi trên điện thoại</span>
            <span class="text-xs text-slate-400">Hỗ trợ tín hữu ngồi xa màn hình máy chiếu vẫn đọc rõ câu hỏi.</span>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="host.options.mode === 'team'"
            class="mt-1 w-4 h-4 accent-amber-500"
            @change="host.updateOptions({ mode: host.options.mode === 'team' ? 'classic' : 'team' })"
          />
          <div>
            <span class="block text-sm font-bold text-white">Chế độ Đội / Ban ngành (Team Mode)</span>
            <span class="text-xs text-slate-400">Tính điểm trung bình theo từng Đội/Tổ ngoài bảng xếp hạng cá nhân.</span>
          </div>
        </label>
      </div>

      <!-- Danh sách người chơi đã vào sảnh chờ -->
      <div class="flex-1 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-extrabold text-white">
            Danh Sách Người Chơi Đã Vào Phòng ({{ host.players.length }})
          </h2>
          <span class="text-xs text-slate-400">
            Bấm vào dấu ✕ cạnh tên để mời người chơi có biệt danh không phù hợp ra khỏi phòng
          </span>
        </div>

        <div
          v-if="host.players.length === 0"
          class="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400"
        >
          <p class="text-lg font-bold text-slate-300">Đang chờ người chơi đầu tiên tham gia...</p>
          <p class="text-xs mt-1">Bạn có thể mở tab mới tại địa chỉ <code class="text-amber-400">/play?pin={{ host.pin }}</code> để thử ngay!</p>
        </div>

        <div v-else class="flex flex-wrap gap-2.5">
          <div
            v-for="p in host.players"
            :key="p.playerId"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-bold text-white"
          >
            <span
              class="w-2 h-2 rounded-full"
              :class="p.connected ? 'bg-emerald-400' : 'bg-slate-500'"
            />
            <span>{{ p.nickname }}</span>
            <span
              v-if="p.teamName"
              class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px]"
            >
              {{ p.teamName }}
            </span>
            <button
              type="button"
              class="ml-1 text-slate-400 hover:text-red-400 font-black"
              :title="`Mời ${p.nickname} rời phòng`"
              @click="host.kickPlayer(p.playerId)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- 2. ĐANG HIỆN CÂU HỎI & ĐẾM NGƯỢC (QUESTION_INTRO & ANSWERING) -->
    <main
      v-else-if="(host.state === 'QUESTION_INTRO' || host.state === 'ANSWERING') && host.currentQuestion"
      class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-between gap-6"
    >
      <!-- Thông tin đầu câu hỏi -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="px-4 py-1.5 rounded-xl bg-slate-800 text-amber-400 font-black text-base">
            Câu {{ host.currentQuestion.q + 1 }} / {{ host.currentQuestion.totalQuestions }}
          </span>
          <span
            v-if="host.currentQuestion.bibleReference"
            class="px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-sm"
          >
            📖 {{ host.currentQuestion.bibleReference }}
          </span>
          <span
            v-if="host.currentQuestion.pointsFactor === 2"
            class="px-4 py-1.5 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 font-extrabold text-sm"
          >
            ⚡ Nhân Đôi Điểm (x2)
          </span>
        </div>

        <div class="flex items-center gap-4">
          <div class="rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-center">
            <span class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold">Đã trả lời</span>
            <span class="text-2xl font-black text-white">
              {{ host.answeredCount }} <span class="text-sm text-slate-400">/ {{ host.totalPlayersCount }}</span>
            </span>
          </div>

          <div
            class="w-20 h-20 rounded-2xl border-4 flex flex-col items-center justify-center font-black text-3xl"
            :class="host.remainingSeconds <= 5 && host.state === 'ANSWERING' ? 'border-red-500 bg-red-500/20 text-red-300 animate-pulse' : 'border-amber-400 bg-slate-900 text-amber-400'"
          >
            {{ host.state === 'QUESTION_INTRO' ? '...' : `${host.remainingSeconds}s` }}
          </div>
        </div>
      </div>

      <!-- Nội dung câu hỏi chính trên màn chiếu -->
      <div class="rounded-3xl border-2 border-slate-800 bg-slate-900 p-8 sm:p-12 text-center shadow-2xl my-auto">
        <p class="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-snug">
          {{ host.currentQuestion.content }}
        </p>

        <img
          v-if="host.currentQuestion.imageUrl"
          :src="host.currentQuestion.imageUrl"
          alt="Hình minh hoạ câu hỏi"
          class="max-h-64 mx-auto mt-6 rounded-2xl object-contain border border-slate-700"
        />
      </div>

      <!-- 4 Ô Phương Án Trả Lời trên màn hình lớn -->
      <div
        v-if="host.currentQuestion.type === 'quiz' || host.currentQuestion.type === 'true_false' || host.currentQuestion.type === 'poll'"
        class="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div
          v-for="(opt, idx) in host.currentQuestion.options"
          :key="opt.position"
          class="rounded-2xl border-b-8 p-5 sm:p-6 flex items-center gap-4 text-white shadow-xl"
          :class="host.currentQuestion.type === 'true_false' ? (idx === 0 ? TILE_COLORS[1] : TILE_COLORS[0]) : TILE_COLORS[idx % 4]"
        >
          <ShapeIcon
            :index="host.currentQuestion.type === 'true_false' ? (idx === 0 ? 1 : 0) : idx"
            size-class="w-12 h-12 text-3xl bg-black/20 rounded-xl"
          />
          <span class="text-xl sm:text-2xl font-extrabold">{{ opt.content }}</span>
        </div>
      </div>

      <div
        v-else-if="host.currentQuestion.type === 'type_answer'"
        class="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center text-xl font-bold text-amber-200"
      >
        ⌨️ Câu hỏi Điền Câu Gốc / Gõ Đáp Án — Người chơi đang nhập câu trả lời trên điện thoại...
      </div>

      <div
        v-else-if="host.currentQuestion.type === 'order'"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div
          v-for="(opt, idx) in host.currentQuestion.options"
          :key="opt.position"
          class="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center"
        >
          <span class="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold mb-2">
            Mục #{{ idx + 1 }}
          </span>
          <p class="text-xl font-extrabold text-white">{{ opt.content }}</p>
        </div>
      </div>

      <div
        v-else-if="host.currentQuestion.type === 'slider'"
        class="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center text-xl font-bold text-amber-200"
      >
        🎚️ Thanh trượt con số: Khoảng từ {{ host.currentQuestion.sliderMin ?? 0 }} đến {{ host.currentQuestion.sliderMax ?? 1000 }}
      </div>
    </main>

    <!-- 3. CÔNG BỐ ĐÁP ÁN + CÂU GỐC KINH THÁNH & BÀI HỌC MỤC VỤ (REVEAL) -->
    <main
      v-else-if="host.state === 'REVEAL' && host.revealData && host.currentQuestion"
      class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col gap-6"
    >
      <div class="text-center">
        <span class="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold uppercase tracking-wider mb-2">
          Kết Quả Câu {{ host.revealData.q + 1 }} • {{ host.revealData.totalAnswered }} người trả lời
        </span>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white">
          {{ host.revealData.content }}
        </h2>
      </div>

      <!-- Đáp án đúng + thống kê số người chọn -->
      <div
        v-if="host.revealData.type === 'quiz' || host.revealData.type === 'true_false' || host.revealData.type === 'poll'"
        class="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div
          v-for="(opt, idx) in host.currentQuestion.options"
          :key="opt.position"
          class="rounded-2xl border-2 p-5 flex items-center justify-between gap-4 transition-all"
          :class="
            host.revealData.correctPositions.includes(opt.position)
              ? 'border-emerald-400 bg-emerald-950/60 text-white shadow-lg shadow-emerald-950/50'
              : 'border-slate-800 bg-slate-900/50 text-slate-400 opacity-65'
          "
        >
          <div class="flex items-center gap-3">
            <span
              class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl"
              :class="host.revealData.correctPositions.includes(opt.position) ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'"
            >
              {{ host.revealData.correctPositions.includes(opt.position) ? '✓' : '✕' }}
            </span>
            <span class="text-xl font-extrabold">{{ opt.content }}</span>
          </div>

          <span class="px-3.5 py-1.5 rounded-xl bg-slate-950 font-black text-lg text-amber-400 shrink-0">
            {{ host.revealData.optionCounts[idx] ?? 0 }} chọn
          </span>
        </div>
      </div>

      <div
        v-else-if="host.revealData.type === 'type_answer'"
        class="rounded-2xl border-2 border-emerald-400 bg-emerald-950/40 p-6 text-center"
      >
        <p class="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">Đáp án chính xác:</p>
        <p class="text-3xl font-black text-white">
          {{ host.revealData.acceptedTexts?.join(' / ') }}
        </p>
      </div>

      <div
        v-else-if="host.revealData.type === 'slider'"
        class="rounded-2xl border-2 border-emerald-400 bg-emerald-950/40 p-6 text-center"
      >
        <p class="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">Đáp án chính xác:</p>
        <p class="text-4xl font-black text-amber-400">
          {{ host.revealData.sliderAnswer }}
          <span v-if="host.revealData.sliderTolerance" class="text-base font-semibold text-slate-300">
            (chấp nhận sai số ±{{ host.revealData.sliderTolerance }})
          </span>
        </p>
      </div>

      <div
        v-else-if="host.revealData.type === 'order'"
        class="rounded-2xl border-2 border-emerald-400 bg-emerald-950/40 p-6"
      >
        <p class="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-3 text-center">
          Thứ tự chính xác:
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div
            v-for="(contentText, idx) in (host.revealData.orderedCorrectContents || host.currentQuestion.options.map((o) => o.content))"
            :key="idx"
            class="rounded-xl bg-slate-900 border border-emerald-500/40 p-3.5 text-center font-bold text-white"
          >
            <span class="text-amber-400 font-black mr-1">{{ idx + 1 }}.</span> {{ contentText }}
          </div>
        </div>
      </div>

      <!-- Khối Câu Gốc Kinh Thánh 1925 & Bài Học Mục Vụ (Điểm đặc trưng cốt lõi mục 3.5) -->
      <div
        v-if="host.revealData.verseText || host.revealData.explanation"
        class="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-8 shadow-xl space-y-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 rounded-md bg-amber-500 text-slate-950 font-black text-xs uppercase">
              📖 Lời Chúa & Bài Học
            </span>
            <span v-if="host.revealData.bibleReference" class="text-lg font-extrabold text-amber-400">
              {{ host.revealData.bibleReference }} (Bản Truyền Thống 1925)
            </span>
          </div>

          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-xs font-extrabold text-amber-200 transition-colors"
            @click="showScriptureModal = true"
          >
            🔍 Chiếu Câu Gốc Toàn Màn Hình
          </button>
        </div>

        <blockquote
          v-if="host.revealData.verseText"
          class="font-serif italic text-xl sm:text-2xl text-amber-50 leading-relaxed border-l-4 border-amber-500 pl-4"
        >
          “{{ host.revealData.verseText }}”
        </blockquote>

        <p
          v-if="host.revealData.explanation"
          class="text-base sm:text-lg text-slate-200 bg-slate-900/90 border border-slate-800 rounded-xl p-4"
        >
          <strong class="text-amber-400">Ý nghĩa / Bài học:</strong> {{ host.revealData.explanation }}
        </p>
      </div>
    </main>

    <!-- 4. BẢNG XẾP HẠNG SAU MỖI CÂU (LEADERBOARD) -->
    <main
      v-else-if="host.state === 'LEADERBOARD' && host.leaderboardData"
      class="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center gap-6"
    >
      <div class="text-center">
        <span class="px-4 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-extrabold uppercase tracking-widest">
          Sau Câu {{ host.leaderboardData.q + 1 }} / {{ host.leaderboardData.totalQuestions }}
        </span>
        <h2 class="text-3xl sm:text-4xl font-black text-white mt-2">
          Bảng Xếp Hạng Dẫn Đầu (Top 5)
        </h2>
      </div>

      <div
        v-if="host.leaderboardData.topClimber"
        class="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-center text-sm font-bold text-emerald-300"
      >
        🚀 Bứt phá ấn tượng: <strong class="text-white">{{ host.leaderboardData.topClimber.nickname }}</strong> vừa tăng
        +{{ host.leaderboardData.topClimber.climbed }} bậc!
      </div>

      <div class="space-y-3">
        <div
          v-for="item in host.leaderboardData.topPlayers"
          :key="item.playerId"
          class="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 flex items-center justify-between gap-4"
        >
          <div class="flex items-center gap-4">
            <span
              class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg"
              :class="
                item.rank === 1
                  ? 'bg-amber-400 text-slate-950'
                  : item.rank === 2
                  ? 'bg-slate-300 text-slate-950'
                  : item.rank === 3
                  ? 'bg-amber-700 text-white'
                  : 'bg-slate-800 text-slate-300'
              "
            >
              #{{ item.rank }}
            </span>
            <div>
              <span class="text-lg sm:text-xl font-extrabold text-white">{{ item.nickname }}</span>
              <span
                v-if="item.teamName"
                class="ml-2 px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300 font-semibold"
              >
                {{ item.teamName }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <span
              v-if="item.streak > 1"
              class="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-extrabold"
            >
              🔥 {{ item.streak }}
            </span>
            <span class="text-2xl font-black text-amber-400">
              {{ item.score.toLocaleString('vi-VN') }} đ
            </span>
          </div>
        </div>
      </div>

      <!-- Bảng xếp hạng Đội (nếu chơi Team Mode) -->
      <div
        v-if="host.leaderboardData.teamStandings?.length"
        class="rounded-2xl border border-amber-500/30 bg-slate-900 p-5"
      >
        <h3 class="text-sm font-extrabold uppercase tracking-wider text-amber-400 mb-3">
          🛡️ Xếp Hạng Theo Đội / Ban Ngành (Điểm Trung Bình)
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="t in host.leaderboardData.teamStandings"
            :key="t.teamName"
            class="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex items-center justify-between"
          >
            <div>
              <span class="font-black text-amber-400 mr-2">#{{ t.rank }}</span>
              <span class="font-bold text-white">{{ t.teamName }}</span>
              <span class="text-xs text-slate-400 ml-1">({{ t.memberCount }} TV)</span>
            </div>
            <span class="font-extrabold text-emerald-400">
              {{ t.averageScore.toLocaleString('vi-VN') }} đ TB
            </span>
          </div>
        </div>
      </div>
    </main>

    <!-- 5. BỤC VINH DANH CUỐI TRẬN (PODIUM) -->
    <main
      v-else-if="host.state === 'PODIUM' && host.podiumData"
      class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center gap-8 text-center"
    >
      <div>
        <span class="px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-extrabold uppercase tracking-widest">
          🏆 Bục Vinh Danh Chung Cuộc • {{ host.podiumData.totalPlayers }} Người Chơi
        </span>
        <h1 class="text-3xl sm:text-5xl font-black text-white mt-3">
          {{ host.podiumData.quizTitle }}
        </h1>
      </div>

      <!-- Bục Top 3 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto w-full pt-4">
        <!-- Hạng 2 -->
        <div
          v-if="host.podiumData.top3[1]"
          class="rounded-2xl border-2 border-slate-400/50 bg-slate-900 p-6 flex flex-col items-center justify-end md:h-64"
        >
          <span class="text-3xl mb-2">🥈</span>
          <span class="text-xs font-bold uppercase text-slate-400">Hạng Nhì</span>
          <h3 class="text-2xl font-extrabold text-white mt-1">{{ host.podiumData.top3[1].nickname }}</h3>
          <p class="text-xl font-black text-slate-200 mt-2">
            {{ host.podiumData.top3[1].score.toLocaleString('vi-VN') }} đ
          </p>
        </div>

        <!-- Hạng 1 -->
        <div
          v-if="host.podiumData.top3[0]"
          class="rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-500/20 to-slate-900 p-8 flex flex-col items-center justify-end md:h-80 shadow-2xl"
        >
          <span class="text-5xl mb-2">👑</span>
          <span class="text-xs font-black uppercase tracking-widest text-amber-300">Quán Quân</span>
          <h3 class="text-3xl font-black text-white mt-1">{{ host.podiumData.top3[0].nickname }}</h3>
          <p class="text-2xl font-black text-amber-400 mt-2">
            {{ host.podiumData.top3[0].score.toLocaleString('vi-VN') }} đ
          </p>
        </div>

        <!-- Hạng 3 -->
        <div
          v-if="host.podiumData.top3[2]"
          class="rounded-2xl border-2 border-amber-700/60 bg-slate-900 p-6 flex flex-col items-center justify-end md:h-56"
        >
          <span class="text-3xl mb-2">🥉</span>
          <span class="text-xs font-bold uppercase text-amber-500">Hạng Ba</span>
          <h3 class="text-2xl font-extrabold text-white mt-1">{{ host.podiumData.top3[2].nickname }}</h3>
          <p class="text-xl font-black text-amber-400 mt-2">
            {{ host.podiumData.top3[2].score.toLocaleString('vi-VN') }} đ
          </p>
        </div>
      </div>

      <!-- Hành động sau trận: Xuất Excel / Xem báo cáo -->
      <div class="flex flex-wrap items-center justify-center gap-4 pt-4">
        <button
          v-if="host.podiumData.sessionId"
          type="button"
          class="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition-colors"
          @click="downloadExcelReport"
        >
          📥 Xuất Kết Quả Ra Excel (.xlsx)
        </button>

        <button
          v-if="host.podiumData.sessionId"
          type="button"
          class="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-colors"
          @click="router.push(`/studio/reports?session=${host.podiumData.sessionId}`)"
        >
          📊 Xem Báo Cáo Phân Tích Câu Khó
        </button>

        <router-link
          to="/studio"
          class="px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm"
        >
          Về Kho Câu Hỏi
        </router-link>
      </div>
    </main>

    <!-- Modal Chiếu Câu Gốc Toàn Màn Hình -->
    <ScriptureSpotlightModal
      :open="showScriptureModal"
      :bible-reference="host.revealData?.bibleReference"
      :verse-text="host.revealData?.verseText"
      :explanation="host.revealData?.explanation"
      @close="showScriptureModal = false"
    />
  </div>
</template>

