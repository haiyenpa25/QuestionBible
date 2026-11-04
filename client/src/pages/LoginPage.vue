<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AppNavbar from '../components/AppNavbar.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const isDev = import.meta.env.DEV;
const email = ref(isDev ? 'host@questionbible.vn' : '');
const password = ref(isDev ? 'Host@123' : '');
const errorMsg = ref<string | null>(null);

async function handleSubmit() {
  errorMsg.value = null;
  try {
    await auth.login(email.value, password.value);
    const redirect = (route.query.redirect as string) || '/studio';
    await router.push(redirect);
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Đăng nhập thất bại.';
  }
}

function fillDemoAccount(role: 'host' | 'editor' | 'admin') {
  if (role === 'host') {
    email.value = 'host@questionbible.vn';
    password.value = 'Host@123';
  } else if (role === 'editor') {
    email.value = 'giaoduc@questionbible.vn';
    password.value = 'Editor@123';
  } else {
    email.value = 'admin@questionbible.vn';
    password.value = 'Admin@123';
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
    <AppNavbar />

    <main class="flex-1 flex items-center justify-center p-4">
      <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-xl">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-extrabold text-white">Đăng Nhập Người Dẫn / Ban Giáo Dục</h1>
          <p class="text-xs text-slate-400 mt-1">
            Người chơi trên điện thoại không cần đăng nhập (chỉ cần nhập PIN tại trang /play)
          </p>
        </div>

        <div
          v-if="errorMsg"
          role="alert"
          class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-300"
        >
          {{ errorMsg }}
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label for="login-email" class="block text-xs font-bold text-slate-300 mb-1.5">
              Email tài khoản
            </label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              required
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label for="login-password" class="block text-xs font-bold text-slate-300 mb-1.5">
              Mật khẩu
            </label>
            <input
              id="login-password"
              v-model="password"
              type="password"
              required
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            :disabled="auth.loading"
            class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-3 text-sm font-extrabold text-slate-950 transition-colors"
          >
            {{ auth.loading ? 'Đang xác thực...' : 'Đăng Nhập' }}
          </button>
        </form>

        <!-- Chỉ hiện nút chọn nhanh tài khoản mẫu ở môi trường phát triển (Sửa lỗi #2) -->
        <div v-if="isDev" class="mt-6 pt-5 border-t border-slate-800">
          <p class="text-xs font-semibold text-slate-400 mb-2.5 text-center">
            Tài khoản mẫu có sẵn (bấm để điền nhanh):
          </p>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 px-2 text-xs font-semibold text-slate-200"
              @click="fillDemoAccount('host')"
            >
              Người dẫn (Host)
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 px-2 text-xs font-semibold text-slate-200"
              @click="fillDemoAccount('editor')"
            >
              Ban Giáo Dục
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 px-2 text-xs font-semibold text-slate-200"
              @click="fillDemoAccount('admin')"
            >
              Quản Trị Viên
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

