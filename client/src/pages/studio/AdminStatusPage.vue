<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppNavbar from '../../components/AppNavbar.vue';
import { apiFetch } from '../../api';

interface ServerStatus {
  uptimeSeconds: number;
  activeRoomCount: number;
  activePlayerSockets: number;
  redisConnected: boolean;
  memoryMb: { rss: number; heapUsed: number; heapTotal: number };
  cpuLoad: number[];
  rooms: Array<{
    pin: string;
    quizTitle: string;
    state: string;
    playerCount: number;
    currentQ: number;
    totalQuestions: number;
    locked: boolean;
  }>;
}

interface ManagedUser {
  id: number;
  email: string;
  displayName: string;
  churchName: string | null;
  role: 'admin' | 'editor' | 'host';
  createdAt: string;
  _count: { quizzes: number; gameSessions: number };
}

const status = ref<ServerStatus | null>(null);
const users = ref<ManagedUser[]>([]);

// Tạo tài khoản mới (mục 4.1: admin tạo, không mở đăng ký tự do)
const newEmail = ref('');
const newPassword = ref('');
const newDisplayName = ref('');
const newChurchName = ref('');
const newRole = ref<'host' | 'editor' | 'admin'>('host');
const feedback = ref<string | null>(null);

async function loadAll() {
  const [st, us] = await Promise.all([
    apiFetch<ServerStatus>('/api/admin/status'),
    apiFetch<{ users: ManagedUser[] }>('/api/users')
  ]);
  status.value = st;
  users.value = us.users;
}

async function handleCreateUser() {
  feedback.value = null;
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        email: newEmail.value,
        password: newPassword.value,
        displayName: newDisplayName.value,
        churchName: newChurchName.value,
        role: newRole.value
      })
    });
    newEmail.value = '';
    newPassword.value = '';
    newDisplayName.value = '';
    feedback.value = '✅ Đã tạo tài khoản mới thành công.';
    await loadAll();
  } catch (err) {
    feedback.value = err instanceof Error ? `❌ ${err.message}` : '❌ Lỗi khi tạo tài khoản.';
  }
}

async function handleDeleteUser(id: number) {
  await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
  await loadAll();
}

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
    <AppNavbar />

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white">
            Quản Trị Tài Khoản & Giám Sát Máy Chủ (/admin/status)
          </h1>
          <p class="text-sm text-slate-400 mt-1">
            Theo dõi số phòng đang chạy, kết nối Socket.IO, RAM/CPU và cấp tài khoản cho Người dẫn / Ban giáo dục
          </p>
        </div>

        <button
          type="button"
          class="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white"
          @click="loadAll"
        >
          🔄 Làm mới trạng thái
        </button>
      </div>

      <!-- 1. Giám sát tài nguyên & phòng đang chạy (mục 13.6) -->
      <div v-if="status" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span class="text-xs font-bold uppercase text-slate-400">Phòng đang chạy</span>
          <p class="text-3xl font-black text-amber-400 mt-1">{{ status.activeRoomCount }}</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span class="text-xs font-bold uppercase text-slate-400">Socket Người chơi</span>
          <p class="text-3xl font-black text-emerald-400 mt-1">{{ status.activePlayerSockets }}</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span class="text-xs font-bold uppercase text-slate-400">RAM Node.js (RSS)</span>
          <p class="text-3xl font-black text-white mt-1">{{ status.memoryMb.rss }} MB</p>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span class="text-xs font-bold uppercase text-slate-400">Trạng thái Redis</span>
          <p class="text-lg font-extrabold mt-2" :class="status.redisConnected ? 'text-emerald-400' : 'text-amber-300'">
            {{ status.redisConnected ? '✅ Redis 7 Connected' : '⚡ RAM Snapshot Mode' }}
          </p>
        </div>
      </div>

      <!-- 2. Quản lý tài khoản Host / Ban Giáo Dục -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 class="text-lg font-extrabold text-white">Cấp Tài Khoản Người Dẫn / Giáo Viên</h2>
          <p class="text-xs text-slate-400">
            Theo phương án bảo mật mục 4.1: không mở đăng ký tự do, chỉ Quản trị viên tạo tài khoản cho Ban giáo dục và Người dẫn.
          </p>

          <div v-if="feedback" class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-bold text-amber-200">
            {{ feedback }}
          </div>

          <form class="space-y-3" @submit.prevent="handleCreateUser">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Họ tên / Ban ngành</label>
              <input v-model="newDisplayName" type="text" required placeholder="VD: Truyền Đạo Nguyễn Văn A" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Hội Thánh</label>
              <input v-model="newChurchName" type="text" placeholder="VD: Hội Thánh Tin Lành..." class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Email đăng nhập</label>
              <input v-model="newEmail" type="email" required placeholder="host2@questionbible.vn" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Mật khẩu</label>
                <input v-model="newPassword" type="password" required class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Vai trò</label>
                <select v-model="newRole" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="host">Người dẫn (Host)</option>
                  <option value="editor">Kiểm duyệt (Editor)</option>
                  <option value="admin">Quản trị (Admin)</option>
                </select>
              </div>
            </div>

            <button type="submit" class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-sm font-extrabold text-slate-950">
              + Tạo Tài Khoản
            </button>
          </form>
        </div>

        <div class="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 class="text-lg font-extrabold text-white">Danh Sách Tài Khoản Hệ Thống ({{ users.length }})</h2>

          <div class="space-y-3">
            <div
              v-for="u in users"
              :key="u.id"
              class="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between gap-4"
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-white">{{ u.displayName }}</span>
                  <span class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold uppercase">
                    {{ u.role }}
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">
                  {{ u.email }} • {{ u.churchName || 'Hội Thánh' }} • {{ u._count.quizzes }} bộ đề
                </p>
              </div>

              <button
                v-if="u.role !== 'admin'"
                type="button"
                class="text-xs font-bold text-red-400 hover:underline"
                @click="handleDeleteUser(u.id)"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

