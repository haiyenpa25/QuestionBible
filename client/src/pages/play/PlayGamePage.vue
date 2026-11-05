<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { generateBibleNickname } from '@questionbible/shared';
import { usePlayerStore } from '../../stores/player';
import ShapeIcon from '../../components/ShapeIcon.vue';

const route = useRoute();
const player = usePlayerStore();

const pinInput = ref(
  (route.params.pin as string) || (route.query.pin as string) || player.pin || ''
);
const nicknameInput = ref(player.nickname || '');
const teamInput = ref('');
const joining = ref(false);

async function pickSuggestion(suggestedName: string) {
  nicknameInput.value = suggestedName;
  await handleJoin();
}

// Màn xem lại cá nhân cuối trận
const reviewFilter = ref<'wrong' | 'all'>('wrong');
const reviewItems = computed(() => player.podiumData?.review ?? []);
const wrongCount = computed(() => reviewItems.value.filter((i) => !i.isPoll && !i.correct).length);
const filteredReview = computed(() =>
  reviewFilter.value === 'all' ? reviewItems.value : reviewItems.value.filter((i) => !i.isPoll && !i.correct)
);

// Trạng thái trả lời cho các loại câu hỏi đặc biệt
const typedAnswer = ref('');
const orderedPositions = ref<Array<{ position: number; content: string }>>([]);
const sliderValue = ref<number>(0);

const TILE_COLORS = [
  'bg-answer-red hover:bg-red-500 border-red-800',
  'bg-answer-blue hover:bg-blue-500 border-blue-800',
  'bg-answer-amber hover:bg-amber-500 border-amber-800',
  'bg-answer-green hover:bg-green-500 border-green-800'
];

watch(
  () => player.currentQuestion,
  (q) => {
    if (!q) return;
    typedAnswer.value = '';
    if (q.type === 'order' && q.options) {
      orderedPositions.value = [...q.options];
    }
    if (q.type === 'slider') {
      const min = q.sliderMin ?? 0;
      const max = q.sliderMax ?? 100;
      sliderValue.value = Math.round((min + max) / 2);
    }
  },
  { immediate: true }
);

function handleRandomBibleName() {
  nicknameInput.value = generateBibleNickname();
}

async function handleJoin() {
  if (!pinInput.value.trim()) return;
  if (!nicknameInput.value.trim()) {
    nicknameInput.value = generateBibleNickname();
  }
  joining.value = true;
  await player.joinRoom({
    pin: pinInput.value.trim(),
    nickname: nicknameInput.value.trim(),
    teamName: teamInput.value.trim() || undefined
  });
  joining.value = false;
}

function submitChoice(choiceIndex: number) {
  player.submitAnswer({ choice: choiceIndex });
}

function submitText() {
  if (!typedAnswer.value.trim()) return;
  player.submitAnswer({ text: typedAnswer.value.trim() });
}

function moveOrderItem(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= orderedPositions.value.length) return;
  const copy = [...orderedPositions.value];
  const temp = copy[index];
  copy[index] = copy[target];
  copy[target] = temp;
  orderedPositions.value = copy;
}

function submitOrder() {
  player.submitAnswer({
    order: orderedPositions.value.map((item) => item.position)
  });
}

function submitSlider() {
  player.submitAnswer({
    value: Number(sliderValue.value)
  });
}

onMounted(async () => {
  if (route.query.pin) {
    pinInput.value = String(route.query.pin);
  }
  if (!player.joined && player.pin && player.token) {
    await player.tryAutoRejoin();
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100 select-none">
    <!-- Thanh trạng thái trên cùng khi đã vào phòng -->
    <header
      v-if="player.joined"
      class="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span class="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-black text-xs">
          PIN {{ player.pin }}
        </span>
        <span class="font-bold text-sm text-white truncate">{{ player.nickname }}</span>
        <span
          v-if="player.teamName"
          class="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs"
        >
          {{ player.teamName }}
        </span>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <div
          v-if="player.streak > 1"
          class="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-extrabold"
        >
          🔥 {{ player.streak }}
        </div>
        <div class="px-3 py-1 rounded-lg bg-slate-800 font-extrabold text-sm text-amber-400">
          {{ player.score.toLocaleString('vi-VN') }} đ
        </div>
      </div>
    </header>

    <!-- 1. MÀN HÌNH NHẬP PIN & BIỆT DANH -->
    <main
      v-if="!player.joined"
      class="flex-1 flex items-center justify-center p-4"
    >
      <div class="w-full max-w-md rounded-2xl border-2 border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl">
        <div class="text-center mb-6">
          <router-link to="/" class="inline-flex items-center gap-2 text-xl font-extrabold text-white mb-2">
            <span class="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">✞</span>
            <span>Question<span class="text-amber-400">Bible</span></span>
          </router-link>
          <h1 class="text-2xl font-extrabold text-white mt-1">Tham Gia Đố Kinh Thánh</h1>
          <p class="text-xs text-slate-400 mt-1">Nhập mã PIN 6 số trên màn hình chiếu</p>
        </div>

        <div
          v-if="player.kickedReason"
          role="alert"
          class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-300"
        >
          {{ player.kickedReason }}
        </div>

        <div
          v-if="player.errorMsg"
          role="alert"
          class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-300 space-y-2"
        >
          <p>{{ player.errorMsg }}</p>
          <div v-if="player.nameSuggestions.length > 0" class="flex flex-wrap gap-2 pt-1">
            <button
              v-for="sug in player.nameSuggestions"
              :key="sug"
              type="button"
              class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors"
              @click="pickSuggestion(sug)"
            >
              {{ sug }}
            </button>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="handleJoin">
          <div>
            <label for="player-pin" class="block text-xs font-bold text-slate-300 mb-1.5">
              Mã PIN phòng chơi (6 số)
            </label>
            <input
              id="player-pin"
              v-model="pinInput"
              type="text"
              inputmode="numeric"
              maxlength="6"
              required
              placeholder="123456"
              class="w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3.5 text-center text-3xl font-black tracking-[0.25em] text-amber-400 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="player-nickname" class="text-xs font-bold text-slate-300">
                Biệt danh của bạn
              </label>
              <button
                type="button"
                class="text-xs font-bold text-amber-400 hover:text-amber-300"
                @click="handleRandomBibleName"
              >
                🎲 Tên nhân vật Kinh Thánh
              </button>
            </div>
            <input
              id="player-nickname"
              v-model="nicknameInput"
              type="text"
              maxlength="30"
              placeholder="VD: Đa-vít Dũng Cảm"
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base font-bold text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label for="player-team" class="block text-xs font-bold text-slate-400 mb-1.5">
              Tên Đội / Ban ngành (tuỳ chọn cho Chế độ Đội)
            </label>
            <input
              id="player-team"
              v-model="teamInput"
              type="text"
              maxlength="40"
              placeholder="VD: Đội Đa-vít / Ban Thanh Niên"
              class="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            :disabled="joining"
            class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-4 text-lg font-extrabold text-slate-950 transition-colors shadow-lg"
          >
            {{ joining ? 'Đang vào phòng...' : 'Vào Phòng Chơi Ngay!' }}
          </button>
        </form>
      </div>
    </main>

    <!-- 2. SẢNH CHỜ (LOBBY) -->
    <main
      v-else-if="player.state === 'LOBBY'"
      class="flex-1 flex flex-col items-center justify-center p-6 text-center"
    >
      <div class="max-w-lg w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 space-y-6">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
          🙌
        </div>
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
            Bạn đã vào phòng thành công!
          </p>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white">
            Xin chào, <span class="text-amber-400">{{ player.nickname }}</span>!
          </h1>
          <p v-if="player.teamName" class="text-sm font-semibold text-slate-300 mt-1">
            Đội: {{ player.teamName }}
          </p>
        </div>

        <div
          v-if="player.options?.openingPrayerOrVerse"
          class="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-amber-100 font-serif italic text-sm sm:text-base"
        >
          {{ player.options.openingPrayerOrVerse }}
        </div>

        <p class="text-sm text-slate-400 animate-pulse">
          Hãy nhìn lên màn hình lớn — Người dẫn sắp bắt đầu trận đấu...
        </p>
      </div>
    </main>

    <!-- 3. CHUẨN BỊ CÂU HỎI (QUESTION_INTRO) -->
    <main
      v-else-if="player.state === 'QUESTION_INTRO' && player.currentQuestion"
      class="flex-1 flex flex-col items-center justify-center p-6 text-center"
    >
      <div class="space-y-4 max-w-md">
        <span class="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-extrabold">
          Câu {{ player.currentQuestion.q + 1 }} / {{ player.currentQuestion.totalQuestions }}
        </span>

        <div
          v-if="player.currentQuestion.pointsFactor === 2"
          class="text-lg font-black text-amber-400 uppercase tracking-wider animate-bounce"
        >
          ⚡ Câu Nhân Đôi Điểm (x2)!
        </div>

        <h2 class="text-2xl sm:text-3xl font-extrabold text-white">
          Đọc câu hỏi trên màn hình chính...
        </h2>

        <p
          v-if="player.currentQuestion.content"
          class="text-base text-slate-200 bg-slate-900 border border-slate-800 rounded-xl p-4"
        >
          {{ player.currentQuestion.content }}
        </p>
      </div>
    </main>

    <!-- 4. ĐANG TRẢ LỜI (ANSWERING) -->
    <main
      v-else-if="player.state === 'ANSWERING' && player.currentQuestion"
      class="flex-1 flex flex-col p-3 sm:p-4 gap-3"
    >
      <!-- Thanh đếm ngược và nội dung câu hỏi (nếu bật hiện trên điện thoại) -->
      <div class="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 shrink-0">
        <span class="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Câu {{ player.currentQuestion.q + 1 }}/{{ player.currentQuestion.totalQuestions }}
        </span>
        <span
          class="text-xl font-black px-3 py-0.5 rounded-lg"
          :class="player.paused ? 'bg-amber-500/20 text-amber-300' : player.remainingSeconds <= 5 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-amber-400'"
        >
          {{ player.paused ? `⏸ Tạm dừng (${player.remainingSeconds}s)` : `⏱ ${player.remainingSeconds}s` }}
        </span>
      </div>

      <div
        v-if="player.currentQuestion.content"
        class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center text-sm sm:text-base font-bold text-white shrink-0"
      >
        {{ player.currentQuestion.content }}
      </div>

      <!-- Nếu đã bấm chọn đáp án: hiện màn hình Đã Ghi Nhận -->
      <div
        v-if="player.hasSubmitted"
        class="flex-1 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-slate-900 border border-slate-800"
      >
        <div class="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-4">
          ✓
        </div>
        <h2 class="text-2xl font-extrabold text-white mb-2">Đã ghi nhận câu trả lời!</h2>
        <p class="text-sm text-slate-400">
          Hãy giữ tâm thế vững vàng và chờ kết quả trên màn hình lớn...
        </p>
      </div>

      <!-- 4a. Trắc nghiệm 4 ô màu (quiz / poll) -->
      <div
        v-else-if="player.currentQuestion.type === 'quiz' || player.currentQuestion.type === 'poll'"
        class="flex-1 grid grid-cols-2 gap-3 sm:gap-4"
      >
        <button
          v-for="idx in player.currentQuestion.n"
          :key="idx - 1"
          type="button"
          class="btn-answer-tile rounded-2xl border-b-8 flex flex-col items-center justify-center p-4 text-white shadow-xl focus:outline-none focus:ring-4 focus:ring-white/40"
          :class="TILE_COLORS[(idx - 1) % 4]"
          @click="submitChoice(idx - 1)"
        >
          <ShapeIcon :index="idx - 1" size-class="w-16 h-16 text-5xl sm:text-6xl" />
          <span
            v-if="player.currentQuestion.options?.[idx - 1]"
            class="mt-3 text-sm sm:text-base font-extrabold text-center line-clamp-2"
          >
            {{ player.currentQuestion.options[idx - 1].content }}
          </span>
        </button>
      </div>

      <!-- 4b. Đúng / Sai (true_false) -->
      <div
        v-else-if="player.currentQuestion.type === 'true_false'"
        class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <button
          type="button"
          class="btn-answer-tile rounded-2xl border-b-8 bg-answer-blue hover:bg-blue-500 border-blue-800 flex flex-col items-center justify-center p-6 text-white shadow-xl"
          @click="submitChoice(0)"
        >
          <ShapeIcon :index="1" size-class="w-16 h-16 text-5xl" />
          <span class="mt-3 text-2xl font-black uppercase">ĐÚNG</span>
        </button>

        <button
          type="button"
          class="btn-answer-tile rounded-2xl border-b-8 bg-answer-red hover:bg-red-500 border-red-800 flex flex-col items-center justify-center p-6 text-white shadow-xl"
          @click="submitChoice(1)"
        >
          <ShapeIcon :index="0" size-class="w-16 h-16 text-5xl" />
          <span class="mt-3 text-2xl font-black uppercase">SAI</span>
        </button>
      </div>

      <!-- 4c. Gõ đáp án / Điền câu gốc (type_answer) -->
      <div
        v-else-if="player.currentQuestion.type === 'type_answer'"
        class="flex-1 flex flex-col justify-center max-w-md mx-auto w-full gap-4 p-4"
      >
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <label for="type-answer-input" class="block text-sm font-bold text-amber-300">
            Nhập từ còn thiếu hoặc tên riêng Kinh Thánh:
          </label>
          <input
            id="type-answer-input"
            v-model="typedAnswer"
            type="text"
            autocomplete="off"
            placeholder="Nhập đáp án của bạn..."
            class="w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-4 text-lg font-bold text-white focus:border-amber-400 focus:outline-none"
            @keyup.enter="submitText"
          />
          <p class="text-xs text-slate-400">
            Hệ thống tự động chấp nhận có dấu hoặc không dấu (VD: "Phi-e-rơ" hoặc "phie ro").
          </p>
          <button
            type="button"
            class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-4 text-lg font-extrabold text-slate-950"
            @click="submitText"
          >
            Gửi Đáp Án
          </button>
        </div>
      </div>

      <!-- 4d. Sắp xếp thứ tự (order) -->
      <div
        v-else-if="player.currentQuestion.type === 'order'"
        class="flex-1 flex flex-col justify-between max-w-lg mx-auto w-full gap-3 py-2"
      >
        <p class="text-xs font-bold text-center text-amber-300 uppercase tracking-wider">
          Bấm nút ↑ ↓ để sắp xếp theo đúng thứ tự từ trên xuống dưới:
        </p>

        <div class="space-y-2.5 flex-1 flex flex-col justify-center">
          <div
            v-for="(item, idx) in orderedPositions"
            :key="item.position"
            class="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3.5"
          >
            <div class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                {{ idx + 1 }}
              </span>
              <span class="font-bold text-sm sm:text-base text-white">{{ item.content }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                :disabled="idx === 0"
                class="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-black text-lg"
                aria-label="Chuyển lên"
                @click="moveOrderItem(idx, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                :disabled="idx === orderedPositions.length - 1"
                class="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-black text-lg"
                aria-label="Chuyển xuống"
                @click="moveOrderItem(idx, 1)"
              >
                ↓
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-4 text-lg font-extrabold text-slate-950"
          @click="submitOrder"
        >
          Xác Nhận Thứ Tự
        </button>
      </div>

      <!-- 4e. Thanh trượt con số (slider) -->
      <div
        v-else-if="player.currentQuestion.type === 'slider'"
        class="flex-1 flex flex-col justify-center max-w-md mx-auto w-full gap-6 p-4"
      >
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center space-y-6">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">
            Kéo thanh trượt hoặc nhập con số bạn chọn
          </p>
          <div class="text-5xl font-black text-amber-400">
            {{ sliderValue }}
          </div>
          <input
            v-model.number="sliderValue"
            type="range"
            :min="player.currentQuestion.sliderMin ?? 0"
            :max="player.currentQuestion.sliderMax ?? 1000"
            class="w-full accent-amber-500 h-3 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div class="flex justify-between text-xs font-semibold text-slate-400">
            <span>Tối thiểu: {{ player.currentQuestion.sliderMin ?? 0 }}</span>
            <span>Tối đa: {{ player.currentQuestion.sliderMax ?? 1000 }}</span>
          </div>
          <button
            type="button"
            class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-4 text-lg font-extrabold text-slate-950"
            @click="submitSlider"
          >
            Chốt Đáp Án: {{ sliderValue }}
          </button>
        </div>
      </div>
    </main>

    <!-- 5. KẾT QUẢ SAU MỖI CÂU (REVEAL / LEADERBOARD) -->
    <main
      v-else-if="(player.state === 'REVEAL' || player.state === 'LEADERBOARD' || (player.state === 'SCRIPTURE' && !player.scriptureData)) && player.lastResult"
      class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div class="max-w-lg w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 text-center space-y-5">
        <div
          class="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl font-black"
          :class="player.lastResult.correct ? 'bg-emerald-500 text-slate-950' : 'bg-red-600 text-white'"
        >
          {{ player.lastResult.correct ? '✓' : '✕' }}
        </div>

        <div>
          <h2
            class="text-3xl font-black"
            :class="player.lastResult.correct ? 'text-emerald-400' : 'text-red-400'"
          >
            {{ player.lastResult.correct ? 'Chính Xác!' : 'Chưa Chính Xác' }}
          </h2>
          <p class="text-xl font-extrabold text-amber-400 mt-1">
            +{{ player.lastResult.points.toLocaleString('vi-VN') }} điểm
          </p>
          <p
            v-if="player.lastResult.streakBonus > 0"
            class="text-xs font-bold text-orange-300 mt-1"
          >
            🔥 Chuỗi {{ player.lastResult.streak }} câu đúng liên tiếp (+{{ player.lastResult.streakBonus }} đ)
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <div class="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <p class="text-xs text-slate-400">Thứ hạng hiện tại</p>
            <p v-if="player.lastResult.rank !== null" class="text-xl font-black text-white">
              #{{ player.lastResult.rank }} <span class="text-xs font-normal text-slate-400">/ {{ player.lastResult.totalPlayers }}</span>
            </p>
            <p v-else class="text-sm font-extrabold text-emerald-400 mt-1">
              {{ player.lastResult.friendlyRankText || 'Hãy tiếp tục cố gắng!' }}
            </p>
          </div>
          <div class="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <p class="text-xs text-slate-400">Tổng điểm</p>
            <p class="text-xl font-black text-amber-400">
              {{ player.lastResult.total.toLocaleString('vi-VN') }}
            </p>
          </div>
        </div>

        <!-- Câu gốc Kinh Thánh & Giải thích mục vụ ngay trên điện thoại -->
        <div
          v-if="player.lastResult.verseText || player.lastResult.explanation"
          class="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-left space-y-2"
        >
          <p v-if="player.lastResult.bibleReference" class="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
            📖 {{ player.lastResult.bibleReference }} (Bản 1925)
          </p>
          <blockquote v-if="player.lastResult.verseText" class="font-serif italic text-sm text-amber-50">
            “{{ player.lastResult.verseText }}”
          </blockquote>
          <p v-if="player.lastResult.explanation" class="text-xs text-slate-300 pt-1 border-t border-amber-500/20">
            💡 {{ player.lastResult.explanation }}
          </p>
        </div>
      </div>
    </main>

    <!-- 5b. CHIA SẺ LỜI CHÚA (SCRIPTURE): đọc câu gốc ngay trên điện thoại -->
    <main
      v-else-if="player.state === 'SCRIPTURE' && player.scriptureData"
      class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div class="max-w-lg w-full rounded-2xl border-2 border-amber-500/40 bg-slate-900 p-6 sm:p-8 text-center space-y-5">
        <p class="text-xs font-extrabold uppercase tracking-widest text-amber-300">📖 Chia sẻ Lời Chúa</p>
        <blockquote
          v-if="player.scriptureData.verseText"
          class="font-serif italic text-xl sm:text-2xl leading-relaxed text-amber-50"
        >
          “{{ player.scriptureData.verseText }}”
        </blockquote>
        <p v-if="player.scriptureData.bibleReference" class="text-base font-extrabold text-amber-400">
          — {{ player.scriptureData.bibleReference }} (Bản 1925) —
        </p>
        <p
          v-if="player.scriptureData.explanation"
          class="text-sm text-slate-200 text-left rounded-xl bg-slate-950 border border-slate-800 p-4"
        >
          💡 {{ player.scriptureData.explanation }}
        </p>
        <p class="text-xs text-slate-400">Cùng lắng nghe người dẫn chia sẻ...</p>
      </div>
    </main>

    <!-- 6. BỤC VINH DANH CUỐI TRẬN (PODIUM) -->
    <main
      v-else-if="player.state === 'PODIUM' && player.podiumData"
      class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div class="max-w-lg w-full rounded-2xl border-2 border-amber-500/40 bg-slate-900 p-6 sm:p-8 text-center space-y-6">
        <div class="text-5xl">🏆</div>
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-amber-300">
            Hoàn thành trận đấu
          </p>
          <h1 class="text-2xl font-extrabold text-white mt-1">
            {{ player.podiumData.quizTitle }}
          </h1>
        </div>

        <div
          v-if="player.podiumData.personalResult"
          class="rounded-xl bg-slate-950 border border-slate-800 p-5 space-y-3"
        >
          <p class="text-sm text-slate-400">Thành tích của {{ player.nickname }}</p>
          <div v-if="player.podiumData.personalResult.rank !== null" class="text-4xl font-black text-amber-400">
            Hạng #{{ player.podiumData.personalResult.rank }}
          </div>
          <div v-else class="text-2xl font-black text-emerald-400">
            {{ player.podiumData.personalResult.friendlyRankText || 'Hoàn thành xuất sắc!' }}
          </div>
          <div class="flex justify-center gap-6 text-sm font-bold text-slate-200 pt-2">
            <span>Tổng điểm: {{ player.podiumData.personalResult.score.toLocaleString('vi-VN') }}</span>
            <span>
              Đúng: {{ player.podiumData.personalResult.correctCount }}/{{ player.podiumData.personalResult.totalQuestions }} câu
            </span>
          </div>
        </div>

        <!-- Màn xem lại cá nhân: ôn lại câu sai kèm câu Kinh Thánh -->
        <div v-if="reviewItems.length" class="text-left space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-extrabold text-white">📚 Xem lại & ôn Lời Chúa</h2>
            <div class="flex rounded-lg border border-slate-700 overflow-hidden text-[11px] font-bold">
              <button
                type="button"
                class="px-2.5 py-1"
                :class="reviewFilter === 'wrong' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'"
                @click="reviewFilter = 'wrong'"
              >
                Câu cần ôn ({{ wrongCount }})
              </button>
              <button
                type="button"
                class="px-2.5 py-1"
                :class="reviewFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'"
                @click="reviewFilter = 'all'"
              >
                Tất cả
              </button>
            </div>
          </div>

          <p v-if="filteredReview.length === 0" class="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm font-bold text-emerald-300 text-center">
            🎉 Bạn trả lời đúng tất cả các câu. Tạ ơn Chúa!
          </p>

          <div
            v-for="item in filteredReview"
            :key="item.q"
            class="rounded-xl border p-3.5 space-y-2"
            :class="item.isPoll ? 'border-slate-700 bg-slate-950' : item.correct ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-red-500/30 bg-red-950/20'"
          >
            <p class="text-sm font-bold text-white">
              <span class="mr-1">{{ item.isPoll ? '🗳️' : item.correct ? '✅' : '❌' }}</span>
              Câu {{ item.q + 1 }}. {{ item.content }}
            </p>
            <p v-if="!item.isPoll" class="text-xs text-slate-300">
              Bạn chọn:
              <strong :class="item.correct ? 'text-emerald-300' : 'text-red-300'">
                {{ item.answered ? item.yourAnswer || '(trống)' : 'Không kịp trả lời' }}
              </strong>
              <span v-if="item.points > 0" class="text-amber-400 font-bold"> · +{{ item.points.toLocaleString('vi-VN') }} đ</span>
            </p>
            <p v-if="!item.isPoll && !item.correct" class="text-xs text-slate-300">
              Đáp án đúng: <strong class="text-emerald-300">{{ item.correctAnswer }}</strong>
            </p>
            <div
              v-if="item.verseText || item.bibleReference"
              class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 space-y-1"
            >
              <p v-if="item.bibleReference" class="text-[11px] font-extrabold text-amber-300 uppercase">📖 {{ item.bibleReference }}</p>
              <p v-if="item.verseText" class="font-serif italic text-xs text-amber-50">“{{ item.verseText }}”</p>
            </div>
            <p v-if="item.explanation" class="text-xs text-slate-400">💡 {{ item.explanation }}</p>
          </div>
        </div>

        <button
          type="button"
          class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3.5 text-sm font-extrabold text-slate-950"
          @click="player.leaveRoom()"
        >
          Chơi Trận Khác
        </button>
      </div>
    </main>
  </div>
</template>

