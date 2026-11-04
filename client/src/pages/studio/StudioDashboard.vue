<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppNavbar from '../../components/AppNavbar.vue';
import { apiFetch } from '../../api';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();

interface BibleBookItem {
  id: number;
  nameVi: string;
  abbrVi: string;
  testament: 'OT' | 'NT';
}

interface QuizSummary {
  id: number;
  ownerId: number;
  title: string;
  description: string | null;
  audience: string;
  visibility: string;
  status: 'draft' | 'review' | 'approved';
  owner: { id: number; displayName: string; churchName: string | null };
  _count: { questions: number; gameSessions: number };
}

const quizzes = ref<QuizSummary[]>([]);
const books = ref<BibleBookItem[]>([]);
const tags = ref<Array<{ id: number; name: string }>>([]);
const loading = ref(true);

// Bộ lọc
const searchQuery = ref('');
const filterTestament = ref<'' | 'OT' | 'NT'>('');
const filterBookId = ref('');
const filterAudience = ref('all');

// Modal tạo bộ câu hỏi mới
const showCreateModal = ref(false);
const newTitle = ref('');
const newDesc = ref('');
const newAudience = ref<'kids' | 'teens' | 'youth' | 'adults' | 'all'>('all');

// Modal tạo đề ngẫu nhiên từ kho (mục 4.2)
const showRandomModal = ref(false);
const randTitle = ref('Đố Kinh Thánh Tổng Hợp Ngẫu Nhiên');
const randTestament = ref<'ALL' | 'OT' | 'NT'>('ALL');
const randBookId = ref<string>('');
const randTagName = ref<string>('');
const randCount = ref<number>(10);
const randError = ref<string | null>(null);

async function loadData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value.trim()) params.set('search', searchQuery.value.trim());
    if (filterTestament.value) params.set('testament', filterTestament.value);
    if (filterBookId.value) params.set('bookId', filterBookId.value);
    if (filterAudience.value !== 'all') params.set('audience', filterAudience.value);

    const [qRes, bRes, tRes] = await Promise.all([
      apiFetch<{ quizzes: QuizSummary[] }>(`/api/quizzes?${params.toString()}`),
      apiFetch<{ books: BibleBookItem[] }>('/api/bible-books'),
      apiFetch<{ tags: Array<{ id: number; name: string }> }>('/api/tags')
    ]);

    quizzes.value = qRes.quizzes;
    books.value = bRes.books;
    tags.value = tRes.tags;
  } finally {
    loading.value = false;
  }
}

function handleStartHost(quizId: number) {
  if (!auth.isAuthenticated) {
    void router.push({ path: '/login', query: { redirect: `/host/${quizId}` } });
    return;
  }
  void router.push(`/host/${quizId}`);
}

async function handleCreateQuiz() {
  if (!newTitle.value.trim()) return;
  const res = await apiFetch<{ quiz: { id: number } }>('/api/quizzes', {
    method: 'POST',
    body: JSON.stringify({
      title: newTitle.value.trim(),
      description: newDesc.value.trim(),
      audience: newAudience.value,
      visibility: 'public'
    })
  });
  showCreateModal.value = false;
  await router.push(`/studio/quiz/${res.quiz.id}`);
}

async function handleGenerateRandomQuiz() {
  randError.value = null;
  try {
    const res = await apiFetch<{ quiz: { id: number } }>('/api/quizzes/generate-random', {
      method: 'POST',
      body: JSON.stringify({
        title: randTitle.value,
        testament: randTestament.value,
        bookId: randBookId.value ? Number(randBookId.value) : undefined,
        tagName: randTagName.value || undefined,
        count: randCount.value
      })
    });
    showRandomModal.value = false;
    await router.push(`/studio/quiz/${res.quiz.id}`);
  } catch (err) {
    randError.value = err instanceof Error ? err.message : 'Không thể tạo bộ câu hỏi ngẫu nhiên.';
  }
}

onMounted(() => {
  void loadData();
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
    <AppNavbar />

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
      <!-- Đầu trang + Nút tạo nhanh -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white">
            Kho Câu Hỏi Kinh Thánh & Soạn Bài
          </h1>
          <p class="text-sm text-slate-400 mt-1">
            Phân loại theo 66 sách Kinh Điển Tin Lành (39 Cựu Ước, 27 Tân Ước), chủ đề và lứa tuổi
          </p>
        </div>

        <div v-if="auth.isAuthenticated" class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs transition-colors"
            @click="showRandomModal = true"
          >
            🎲 Rút Đề Ngẫu Nhiên Từ Kho
          </button>

          <button
            type="button"
            class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-colors"
            @click="showCreateModal = true"
          >
            + Tạo Bộ Câu Hỏi Mới
          </button>
        </div>
      </div>

      <!-- Thanh bộ lọc Kho câu hỏi -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="lg:col-span-2">
          <label for="filter-search" class="block text-[11px] font-bold uppercase text-slate-400 mb-1">
            Tìm kiếm tiêu đề
          </label>
          <input
            id="filter-search"
            v-model="searchQuery"
            type="search"
            placeholder="Nhập tên bộ câu hỏi..."
            class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            @keyup.enter="loadData"
          />
        </div>

        <div>
          <label for="filter-testament" class="block text-[11px] font-bold uppercase text-slate-400 mb-1">
            Phần Kinh Thánh
          </label>
          <select
            id="filter-testament"
            v-model="filterTestament"
            class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            @change="loadData"
          >
            <option value="">Tất cả (Cựu & Tân Ước)</option>
            <option value="OT">Cựu Ước (39 sách)</option>
            <option value="NT">Tân Ước (27 sách)</option>
          </select>
        </div>

        <div>
          <label for="filter-book" class="block text-[11px] font-bold uppercase text-slate-400 mb-1">
            Sách Kinh Thánh
          </label>
          <select
            id="filter-book"
            v-model="filterBookId"
            class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            @change="loadData"
          >
            <option value="">Tất cả 66 sách</option>
            <option v-for="b in books" :key="b.id" :value="String(b.id)">
              {{ b.id }}. {{ b.nameVi }}
            </option>
          </select>
        </div>

        <div>
          <label for="filter-audience" class="block text-[11px] font-bold uppercase text-slate-400 mb-1">
            Đối tượng / Ban ngành
          </label>
          <select
            id="filter-audience"
            v-model="filterAudience"
            class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            @change="loadData"
          >
            <option value="all">Tất cả lứa tuổi</option>
            <option value="kids">Thiếu nhi</option>
            <option value="teens">Thiếu niên</option>
            <option value="youth">Thanh niên</option>
            <option value="adults">Tráng niên / Người lớn</option>
          </select>
        </div>
      </div>

      <!-- Danh sách bộ câu hỏi -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="i in 3" :key="i" class="h-56 rounded-2xl bg-slate-900 animate-pulse" />
      </div>

      <div
        v-else-if="quizzes.length === 0"
        class="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center"
      >
        <p class="text-lg font-bold text-white">Không tìm thấy bộ câu hỏi nào khớp với bộ lọc.</p>
        <p class="text-sm text-slate-400 mt-1">Hãy thử đổi bộ lọc hoặc tạo một bộ câu hỏi mới.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <article
          v-for="quiz in quizzes"
          :key="quiz.id"
          class="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between hover:border-amber-500/40 transition-colors"
        >
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 text-xs font-bold">
                  {{ quiz._count.questions }} câu
                </span>
                <span
                  class="px-2 py-0.5 rounded text-[11px] font-bold uppercase"
                  :class="
                    quiz.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : quiz.status === 'review'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  "
                >
                  {{ quiz.status === 'approved' ? 'Đã duyệt' : quiz.status === 'review' ? 'Chờ duyệt' : 'Bản nháp' }}
                </span>
              </div>
              <span class="text-xs text-slate-400">
                {{ quiz._count.gameSessions }} lượt tổ chức
              </span>
            </div>

            <h2 class="text-lg font-extrabold text-white mb-2">
              {{ quiz.title }}
            </h2>
            <p class="text-sm text-slate-400 line-clamp-3 mb-4">
              {{ quiz.description || 'Chưa có mô tả.' }}
            </p>
          </div>

          <div class="space-y-3 pt-4 border-t border-slate-800">
            <div class="text-xs text-slate-400 flex items-center justify-between">
              <span>Biên soạn: <strong class="text-slate-200">{{ quiz.owner.displayName }}</strong></span>
              <span>{{ quiz.audience === 'kids' ? 'Thiếu nhi' : quiz.audience === 'youth' ? 'Thanh niên' : 'Chung' }}</span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 px-4 text-xs font-extrabold text-slate-950 transition-colors"
                @click="handleStartHost(quiz.id)"
              >
                ▶ Mở Phòng Chiếu (Host)
              </button>
              <router-link
                :to="`/studio/quiz/${quiz.id}`"
                class="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 px-3.5 text-xs font-bold text-slate-200"
              >
                ✏️ Soạn / Excel
              </router-link>
            </div>
          </div>
        </article>
      </div>
    </main>

    <!-- Modal Tạo Bộ Câu Hỏi Mới -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <h2 class="text-xl font-extrabold text-white">Tạo Bộ Câu Hỏi Kinh Thánh Mới</h2>

        <form class="space-y-4" @submit.prevent="handleCreateQuiz">
          <div>
            <label for="new-quiz-title" class="block text-xs font-bold text-slate-300 mb-1">
              Tiêu đề bộ câu hỏi
            </label>
            <input
              id="new-quiz-title"
              v-model="newTitle"
              type="text"
              required
              placeholder="VD: Đố Kinh Thánh Sách Công Vụ Các Sứ Đồ"
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
            />
          </div>

          <div>
            <label for="new-quiz-desc" class="block text-xs font-bold text-slate-300 mb-1">
              Mô tả ngắn / Dịp sinh hoạt
            </label>
            <textarea
              id="new-quiz-desc"
              v-model="newDesc"
              rows="3"
              placeholder="Dùng cho buổi nhóm Ban Thanh Niên / Trường Chúa Nhật..."
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
            />
          </div>

          <div>
            <label for="new-quiz-audience" class="block text-xs font-bold text-slate-300 mb-1">
              Lứa tuổi phù hợp
            </label>
            <select
              id="new-quiz-audience"
              v-model="newAudience"
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
            >
              <option value="all">Mọi lứa tuổi</option>
              <option value="kids">Thiếu nhi</option>
              <option value="teens">Thiếu niên</option>
              <option value="youth">Thanh niên</option>
              <option value="adults">Người lớn</option>
            </select>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300"
              @click="showCreateModal = false"
            >
              Huỷ
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-extrabold text-slate-950"
            >
              Tạo & Bắt Đầu Soạn Câu Hỏi →
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Tạo Đề Ngẫu Nhiên Từ Kho -->
    <div
      v-if="showRandomModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <h2 class="text-xl font-extrabold text-white">🎲 Tạo Bộ Câu Hỏi Ngẫu Nhiên Từ Kho</h2>
        <p class="text-xs text-slate-400">
          Hệ thống tự động rút ngẫu nhiên các câu hỏi trong kho theo sách và chủ đề bạn chọn.
        </p>

        <div
          v-if="randError"
          class="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-bold text-red-300"
        >
          {{ randError }}
        </div>

        <form class="space-y-4" @submit.prevent="handleGenerateRandomQuiz">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Tên bộ đề mới</label>
            <input
              v-model="randTitle"
              type="text"
              required
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Phần Kinh Thánh</label>
              <select
                v-model="randTestament"
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="ALL">Cả Cựu & Tân Ước</option>
                <option value="OT">Chỉ Cựu Ước</option>
                <option value="NT">Chỉ Tân Ước</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Số lượng câu hỏi</label>
              <input
                v-model.number="randCount"
                type="number"
                min="1"
                max="50"
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Sách cụ thể (tuỳ chọn)</label>
              <select
                v-model="randBookId"
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">Tất cả các sách</option>
                <option v-for="b in books" :key="b.id" :value="String(b.id)">
                  {{ b.nameVi }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Chủ đề (tuỳ chọn)</label>
              <select
                v-model="randTagName"
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">Tất cả chủ đề</option>
                <option v-for="t in tags" :key="t.id" :value="t.name">
                  {{ t.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300"
              @click="showRandomModal = false"
            >
              Huỷ
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-extrabold text-slate-950"
            >
              Tạo Đề Ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

