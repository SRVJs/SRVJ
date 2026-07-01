<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/navBar.vue'
import { useAuthStore } from '@/stores/auth'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSeo } from '@/composables/useSeo'
import { useAppFonts } from '@/composables/useAppFonts'

useSeo({ title: 'Reset password | SRVJ', path: '/app/reset-password', noindex: true })
useAppFonts()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { init: initDarkMode, setForcedTheme } = useDarkMode()

/**
 * The reset JWT from the emailed link. Accept it from the path segment
 * (`/app/reset-password/<jwt>`) *or* a `?token=` query param — the backend-built
 * link may use either form. POSTed back in the request body on submit.
 */
const token = computed(() => {
  const fromPath = route.params.token
  const fromQuery = route.query.token
  const raw =
    (Array.isArray(fromPath) ? fromPath[0] : fromPath) ||
    (Array.isArray(fromQuery) ? fromQuery[0] : fromQuery)
  return String(raw ?? '')
})

const password = ref('')
const confirm = ref('')
const done = ref(false)
/** Local form-validation message (mismatch / too short), distinct from auth.error. */
const formError = ref<string | null>(null)

const MIN_PASSWORD = 8

async function onSubmit() {
  formError.value = null
  auth.error = null
  if (password.value.length < MIN_PASSWORD) {
    formError.value = `Password must be at least ${MIN_PASSWORD} characters.`
    return
  }
  if (password.value !== confirm.value) {
    formError.value = 'Passwords do not match.'
    return
  }
  try {
    await auth.resetPassword(token.value, password.value)
    done.value = true
  } catch {
    // Error surfaced via auth.error (e.g. expired/invalid token).
  }
}

onMounted(() => {
  initDarkMode()
  // The /app surface is locked to dark mode (matches the dashboard/editor chrome).
  setForcedTheme('dark')
})

onBeforeUnmount(() => setForcedTheme(null))

function goSignIn() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="bg-dots min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
    <NavBar variant="app" />

    <main class="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <!-- Missing/blank token: a dead or malformed link. -->
      <div
        v-if="!token"
        class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <div class="i-mdi-link-variant-off mx-auto mb-4 text-5xl text-rose-400" aria-hidden="true" />
        <h1 class="text-xl font-bold">Invalid reset link</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This link is malformed. Request a new password-reset email from the sign-in screen.
        </p>
        <button
          type="button"
          class="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          @click="goSignIn"
        >
          <span class="i-mdi-login" aria-hidden="true" />
          Go to sign in
        </button>
      </div>

      <!-- Success: password changed. -->
      <div
        v-else-if="done"
        class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-slate-800"
      >
        <div
          class="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          <span class="i-mdi-check" aria-hidden="true" />
        </div>
        <h1 class="text-xl font-bold">Password updated</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your password has been changed. Sign in with your new password.
        </p>
        <button
          type="button"
          class="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          @click="goSignIn"
        >
          <span class="i-mdi-login" aria-hidden="true" />
          Go to sign in
        </button>
      </div>

      <!-- The reset form. -->
      <div
        v-else
        class="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-slate-800"
      >
        <div
          class="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-3xl text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
        >
          <span class="i-mdi-lock-reset" aria-hidden="true" />
        </div>

        <h1 class="text-center text-xl font-bold">Set a new password</h1>
        <p class="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Choose a new password for your SRVJ account.
        </p>

        <form class="mt-6 flex flex-col gap-3" @submit.prevent="onSubmit">
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">New password</span>
            <input
              v-model="password"
              type="password"
              required
              autocomplete="new-password"
              placeholder="••••••••"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">Confirm password</span>
            <input
              v-model="confirm"
              type="password"
              required
              autocomplete="new-password"
              placeholder="••••••••"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>

          <p
            v-if="formError || auth.error"
            class="flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          >
            <span class="i-mdi-alert-circle-outline shrink-0" aria-hidden="true" />
            {{ formError || auth.error }}
          </p>

          <button
            type="submit"
            :disabled="auth.loading"
            class="mt-1 inline-flex items-center justify-center gap-2 rounded-md border border-indigo-500 bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span v-if="auth.loading" class="i-mdi-loading animate-spin" aria-hidden="true" />
            {{ auth.loading ? 'Please wait…' : 'Reset password' }}
          </button>
        </form>
      </div>
    </main>
  </div>
</template>
