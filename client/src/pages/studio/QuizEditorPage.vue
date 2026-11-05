<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppNavbar from '../../components/AppNavbar.vue';
import { apiFetch } from '../../api';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const quizId = Number(route.params.id);

interface BibleBookItem {
  id: number;
  nameVi: string;
  abbrVi: string;
  testament: 'OT' | 'NT';
  chapters: number;
}

interface QuestionItem {
  id: number;
  position: number;
  type: 'quiz' | 'true_false' | 'type_answer' | 'order' | 'slider' | 'poll';
  content: string;
  imageUrl: string | null;
  timeLimit: number;
  pointsFactor: number;
  bookId: number | null;
  chapter: number | null;
  verseFrom: number | null;
  verseTo: number | null;
  verseText: string | null;
  explanation: string | null;
  hostNotes?: string | null;
  difficulty: number;
  sliderMin: number | null;
  sliderMax: number | null;
  sliderAnswer: number | null;
  sliderTolerance: number | null;
  bibleReference?: string | null;
  options: Array<{ position: number; content: string; isCorrect: boolean }>;
  tags?: string[];
}

interface QuizDetail {
  id: number;
  ownerId: number;
  title: string;
  description: string | null;
  audience: 'kids' | 'teens' | 'youth' | 'adults' | 'all';
  visibility: 'private' | 'church' | 'public';
  status: 'draft' | 'review' | 'approved';
  questions: QuestionItem[];
}

const quiz = ref<QuizDetail | null>(null);
const books = ref<BibleBookItem[]>([]);
const loading = ref(true);
const statusMessage = ref<string | null>(null);

// Form thêm / sửa câu hỏi
const editingQuestionId = ref<number | null>(null);
const qType = ref<'quiz' | 'true_false' | 'type_answer' | 'order' | 'slider' | 'poll'>('quiz');
const qContent = ref('');
const qImageUrl = ref<string | null>(null);
const uploadingImage = ref(false);
const qTimeLimit = ref(20);
const qPointsFactor = ref(1);
const qBookId = ref<number | null>(1);
const qChapter = ref<number | null>(1);
const qVerseFrom = ref<number | null>(1);
const qVerseTo = ref<number | null>(null);
const qVerseText = ref('');
const qExplanation = ref('');
const qHostNotes = ref('');
const qDifficulty = ref(2);
const qTagsText = ref('Cựu Ước; Nhân vật');
const qSliderMin = ref(0);
const qSliderMax = ref(1000);
const qSliderAnswer = ref(100);
const qSliderTolerance = ref(5);

const qOptions = ref<Array<{ content: string; isCorrect: boolean }>>([
  { content: '', isCorrect: true },
  { content: '', isCorrect: false },
  { content: '', isCorrect: false },
  { content: '', isCorrect: false }
]);

async function loadQuizAndBooks() {
  loading.value = true;
  try {
    const [qRes, bRes] = await Promise.all([
      apiFetch<{ quiz: QuizDetail }>(`/api/quizzes/${quizId}`),
      apiFetch<{ books: BibleBookItem[] }>('/api/bible-books')
    ]);
    quiz.value = qRes.quiz;
    books.value = bRes.books;
  } finally {
    loading.value = false;
  }
}

function resetQuestionForm() {
  editingQuestionId.value = null;
  qType.value = 'quiz';
  qContent.value = '';
  qImageUrl.value = null;
  qTimeLimit.value = 20;
  qPointsFactor.value = 1;
  qBookId.value = 1;
  qChapter.value = 1;
  qVerseFrom.value = 1;
  qVerseTo.value = null;
  qVerseText.value = '';
  qExplanation.value = '';
  qHostNotes.value = '';
  qDifficulty.value = 2;
  qOptions.value = [
    { content: '', isCorrect: true },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false }
  ];
}

function handleTypeChange() {
  if (qType.value === 'true_false') {
    qOptions.value = [
      { content: 'Đúng', isCorrect: true },
      { content: 'Sai', isCorrect: false }
    ];
  } else if (qType.value === 'type_answer') {
    qOptions.value = [{ content: '', isCorrect: true }];
  } else if (qOptions.value.length < 4) {
    qOptions.value = [
      { content: '', isCorrect: true },
      { content: '', isCorrect: false },
      { content: '', isCorrect: false },
      { content: '', isCorrect: false }
    ];
  }
}

function editQuestion(q: QuestionItem) {
  editingQuestionId.value = q.id;
  qType.value = q.type;
  qContent.value = q.content;
  qImageUrl.value = q.imageUrl ?? null;
  qTimeLimit.value = q.timeLimit;
  qPointsFactor.value = q.pointsFactor;
  qBookId.value = q.bookId;
  qChapter.value = q.chapter;
  qVerseFrom.value = q.verseFrom;
  qVerseTo.value = q.verseTo;
  qVerseText.value = q.verseText ?? '';
  qExplanation.value = q.explanation ?? '';
  qHostNotes.value = q.hostNotes ?? '';
  qDifficulty.value = q.difficulty;
  qTagsText.value = (q.tags ?? []).join('; ');
  qSliderMin.value = q.sliderMin ?? 0;
  qSliderMax.value = q.sliderMax ?? 1000;
  qSliderAnswer.value = q.sliderAnswer ?? 100;
  qSliderTolerance.value = q.sliderTolerance ?? 5;
  qOptions.value = q.options.map((o) => ({
    content: o.content,
    isCorrect: o.isCorrect
  }));
}

async function saveQuizMetadata() {
  if (!quiz.value) return;
  await apiFetch(`/api/quizzes/${quiz.value.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: quiz.value.title,
      description: quiz.value.description,
      audience: quiz.value.audience,
      visibility: quiz.value.visibility,
      status: quiz.value.status
    })
  });
  statusMessage.value = '✅ Đã lưu thông tin bộ câu hỏi.';
  setTimeout(() => (statusMessage.value = null), 3000);
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploadingImage.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData
    });
    qImageUrl.value = res.url;
    statusMessage.value = '✅ Đã tải ảnh minh hoạ câu hỏi lên thành công.';
  } catch (err) {
    statusMessage.value = err instanceof Error ? `❌ ${err.message}` : '❌ Lỗi tải ảnh lên.';
  } finally {
    uploadingImage.value = false;
    input.value = '';
  }
}

async function saveQuestion() {
  if (!qContent.value.trim()) return;

  const payload = {
    type: qType.value,
    content: qContent.value.trim(),
    imageUrl: qImageUrl.value,
    timeLimit: qTimeLimit.value,
    pointsFactor: qPointsFactor.value,
    bookId: qBookId.value,
    chapter: qChapter.value,
    verseFrom: qVerseFrom.value,
    verseTo: qVerseTo.value,
    verseText: qVerseText.value.trim() || null,
    explanation: qExplanation.value.trim() || null,
    hostNotes: qHostNotes.value.trim() || null,
    difficulty: qDifficulty.value,
    sliderMin: qType.value === 'slider' ? qSliderMin.value : null,
    sliderMax: qType.value === 'slider' ? qSliderMax.value : null,
    sliderAnswer: qType.value === 'slider' ? qSliderAnswer.value : null,
    sliderTolerance: qType.value === 'slider' ? qSliderTolerance.value : null,
    options:
      qType.value === 'slider'
        ? [{ position: 0, content: String(qSliderAnswer.value), isCorrect: true }]
        : qOptions.value
            .filter((o) => o.content.trim())
            .map((o, idx) => ({
              position: idx,
              content: o.content.trim(),
              isCorrect: qType.value === 'order' || qType.value === 'type_answer' ? true : o.isCorrect
            })),
    tags: qTagsText.value
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
  };

  if (editingQuestionId.value) {
    await apiFetch(`/api/questions/${editingQuestionId.value}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    statusMessage.value = '✅ Đã cập nhật câu hỏi.';
  } else {
    await apiFetch(`/api/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    statusMessage.value = '✅ Đã thêm câu hỏi mới vào bộ đề.';
  }

  resetQuestionForm();
  await loadQuizAndBooks();
  setTimeout(() => (statusMessage.value = null), 3000);
}

async function deleteQuestion(id: number) {
  await apiFetch(`/api/questions/${id}`, { method: 'DELETE' });
  await loadQuizAndBooks();
}

async function handleExcelUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await apiFetch<{ importedCount: number; errors: string[] }>(
      `/api/quizzes/${quizId}/import-excel`,
      {
        method: 'POST',
        body: formData
      }
    );
    statusMessage.value = `✅ Đã nhập thành công ${res.importedCount} câu hỏi từ file Excel!`;
    await loadQuizAndBooks();
  } catch (err) {
    statusMessage.value = err instanceof Error ? `❌ ${err.message}` : '❌ Lỗi khi nhập file Excel.';
  } finally {
    input.value = '';
  }
}

function downloadExcelTemplate() {
  window.open('/api/template/questions-excel', '_blank');
}

onMounted(() => {
  void loadQuizAndBooks();
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
    <AppNavbar />

    <main v-if="quiz" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
      <!-- Đầu trang + Mở phòng ngay -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <router-link to="/studio" class="text-xs font-bold text-amber-400 hover:underline">
            ← Quay lại Kho câu hỏi
          </router-link>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            {{ quiz.title }}
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm"
            @click="router.push(`/host/${quiz.id}`)"
          >
            ▶ Mở Phòng Chiếu Ngay ({{ quiz.questions.length }} câu)
          </button>
        </div>
      </div>

      <div
        v-if="statusMessage"
        role="status"
        class="rounded-xl border border-amber-500/40 bg-amber-500/15 p-3.5 text-sm font-bold text-amber-200"
      >
        {{ statusMessage }}
      </div>

      <!-- Khối 1: Thông tin bộ câu hỏi & Nhập hàng loạt từ Excel (mục 4.1 & 10.4) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 class="text-base font-extrabold text-white">Thông Tin Chung & Kiểm Duyệt Nội Dung</h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-400 mb-1">Tiêu đề bộ câu hỏi</label>
              <input
                v-model="quiz.title"
                type="text"
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-400 mb-1">Lứa tuổi</label>
              <select
                v-model="quiz.audience"
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">Mọi lứa tuổi</option>
                <option value="kids">Thiếu nhi</option>
                <option value="teens">Thiếu niên</option>
                <option value="youth">Thanh niên</option>
                <option value="adults">Người lớn</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-400 mb-1">Trạng thái duyệt giáo lý</label>
              <select
                v-model="quiz.status"
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="draft">Bản nháp (Draft)</option>
                <option value="review">Gửi Ban Giáo Dục duyệt</option>
                <option v-if="auth.isEditorOrAdmin" value="approved">Đã duyệt vào kho chung</option>
              </select>
            </div>
          </div>

          <div v-if="auth.isAuthenticated" class="pt-2">
            <button
              type="button"
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white"
              @click="saveQuizMetadata"
            >
              Lưu Thông Tin Bộ Đề
            </button>
          </div>
        </div>

        <!-- Khối Nhập Excel Hàng Loạt -->
        <div class="lg:col-span-5 rounded-2xl border-2 border-emerald-500/30 bg-slate-900 p-6 flex flex-col justify-between space-y-4">
          <div>
            <span class="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 text-xs font-bold uppercase">
              Nhập Nhanh Hàng Trăm Câu
            </span>
            <h2 class="text-lg font-extrabold text-white mt-2">
              Nhập Câu Hỏi Hàng Loạt Từ Excel (.xlsx)
            </h2>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">
              Tải file Excel mẫu có sẵn cột Sách, Chương, Câu, Câu gốc 1925 và Giải thích. Điền danh sách câu hỏi rồi tải lên để nạp tự động.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
              @click="downloadExcelTemplate"
            >
              📥 Tải File Excel Mẫu (.xlsx)
            </button>

            <label
              v-if="auth.isAuthenticated"
              class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              📤 Tải Lên File Excel Câu Hỏi
              <input
                type="file"
                accept=".xlsx"
                class="hidden"
                @change="handleExcelUpload"
              />
            </label>
          </div>
        </div>
      </div>

      <!-- Khối 2: Danh sách câu hỏi hiện có + Form thêm/sửa câu hỏi -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- Cột trái: Danh sách các câu hỏi -->
        <div class="lg:col-span-6 space-y-4">
          <h2 class="text-lg font-extrabold text-white">
            Danh Sách Câu Hỏi ({{ quiz.questions.length }})
          </h2>

          <div
            v-for="(q, idx) in quiz.questions"
            :key="q.id"
            class="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-black text-xs">
                  Câu {{ idx + 1 }}
                </span>
                <span class="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-bold">
                  {{
                    q.type === 'quiz'
                      ? 'Trắc nghiệm'
                      : q.type === 'true_false'
                      ? 'Đúng/Sai'
                      : q.type === 'type_answer'
                      ? 'Điền câu gốc'
                      : q.type === 'order'
                      ? 'Sắp xếp thứ tự'
                      : q.type === 'slider'
                      ? 'Thanh trượt số'
                      : 'Thăm dò'
                  }}
                </span>
                <span
                  v-if="q.bibleReference"
                  class="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 text-xs font-bold"
                >
                  📖 {{ q.bibleReference }}
                </span>
              </div>

              <div v-if="auth.isAuthenticated" class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-xs font-bold text-amber-400 hover:underline"
                  @click="editQuestion(q)"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  class="text-xs font-bold text-red-400 hover:underline"
                  @click="deleteQuestion(q.id)"
                >
                  Xoá
                </button>
              </div>
            </div>

            <p class="font-bold text-white text-base">{{ q.content }}</p>

            <div class="grid grid-cols-2 gap-2 text-xs">
              <div
                v-for="opt in q.options"
                :key="opt.position"
                class="rounded-lg px-3 py-2 border"
                :class="opt.isCorrect ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold' : 'border-slate-800 bg-slate-950 text-slate-400'"
              >
                {{ opt.isCorrect ? '✓ ' : '' }}{{ opt.content }}
              </div>
            </div>

            <p v-if="q.verseText" class="text-xs font-serif italic text-amber-200/90 border-l-2 border-amber-500 pl-2.5">
              “{{ q.verseText }}”
            </p>
          </div>
        </div>

        <!-- Cột phải: Trình soạn thảo câu hỏi Kinh Thánh -->
        <div
          v-if="auth.isAuthenticated"
          class="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 sticky top-20"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-extrabold text-white">
              {{ editingQuestionId ? '✏️ Chỉnh Sửa Câu Hỏi' : '➕ Thêm Câu Hỏi Kinh Thánh Mới' }}
            </h2>
            <button
              v-if="editingQuestionId"
              type="button"
              class="text-xs font-bold text-slate-400 hover:text-white"
              @click="resetQuestionForm"
            >
              Huỷ sửa
            </button>
          </div>

          <form class="space-y-4" @submit.prevent="saveQuestion">
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Loại câu hỏi</label>
                <select
                  v-model="qType"
                  class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                  @change="handleTypeChange"
                >
                  <option value="quiz">Trắc nghiệm 4 đáp án</option>
                  <option value="true_false">Đúng / Sai</option>
                  <option value="type_answer">Điền câu gốc / Gõ chữ</option>
                  <option value="order">Sắp xếp thứ tự</option>
                  <option value="slider">Thanh trượt (Con số)</option>
                  <option value="poll">Thăm dò ý kiến (Poll)</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Thời gian (giây)</label>
                <input
                  v-model.number="qTimeLimit"
                  type="number"
                  min="5"
                  max="240"
                  class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Hệ số điểm</label>
                <select
                  v-model.number="qPointsFactor"
                  class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                >
                  <option :value="1">Chuẩn (1000 đ)</option>
                  <option :value="2">Nhân đôi (2000 đ)</option>
                  <option :value="0">Không tính điểm</option>
                </select>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-bold text-slate-300">Nội dung câu hỏi</label>
                <span
                  class="text-[11px] font-semibold"
                  :class="qContent.length > 120 ? 'text-amber-400' : 'text-slate-400'"
                >
                  {{ qContent.length }}/120 ký tự khuyến nghị
                </span>
              </div>
              <textarea
                v-model="qContent"
                rows="2"
                required
                placeholder="Nhập câu hỏi đố Kinh Thánh..."
                class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <!-- Tải ảnh minh hoạ câu hỏi (tranh Kinh Thánh, bản đồ...) -->
            <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div class="flex items-center gap-3 min-w-0">
                <img
                  v-if="qImageUrl"
                  :src="qImageUrl"
                  alt="Ảnh câu hỏi"
                  class="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                />
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-200">Ảnh minh hoạ câu hỏi (JPG/PNG/WebP)</p>
                  <p class="text-[11px] text-slate-400 truncate">
                    {{ qImageUrl || 'Chưa chọn ảnh (chỉ chiếu trên màn hình Host)' }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  v-if="qImageUrl"
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg border border-red-500/40 text-red-300 text-xs font-bold"
                  @click="qImageUrl = null"
                >
                  Xoá ảnh
                </button>
                <label class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 cursor-pointer">
                  {{ uploadingImage ? 'Đang tải...' : '🖼️ Chọn ảnh' }}
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" class="hidden" @change="handleImageUpload" />
                </label>
              </div>
            </div>

            <!-- Cấu hình đáp án theo loại câu hỏi -->
            <div v-if="qType === 'slider'" class="grid grid-cols-4 gap-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <label class="block text-[11px] font-bold text-slate-400">Số nhỏ nhất</label>
                <input v-model.number="qSliderMin" type="number" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-400">Số lớn nhất</label>
                <input v-model.number="qSliderMax" type="number" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-amber-400">Đáp án đúng</label>
                <input v-model.number="qSliderAnswer" type="number" class="w-full rounded-lg border border-amber-500 bg-slate-900 px-2 py-1.5 text-xs text-white font-bold" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-400">Sai số (±)</label>
                <input v-model.number="qSliderTolerance" type="number" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
              </div>
            </div>

            <div v-else class="space-y-2">
              <label class="block text-xs font-bold text-slate-300">
                {{
                  qType === 'type_answer'
                    ? 'Đáp án chấp nhận (ngăn cách các cách viết bởi dấu |, VD: Con một|Con Độc Sanh)'
                    : qType === 'order'
                    ? 'Nhập các mục theo ĐÚNG THỨ TỰ từ 1 đến 4 (khi chơi hệ thống sẽ tự xáo trộn)'
                    : 'Các phương án trả lời (tích chọn đáp án đúng)'
                }}
              </label>

              <div
                v-for="(opt, idx) in qOptions"
                :key="idx"
                class="flex items-center gap-2"
              >
                <input
                  v-if="qType === 'quiz' || qType === 'true_false'"
                  v-model="opt.isCorrect"
                  type="checkbox"
                  class="w-4 h-4 accent-emerald-500"
                  :title="'Đánh dấu là đáp án đúng'"
                />
                <span v-else class="text-xs font-black text-amber-400 w-5">#{{ idx + 1 }}</span>

                <input
                  v-model="opt.content"
                  type="text"
                  :placeholder="`Phương án ${idx + 1}`"
                  class="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <!-- Tham chiếu Kinh Thánh (Sách - Chương - Câu) & Câu gốc 1925 -->
            <div class="rounded-xl border border-amber-500/30 bg-slate-950 p-4 space-y-3">
              <p class="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                📖 Tham Chiếu Kinh Thánh & Giải Thích Mục Vụ
              </p>

              <div class="grid grid-cols-4 gap-2">
                <div class="col-span-2">
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Sách (66 sách)</label>
                  <select
                    v-model="qBookId"
                    class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option :value="null">-- Chọn sách --</option>
                    <option v-for="b in books" :key="b.id" :value="b.id">
                      {{ b.id }}. {{ b.nameVi }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Chương</label>
                  <input
                    v-model.number="qChapter"
                    type="number"
                    min="1"
                    class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Câu</label>
                  <input
                    v-model.number="qVerseFrom"
                    type="number"
                    min="1"
                    class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-400 mb-1">
                  Trích dẫn câu gốc (Bản Truyền Thống 1925)
                </label>
                <textarea
                  v-model="qVerseText"
                  rows="2"
                  placeholder="VD: Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con một của Ngài..."
                  class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-400 mb-1">
                  Giải thích / Bài học áp dụng (1–3 câu hiện sau khi mở đáp án)
                </label>
                <textarea
                  v-model="qExplanation"
                  rows="2"
                  placeholder="Ý nghĩa thuộc linh hoặc bối cảnh Kinh Thánh..."
                  class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-400 mb-1">
                  🔒 Ghi chú riêng cho người dẫn (chỉ hiện trên điện thoại điều khiển, không chiếu)
                </label>
                <textarea
                  v-model="qHostNotes"
                  rows="2"
                  maxlength="2000"
                  placeholder="VD: Hỏi thêm cả hội chúng: 'Có ai từng được Chúa cứu như Giô-na không?' — chia sẻ 1 phút."
                  class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-sm font-extrabold text-slate-950"
            >
              {{ editingQuestionId ? 'Lưu Cập Nhật Câu Hỏi' : '+ Thêm Câu Hỏi Vào Bộ Đề' }}
            </button>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

