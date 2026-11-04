<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppNavbar from '../../components/AppNavbar.vue';
import { apiFetch } from '../../api';

const route = useRoute();

interface SessionItem {
  id: number;
  pin: string;
  mode: string;
  playerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  quiz: { id: number; title: string };
  host: { id: number; displayName: string };
  _count: { players: number };
}

interface SessionReportDetail {
  session: {
    id: number;
    pin: string;
    mode: string;
    playerCount: number;
    startedAt: string | null;
    endedAt: string | null;
    quizTitle: string;
    hostName: string;
  };
  players: Array<{
    id: number;
    nickname: string;
    teamName: string | null;
    finalScore: number;
    finalRank: number;
    correctCount: number;
    totalQuestions: number;
  }>;
  questionStats: Array<{
    questionId: number;
    position: number;
    content: string;
    type: string;
    bibleReference: string | null;
    totalAnswers: number;
    correctAnswers: number;
    accuracyPercent: number;
    avgResponseMs: number;
  }>;
}

const sessions = ref<SessionItem[]>([]);
const selectedReport = ref<SessionReportDetail | null>(null);
const loading = ref(true);

async function loadSessions() {
  loading.value = true;
  try {
    const res = await apiFetch<{ sessions: SessionItem[] }>('/api/reports');
    sessions.value = res.sessions;

    const querySessionId = Number(route.query.session);
    if (querySessionId) {
      await selectSession(querySessionId);
    } else if (res.sessions.length > 0) {
      await selectSession(res.sessions[0].id);
    }
  } finally {
    loading.value = false;
  }
}

async function selectSession(sessionId: number) {
  const res = await apiFetch<SessionReportDetail>(`/api/reports/${sessionId}`);
  selectedReport.value = res;
}

function downloadExcel(sessionId: number) {
  window.open(`/api/reports/${sessionId}/export`, '_blank');
}

onMounted(() => {
  void loadSessions();
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
    <AppNavbar />

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white">
          Báo Cáo Kết Quả & Phân Tích Học Lời Chúa
        </h1>
        <p class="text-sm text-slate-400 mt-1">
          Xem bảng xếp hạng, câu hỏi nào nhiều người trả lời sai để ôn tập thêm và xuất báo cáo Excel
        </p>
      </div>

      <div
        v-if="!loading && sessions.length === 0"
        class="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center"
      >
        <p class="text-lg font-bold text-white">Chưa có trận đấu nào được lưu báo cáo.</p>
        <p class="text-sm text-slate-400 mt-1">Hãy mở một phòng chơi và hoàn thành trận đấu để xem thống kê chi tiết tại đây.</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Cột trái: Danh sách các lần tổ chức -->
        <div class="lg:col-span-4 space-y-3">
          <h2 class="text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Lịch sử các buổi đố Kinh Thánh
          </h2>
          <button
            v-for="s in sessions"
            :key="s.id"
            type="button"
            class="w-full text-left rounded-xl border p-4 transition-colors"
            :class="
              selectedReport?.session.id === s.id
                ? 'border-amber-500 bg-slate-900'
                : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900'
            "
            @click="selectSession(s.id)"
          >
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                PIN {{ s.pin }}
              </span>
              <span class="text-slate-400">{{ s._count.players }} người chơi</span>
            </div>
            <p class="font-bold text-white text-sm line-clamp-1">{{ s.quiz.title }}</p>
            <p class="text-xs text-slate-400 mt-1">
              Người dẫn: {{ s.host.displayName }}
            </p>
          </button>
        </div>

        <!-- Cột phải: Chi tiết trận đấu đã chọn -->
        <div v-if="selectedReport" class="lg:col-span-8 space-y-6">
          <div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-amber-400">
                Phiên #{{ selectedReport.session.id }} • PIN {{ selectedReport.session.pin }}
              </span>
              <h2 class="text-xl font-extrabold text-white mt-1">
                {{ selectedReport.session.quizTitle }}
              </h2>
              <p class="text-xs text-slate-400 mt-1">
                Số người tham gia: {{ selectedReport.session.playerCount }} • Người dẫn: {{ selectedReport.session.hostName }}
              </p>
            </div>

            <button
              type="button"
              class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs"
              @click="downloadExcel(selectedReport.session.id)"
            >
              📥 Xuất Báo Cáo Excel (.xlsx)
            </button>
          </div>

          <!-- Phân tích tỉ lệ đúng từng câu hỏi (Câu nào cần ôn thêm) -->
          <div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 class="text-base font-extrabold text-white">
              📖 Thống Kê Theo Câu Hỏi (Phát hiện câu khó cần giải thích thêm)
            </h3>

            <div class="space-y-3">
              <div
                v-for="qs in selectedReport.questionStats"
                :key="qs.questionId"
                class="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div class="flex items-center gap-2 text-xs mb-1">
                    <span class="font-black text-amber-400">Câu {{ qs.position }}</span>
                    <span v-if="qs.bibleReference" class="text-slate-400">• {{ qs.bibleReference }}</span>
                  </div>
                  <p class="text-sm font-bold text-white">{{ qs.content }}</p>
                </div>

                <div class="flex items-center gap-4 shrink-0">
                  <div class="text-right">
                    <span
                      class="text-base font-black"
                      :class="qs.accuracyPercent < 50 ? 'text-red-400' : 'text-emerald-400'"
                    >
                      {{ qs.accuracyPercent }}% đúng
                    </span>
                    <span class="block text-[11px] text-slate-400">
                      ({{ qs.correctAnswers }}/{{ qs.totalAnswers }} người • TB {{ (qs.avgResponseMs / 1000).toFixed(1) }}s)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bảng xếp hạng người chơi -->
          <div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 class="text-base font-extrabold text-white">
              🏆 Bảng Kết Quả Người Chơi ({{ selectedReport.players.length }})
            </h3>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th class="py-2.5 pr-3">Hạng</th>
                    <th class="py-2.5 px-3">Biệt danh</th>
                    <th class="py-2.5 px-3">Đội</th>
                    <th class="py-2.5 px-3">Số câu đúng</th>
                    <th class="py-2.5 pl-3 text-right">Tổng điểm</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/70">
                  <tr v-for="p in selectedReport.players" :key="p.id">
                    <td class="py-2.5 pr-3 font-black text-amber-400">#{{ p.finalRank }}</td>
                    <td class="py-2.5 px-3 font-bold text-white">{{ p.nickname }}</td>
                    <td class="py-2.5 px-3 text-slate-400">{{ p.teamName || '-' }}</td>
                    <td class="py-2.5 px-3 text-slate-200">
                      {{ p.correctCount }} / {{ p.totalQuestions }}
                    </td>
                    <td class="py-2.5 pl-3 text-right font-extrabold text-amber-400">
                      {{ p.finalScore.toLocaleString('vi-VN') }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

