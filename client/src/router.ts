import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/HomePage.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./pages/LoginPage.vue')
    },
    {
      path: '/play/:pin?',
      name: 'play',
      component: () => import('./pages/play/PlayGamePage.vue')
    },
    {
      path: '/host/:quizId',
      name: 'host',
      component: () => import('./pages/host/HostGamePage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/studio',
      name: 'studio',
      component: () => import('./pages/studio/StudioDashboard.vue')
    },
    {
      path: '/studio/quiz/:id',
      name: 'quiz-editor',
      component: () => import('./pages/studio/QuizEditorPage.vue')
    },
    {
      path: '/studio/reports',
      name: 'reports',
      component: () => import('./pages/studio/ReportsPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/studio/admin',
      name: 'admin-status',
      component: () => import('./pages/studio/AdminStatusPage.vue'),
      meta: { requiresAuth: true }
    }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) {
    await auth.fetchMe();
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    };
  }
  return true;
});
