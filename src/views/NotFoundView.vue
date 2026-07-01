<script setup lang="ts">
import { onMounted } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSeo } from '@/composables/useSeo'
import { useAppFonts } from '@/composables/useAppFonts'

useSeo({ title: 'Page not found | SRVJ', noindex: true })
useAppFonts()

const { init: initDarkMode } = useDarkMode()

onMounted(() => {
  initDarkMode()
})
</script>

<template>
  <div
    class="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center dark:bg-slate-900"
  >
    <div class="i-mdi-vector-polyline text-6xl text-slate-400 dark:text-slate-600" />
    <div>
      <h1 class="text-7xl font-bold text-slate-800 dark:text-slate-100">404</h1>
      <p class="mt-2 text-lg text-slate-600 dark:text-slate-400">
        This page took a wrong turn off the canvas.
      </p>
    </div>
    <RouterLink
      to="/"
      class="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
    >
      Back to home
    </RouterLink>
  </div>
</template>
