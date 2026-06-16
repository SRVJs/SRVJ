<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSeo } from '@/composables/useSeo'
import { SITE_DESCRIPTION } from '@/utils/constants'

useSeo({ title: 'SRVJ — Free Online Diagram Editor & Whiteboard', path: '/' })

const { init: initDarkMode } = useDarkMode()

onMounted(() => {
  initDarkMode()
})

const features = [
  {
    icon: 'i-carbon-flow',
    title: 'Flowcharts & diagrams',
    body: 'A Draw.io-style flow editor with shapes, smart connectors, and crow’s-foot ERD tables.',
  },
  {
    icon: 'i-mdi-draw',
    title: 'Hand-drawn sketch mode',
    body: 'Toggle an Excalidraw-style rough look for whiteboard-flavoured diagrams in one click.',
  },
  {
    icon: 'i-mdi-sticky-note-outline',
    title: 'Sticky notes & text',
    body: 'Miro-style sticky notes and free text, with color, fill, stroke, and opacity controls.',
  },
  {
    icon: 'i-mdi-folder-multiple-outline',
    title: 'Projects & diagrams',
    body: 'Organise your work into projects, each holding as many diagrams as you need.',
  },
  {
    icon: 'i-mdi-cloud-sync-outline',
    title: 'Saved to your account',
    body: 'Sign in to keep your projects in sync, or use the editor instantly without an account.',
  },
  {
    icon: 'i-mdi-share-variant-outline',
    title: 'Share a link',
    body: 'Hand a teammate a room link and collaborate on the same canvas together.',
  },
]
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
    <AppHeader />

    <main>
      <!-- Hero -->
      <section class="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <div
          class="i-carbon-flow mx-auto mb-6 text-6xl text-indigo-500 dark:text-indigo-400"
          aria-hidden="true"
        />
        <h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">
          The free diagram editor that works the way you think
        </h1>
        <p class="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          {{ SITE_DESCRIPTION }}
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <RouterLink
            to="/dashboard"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <span class="i-mdi-view-dashboard-outline" aria-hidden="true" />
            Go to dashboard
          </RouterLink>
          <RouterLink
            to="/dashboard"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Get started — it’s free
          </RouterLink>
        </div>
      </section>

      <!-- Features -->
      <section class="mx-auto max-w-5xl px-6 pb-24">
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="feature in features"
            :key="feature.title"
            class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div
              class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-xl text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
            >
              <span :class="feature.icon" aria-hidden="true" />
            </div>
            <h2 class="text-base font-semibold">{{ feature.title }}</h2>
            <p class="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{{ feature.body }}</p>
          </article>
        </div>
      </section>
    </main>

    <footer class="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      © {{ new Date().getFullYear() }} SRVJ — Free online diagram editor &amp; whiteboard.
    </footer>
  </div>
</template>
