<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'
import AuthMenu from './AuthMenu.vue'

/**
 * The project's single navigation bar, rendered in one of two variants:
 *
 *  - `app`     — the sticky in-app header (logo, dark-mode toggle, account
 *                menu) used on the dashboard and other signed-in views. The
 *                toggle hides itself when the theme is force-locked (e.g. the
 *                dashboard pins dark mode).
 *  - `landing` — the fixed marketing nav on the home page: anchor links plus
 *                "Sign in" / "Get started" CTAs. It floats transparent over the
 *                dark hero and turns into a frosted bar with dark links once the
 *                page scrolls onto the light body. Emits `auth` on a CTA click
 *                so the host page can open its own AuthDialog.
 */
const props = withDefaults(defineProps<{ variant?: 'app' | 'landing' }>(), {
  variant: 'app',
})

const emit = defineEmits<{ auth: [] }>()

// --- app variant ---------------------------------------------------------
const { isDark, isForced, toggle: toggleDark } = useDarkMode()

// --- landing variant -----------------------------------------------------
// `scrolled` flips once the dark hero (`#top`) has scrolled out of view: the
// nav becomes a frosted bar with dark (#010101) links over the light body.
// An IntersectionObserver is used (not a scroll listener) because the home
// page's `.lp` root — not the window — owns the scroll (its `overflow-x` makes
// it the scroll container), so `window.scrollY` never changes. IO measures the
// hero's real viewport position regardless of which element scrolls.
const scrolled = ref(false)
let heroObserver: IntersectionObserver | undefined

const linkClass = computed(() =>
  scrolled.value ? 'text-[#010101] hover:text-black' : 'text-[#c7c7d1] hover:text-white',
)

onMounted(() => {
  if (props.variant !== 'landing') return
  const hero = document.getElementById('top')
  if (!hero || !('IntersectionObserver' in window)) return
  heroObserver = new IntersectionObserver(
    ([entry]) => {
      scrolled.value = !entry.isIntersecting
    },
    // Shrink the root's top edge by ~the nav height so the flip lands exactly
    // as the hero passes behind the bar.
    { rootMargin: '-72px 0px 0px 0px', threshold: 0 },
  )
  heroObserver.observe(hero)
})
onBeforeUnmount(() => heroObserver?.disconnect())
</script>

<template>
  <!-- ===== Landing (marketing) nav ===== -->
  <header
    v-if="variant === 'landing'"
    class="fixed left-0 right-0 top-0 z-50 border-b border-transparent backdrop-blur-xl transition-all duration-300"
    :class="scrolled ? 'border-black/5 bg-white/80 shadow-lg shadow-black/10' : ''"
  >
    <nav class="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-4">
      <a href="#top" class="flex items-center gap-2.5 no-underline">
        <img src="/favicon.png" alt="SRVJ" class="h-9.5 w-11.5 rounded-lg" />
      </a>
      <div class="flex items-center gap-3 sm:gap-6">
        <a
          href="#features"
          :class="['hidden text-[14.5px] font-medium no-underline transition-colors md:inline', linkClass]"
          >Features</a
        >
        <a
          href="#usecases"
          :class="['hidden text-[14.5px] font-medium no-underline transition-colors md:inline', linkClass]"
          >Use cases</a
        >
        <a
          href="#compare"
          :class="['hidden text-[14.5px] font-medium no-underline transition-colors md:inline', linkClass]"
          >Compare</a
        >
        <button
          type="button"
          :class="['cursor-pointer border-0 bg-transparent text-[14.5px] font-medium transition-colors', linkClass]"
          @click="emit('auth')"
        >
          Sign in
        </button>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center justify-center rounded-[10px] bg-[#6366f1] px-[18px] py-2.5 text-[14.5px] font-semibold text-white shadow-[0_6px_18px_rgba(99,102,241,.4)] transition-all hover:-translate-y-0.5 hover:bg-[#5457e5] hover:shadow-[0_14px_34px_rgba(99,102,241,.6)]"
          @click="emit('auth')"
        >
          Get started
        </button>
      </div>
    </nav>
  </header>

  <!-- ===== In-app header ===== -->
  <header
    v-else
    class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 px-4 py-2.5 shadow-lg shadow-black/10 backdrop-blur-sm bg-white/75 dark:border-slate-700 dark:bg-black/60 dark:shadow-black/40"
  >
    <RouterLink to="/" class="mr-1 flex shrink-0 items-center gap-2">
      <img src="/favicon.png" alt="SRVJ" class="h-10 w-12 rounded-lg shadow-sm" />
    </RouterLink>
    <div class="ml-auto flex items-center gap-3">
      <NotificationBell />

      <button
        v-if="!isForced"
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

      <span v-if="!isForced" class="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      <AuthMenu />
    </div>
  </header>
</template>
