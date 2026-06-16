import type { RouteRecordRaw } from 'vue-router'

/**
 * Route table consumed by `vite-ssg` (see `src/main.ts`), which owns the
 * router instance — creating a memory history during static generation and a
 * web history in the browser. Exported as plain records so it can be crawled
 * for pre-rendering.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
  },
  {
    path: '/editor/:diagramId',
    name: 'editor',
    component: () => import('@/views/EditorView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]
