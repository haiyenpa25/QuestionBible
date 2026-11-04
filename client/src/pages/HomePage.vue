<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppNavbar from '../components/AppNavbar.vue';
import { apiFetch } from '../api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const quickPin = ref('');

interface PublicQuizItem {
  id: number;
  title: string;
  description: string | null;
  audience: string;
  _count: { questions: number; gameSessions: number };
}

const featuredQuizzes = ref<PublicQuizItem[]>([]);
const loadingQuizzes = ref(true);

function handleQuickJoin() {
  const clean = quickPin.value.replace(/\D/g, '').slice(0, 6);
  if (clean.length === 6) {
    void router.push({ path: '/play', query: { pin: clean } });
  } else {
    void router.push('/play');
  }
}

function handleHostQuiz(quizId: number) {
  if (!auth.isAuthenticated) {
    void router.push({ path: '/login', query: { redirect: `/host/${quizId}` } });
    return;
  }
  void router.push(`/host/${quizId}`);
}

onMounted(async () => {
  try {
    const res = await apiFetch<{ quizzes: PublicQuizItem[] }>('/api/quizzes');
    featuredQuizzes.value = res.quizzes.slice(0, 6);
  } catch {
    // ignore
  } finally {
    loadingQuizzes.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
    <AppNavbar />

    <main class="flex-1">
      <!-- Khu vực chính: Vào phòng bằng PIN + Mở phòng cho Hội Thánh -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div class="lg:col-span-7 space-y-6">
            <div class="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <span>📖 66 Sách Kinh Điển Tin Lành • Bản Truyền Thống 1925</span>
            </div>

            <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Đố Kinh Thánh Trực Tuyến
              <span class="block text-amber-400 mt-1">Học Lời Chúa Trong Niềm Vui Hiệp Một</span>
            </h1>

            <p class="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              Người dẫn chiếu câu hỏi lên màn hình lớn tại nhà thờ, ban ngành trả lời trực tiếp trên điện thoại.
              Sau mỗi câu đều hiển thị <strong class="text-amber-300">câu gốc Kinh Thánh 1925</strong> và
              <strong class="text-amber-300">bài học mục vụ</strong>, chịu tải mượt mà 200–300+ người chơi cùng lúc.
            </p>

            <div class="flex flex-wrap gap-3 pt-2">
              <router-link
                to="/studio"
                class="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-colors"
              >
                Mở Kho Câu Hỏi & Tổ Chức Chơi
              </router-link>
              <router-link
                to="/play"
                class="px-5 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 font-bold text-sm transition-colors"
              >
                Màn hình Người Chơi (Điện thoại)
              </router-link>
            </div>
          </div>

          <!-- Thẻ nhập PIN nhanh cho người chơi -->
          <div class="lg:col-span-5">
            <div class="rounded-2xl border-2 border-amber-500/40 bg-slate-900 p-6 sm:p-8 shadow-xl">
              <div class="text-center mb-6">
                <span class="inline-block px-3 py-1 rounded-md bg-amber-500/15 text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">
                  Dành cho Người Chơi
                </span>
                <h2 class="text-2xl font-extrabold text-white">Nhập Mã PIN Vào Phòng</h2>
                <p class="text-xs text-slate-400 mt-1">
                  Không cần tạo tài khoản — nhập 6 số PIN trên màn hình chiếu
                </p>
              </div>

              <form class="space-y-4" @submit.prevent="handleQuickJoin">
                <div>
                  <label for="quick-pin-input" class="sr-only">Mã PIN 6 số</label>
                  <input
                    id="quick-pin-input"
                    v-model="quickPin"
                    type="text"
                    inputmode="numeric"
                    maxlength="6"
                    placeholder="VD: 123456"
                    class="w-full rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-4 text-center text-3xl font-black tracking-[0.25em] text-amber-400 placeholder:text-slate-600 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-4 text-center text-lg font-extrabold text-slate-950 transition-colors"
                >
                  Vào Phòng Ngay →
                </button>
              </form>

              <!-- 4 biểu tượng màu đặc trưng -->
              <div class="grid grid-cols-4 gap-2 mt-6 pt-6 border-t border-slate-800">
                <div class="h-10 rounded-lg bg-answer-red flex items-center justify-center font-black text-white text-lg">▲</div>
                <div class="h-10 rounded-lg bg-answer-blue flex items-center justify-center font-black text-white text-lg">◆</div>
                <div class="h-10 rounded-lg bg-answer-amber flex items-center justify-center font-black text-white text-lg">●</div>
                <div class="h-10 rounded-lg bg-answer-green flex items-center justify-center font-black text-white text-lg">■</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Danh sách Bộ câu hỏi mẫu sẵn sàng mở phòng -->
      <section class="border-t border-slate-800/80 bg-slate-900/50 py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 class="text-2xl font-extrabold text-white">Kho Câu Hỏi Kinh Thánh Sẵn Sàng</h2>
              <p class="text-sm text-slate-400 mt-1">
                Chọn một bộ câu hỏi bên dưới để mở phòng chiếu ngay hoặc chỉnh sửa trong Studio
              </p>
            </div>
            <router-link
              to="/studio"
              class="text-sm font-bold text-amber-400 hover:text-amber-300"
            >
              Xem tất cả & Tạo câu hỏi mới →
            </router-link>
          </div>

          <div v-if="loadingQuizzes" class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div v-for="i in 3" :key="i" class="h-52 rounded-xl bg-slate-800/60 animate-pulse" />
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <article
              v-for="quiz in featuredQuizzes"
              :key="quiz.id"
              class="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between hover:border-amber-500/50 transition-colors"
            >
              <div>
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span class="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 text-xs font-bold">
                    {{ quiz._count.questions }} câu hỏi
                  </span>
                  <span class="text-xs text-slate-400 uppercase font-semibold">
                    {{ quiz.audience === 'kids' ? 'Thiếu nhi' : quiz.audience === 'youth' ? 'Thanh niên' : 'Mọi lứa tuổi' }}
                  </span>
                </div>
                <h3 class="text-lg font-extrabold text-white mb-2 line-clamp-2">
                  {{ quiz.title }}
                </h3>
                <p class="text-sm text-slate-400 line-clamp-3 mb-4">
                  {{ quiz.description }}
                </p>
              </div>

              <div class="flex items-center gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  class="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 py-2.5 px-4 text-xs font-extrabold text-slate-950 transition-colors"
                  @click="handleHostQuiz(quiz.id)"
                >
                  ▶ Mở Phòng Chiếu (Host)
                </button>
                <router-link
                  :to="`/studio/quiz/${quiz.id}`"
                  class="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 px-3 text-xs font-semibold text-slate-200 transition-colors"
                >
                  Chi tiết
                </router-link>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

