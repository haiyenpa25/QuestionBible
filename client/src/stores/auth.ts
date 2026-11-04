import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiFetch, setAuthToken, getAuthToken } from '../api';
import { refreshSocketAuth } from '../socket';

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  churchName: string | null;
  role: 'admin' | 'editor' | 'host';
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  const isAuthenticated = computed(() => Boolean(user.value));
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isEditorOrAdmin = computed(
    () => user.value?.role === 'admin' || user.value?.role === 'editor'
  );

  async function fetchMe(): Promise<void> {
    if (!getAuthToken()) {
      initialized.value = true;
      return;
    }
    try {
      loading.value = true;
      const res = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      user.value = res.user;
    } catch {
      user.value = null;
      setAuthToken(null);
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setAuthToken(res.token);
      user.value = res.user;
      refreshSocketAuth();
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    user.value = null;
    refreshSocketAuth();
  }

  return {
    user,
    loading,
    initialized,
    isAuthenticated,
    isAdmin,
    isEditorOrAdmin,
    fetchMe,
    login,
    logout
  };
});

