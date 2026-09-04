import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/signin',
      name: 'signin',
      component: () => import('@/views/SignIn.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/views/SignUp.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sse-test',
      name: 'sse-test',
      component: () => import('@/views/SseTest.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const { user, waitForAuthReady } = useAuth()
  await waitForAuthReady()

  if (to.meta.requiresAuth && !user.value) {
    return { name: 'signin', query: { redirect: to.fullPath } }
  }
  if (!to.meta.requiresAuth && user.value) {
    return { name: 'dashboard' }
  }
})

export default router
