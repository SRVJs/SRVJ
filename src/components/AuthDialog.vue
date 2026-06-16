<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useGoogleAuth } from "@/composables/useGoogleAuth";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const auth = useAuthStore();
const google = useGoogleAuth();
const route = useRoute();
const router = useRouter();

/** After a successful sign-in from the public home page, send the user to
 * their dashboard; elsewhere (e.g. the editor) stay put. */
function onAuthSuccess() {
  emit("close");
  if (route.name === "home") router.push({ name: "dashboard" });
}

type Mode = "login" | "register";
const mode = ref<Mode>("login");
const form = reactive({ fullname: "", email: "", password: "" });
const emailInput = ref<HTMLInputElement | null>(null);
const googleButton = ref<HTMLElement | null>(null);

const isRegister = computed(() => mode.value === "register");
const title = computed(() => (isRegister.value ? "Create your account" : "Welcome back"));
const submitLabel = computed(() => (isRegister.value ? "Sign up" : "Sign in"));

/** Exchange the Google ID token from the popup for an SRVJ session. */
async function onGoogleCredential(credential: string) {
  try {
    await auth.loginWithGoogleCredential(credential);
    onAuthSuccess();
  } catch {
    // Error surfaced via auth.error; keep the dialog open for a retry.
  }
}

/**
 * Boot Google Identity Services once the dialog is open and its button slot has
 * mounted: render the official button (which opens the account-chooser popup and
 * hands back an ID token via {@link onGoogleCredential}) and surface the One Tap
 * card. Failures (script blocked, misconfigured origin) are swallowed — the
 * email form and redirect fallback still work.
 */
async function mountGoogleSignIn() {
  if (!google.isConfigured || !googleButton.value) return;
  try {
    await google.init(onGoogleCredential);
    google.renderButton(googleButton.value);
    google.prompt();
  } catch {
    // GIS unavailable; the rest of the dialog remains usable.
  }
}

/** Exchange the Google ID token from the popup for an SRVJ session. */
async function onGoogleCredential(credential: string) {
  try {
    await auth.loginWithGoogleCredential(credential)
    emit('close')
  } catch {
    // Error surfaced via auth.error; keep the dialog open for a retry.
  }
}

/**
 * Boot Google Identity Services once the dialog is open and its button slot has
 * mounted: render the official button and surface the One Tap account-chooser
 * popup. Failures (script blocked, misconfigured origin) are swallowed — the
 * email form and redirect fallback still work.
 */
async function mountGoogleSignIn() {
  if (!google.isConfigured || !googleButton.value) return
  try {
    await google.init(onGoogleCredential)
    google.renderButton(googleButton.value)
    google.prompt()
  } catch {
    // GIS unavailable; the rest of the dialog remains usable.
  }
}

// Reset transient state and focus the first field whenever the dialog opens.
watch(
  () => props.open,
  (open) => {
    if (!open) {
      google.cancel(); // dismiss the One Tap card when closing
      return;
    }
    mode.value = "login";
    form.fullname = "";
    form.email = "";
    form.password = "";
    auth.error = null;
    nextTick(() => {
      emailInput.value?.focus();
      void mountGoogleSignIn();
    });
  }
);

function switchMode(next: Mode) {
  mode.value = next;
  auth.error = null;
}

async function onSubmit() {
  try {
    if (isRegister.value) {
      await auth.register({
        fullname: form.fullname,
        email: form.email,
        password: form.password,
      });
    } else {
      await auth.login({ email: form.email, password: form.password });
    }
    onAuthSuccess();
  } catch {
    // Error surfaced via auth.error; keep the dialog open for a retry.
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/1 p-4 backdrop-blur-xl"
      @click.self="emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#050505]/85"
        @keydown.esc="emit('close')"
      >
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">
              {{ title }}
            </h2>
            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {{
                isRegister
                  ? "Sign up to sync your work."
                  : "Sign in to your SRVJ account."
              }}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            @click="emit('close')"
          >
            <span class="i-mdi-close text-lg" aria-hidden="true" />
          </button>
        </div>

        <div class="mb-4 flex rounded-lg bg-slate-100 p-1 dark:bg-white/2">
          <button
            type="button"
            class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              !isRegister
                ? 'bg-white text-slate-800 shadow-sm dark:bg-white/10 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            "
            @click="switchMode('login')"
          >
            Sign in
          </button>
          <button
            type="button"
            class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              isRegister
                ? 'bg-white text-slate-800 shadow-sm dark:bg-white/10 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            "
            @click="switchMode('register')"
          >
            Sign up
          </button>
        </div>

        <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
          <label v-if="isRegister" class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">Full name</span>
            <input
              v-model="form.fullname"
              type="text"
              required
              autocomplete="name"
              placeholder="Jane Doe"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">Email</span>
            <input
              ref="emailInput"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">Password</span>
            <input
              v-model="form.password"
              type="password"
              required
              :autocomplete="isRegister ? 'new-password' : 'current-password'"
              placeholder="••••••••"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>

          <p
            v-if="auth.error"
            class="flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          >
            <span class="i-mdi-alert-circle-outline shrink-0" aria-hidden="true" />
            {{ auth.error }}
          </p>

          <button
            type="submit"
            :disabled="auth.loading"
            class="mt-1 inline-flex items-center justify-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <span
              v-if="auth.loading"
              class="i-mdi-loading animate-spin"
              aria-hidden="true"
            />
            {{ auth.loading ? "Please wait…" : submitLabel }}
          </button>
        </form>

        <div class="my-4 flex items-center gap-3" aria-hidden="true">
          <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span class="text-xs font-medium uppercase tracking-wide text-slate-400"
            >or</span
          >
          <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <!-- Google sign-in. When GIS is configured, the styled button below is
             purely visual and the real (transparent) GIS button is overlaid on
             top — so the click opens Google's account-chooser popup and returns
             an ID token via onGoogleCredential. -->
        <div v-if="google.isConfigured" class="group relative">
          <div
            class="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-black/10 bg-black px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-[#161616] dark:border-white/15 dark:bg-[#1f1f1f] dark:group-hover:bg-[#2a2a2a]"
          >
            <span class="i-logos-google-icon text-base" aria-hidden="true" />
            Google
          </div>
          <!-- Real GIS button: covers the visual, made invisible. -->
          <div
            ref="googleButton"
            class="absolute inset-0 z-10 flex cursor-pointer items-center justify-center opacity-0 [color-scheme:light]"
          />
        </div>
        <button
          v-else
          type="button"
          :disabled="auth.loading"
          class="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-black/10 bg-black px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#161616] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#1f1f1f] dark:hover:bg-[#2a2a2a]"
          @click="auth.loginWithGoogle()"
        >
          <span class="i-logos-google-icon text-base" aria-hidden="true" />
          Google
        </button>
      </div>
    </div>
  </Teleport>
</template>
