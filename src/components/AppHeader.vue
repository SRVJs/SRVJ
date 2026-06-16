<script setup lang="ts">
import { useDarkMode } from '@/composables/useDarkMode'
import AuthMenu from './AuthMenu.vue'

const { isDark, toggle: toggleDark } = useDarkMode()
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 px-4 py-2.5 shadow-lg shadow-black/10 backdrop-blur-md bg-white/75 dark:border-slate-700 dark:bg-black/60 dark:shadow-black/40"
  >
    <RouterLink to="/" class="mr-1 flex shrink-0 items-center gap-2">
      <img src="/favicon.png" alt="SRVJ" class="h-10 w-12 rounded-lg shadow-sm" />
    </RouterLink>
    <div class="ml-auto flex items-center gap-3">
      <button
        type="button"
        :aria-pressed="isDark"
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
        class="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
        @click="toggleDark"
      >
        <span
          :class="isDark ? 'i-solar-moon-bold text-indigo-300' : 'i-solar-sun-2-bold text-amber-500'"
          aria-hidden="true"
        />
      </button>

      <span class="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      <AuthMenu />
    </div>
  </header>
</template>
