<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

async function handleLogout() {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <header class="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      <div class="flex items-center gap-6">
        <router-link
          to="/"
          class="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white hover:text-amber-400 transition-colors"
        >
          <span class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 text-slate-950 font-black text-xl">
            ✞
          </span>
          <span>Question<span class="text-amber-400">Bible</span></span>
        </router-link>

        <nav class="hidden md:flex items-center gap-1 text-sm font-medium">
          <router-link
            to="/play"
            class="px-3 py-2 rounded-lg transition-colors"
            :class="route.path.startsWith('/play') ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800'"
          >
            Vào phòng chơi (PIN)
          </router-link>
          <router-link
            to="/studio"
            class="px-3 py-2 rounded-lg transition-colors"
            :class="route.path === '/studio' ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800'"
          >
            Kho câu hỏi & Soạn bài
          </router-link>
          <router-link
            v-if="auth.isAuthenticated"
            to="/studio/reports"
            class="px-3 py-2 rounded-lg transition-colors"
            :class="route.path.startsWith('/studio/reports') ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800'"
          >
            Báo cáo kết quả
          </router-link>
          <router-link
            v-if="auth.isAdmin"
            to="/studio/admin"
            class="px-3 py-2 rounded-lg transition-colors"
            :class="route.path.startsWith('/studio/admin') ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800'"
          >
            Quản trị & Giám sát
          </router-link>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="auth.isAuthenticated && auth.user">
          <div class="hidden sm:flex flex-col items-end text-xs">
            <span class="font-bold text-slate-100">{{ auth.user.displayName }}</span>
            <span class="text-amber-400 uppercase tracking-wider text-[10px]">
              {{ auth.user.role === 'admin' ? 'Quản trị viên' : auth.user.role === 'editor' ? 'Ban Giáo Dục' : 'Người dẫn (Host)' }}
            </span>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            @click="handleLogout"
          >
            Đăng xuất
          </button>
        </template>
        <template v-else>
          <router-link
            to="/login"
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
          >
            Đăng nhập Host / Giáo viên
          </router-link>
        </template>
      </div>
    </div>
  </header>
</template>

