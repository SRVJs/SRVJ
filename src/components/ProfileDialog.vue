<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const auth = useAuthStore()

type Tab = 'account' | 'security'
const TABS: { id: Tab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
]
const activeTab = ref<Tab>('account')

const fullname = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const confirmingDelete = ref(false)

// Show the chosen file if one is staged, otherwise the user's saved avatar.
const previewSrc = computed(() => avatarPreview.value ?? auth.user?.avatar ?? null)

// Seed the form from the current profile each time the dialog opens.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    activeTab.value = 'account'
    fullname.value = auth.user?.fullname ?? ''
    clearStagedAvatar()
    confirmingDelete.value = false
    auth.error = null
    nextTick(() => nameInput.value?.focus())
  },
)

function clearStagedAvatar() {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarPreview.value = null
  avatarFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function onPickFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (!file) return
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function onSave() {
  try {
    await auth.updateProfile({ fullname: fullname.value, img: avatarFile.value })
    emit('close')
  } catch {
    // Error surfaced via auth.error; keep the dialog open for a retry.
  }
}

async function onDelete() {
  try {
    await auth.deleteAccount()
    emit('close')
  } catch {
    // Error surfaced via auth.error; keep the dialog open.
  }
}

async function onLogout() {
  await auth.logout()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0d0d0d]/90"
        @keydown.esc="emit('close')"
      >
        <!-- Tab navbar -->
        <header
          class="flex items-center gap-1 border-b border-slate-200 px-3 py-2 dark:border-white/10"
        >
          <nav class="flex items-center gap-1">
            <button
              v-for="tab in TABS"
              :key="tab.id"
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              :class="
                activeTab === tab.id
                  ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              "
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </nav>
          <button
            type="button"
            aria-label="Close"
            class="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            @click="emit('close')"
          >
            <span class="i-mdi-close text-lg" aria-hidden="true" />
          </button>
        </header>

        <!-- Tab content -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Account -->
          <form v-if="activeTab === 'account'" class="flex flex-col gap-6" @submit.prevent="onSave">
            <!-- Avatar -->
            <div class="flex items-center gap-5">
              <span
                class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <img v-if="previewSrc" :src="previewSrc" :alt="fullname" class="h-full w-full object-cover" />
                <span v-else class="i-mdi-account text-3xl" aria-hidden="true" />
              </span>
              <div class="flex flex-col gap-1.5">
                <button
                  type="button"
                  class="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  @click="fileInput?.click()"
                >
                  <span class="i-mdi-image-outline" aria-hidden="true" />
                  Change avatar
                </button>
                <button
                  v-if="avatarFile"
                  type="button"
                  class="w-fit text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  @click="clearStagedAvatar"
                >
                  Remove selection
                </button>
              </div>
              <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPickFile" />
            </div>

            <!-- Name -->
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-semibold text-slate-700 dark:text-slate-200">Name</span>
              <input
                ref="nameInput"
                v-model="fullname"
                type="text"
                required
                autocomplete="name"
                placeholder="Jane Doe"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>

            <!-- Email (read-only) -->
            <div class="flex flex-col gap-1 text-sm">
              <span class="font-semibold text-slate-700 dark:text-slate-200">Email</span>
              <p class="text-slate-600 dark:text-slate-300">{{ auth.user?.email }}</p>
            </div>

            <!-- Username (read-only) -->
            <div v-if="auth.user?.username" class="flex flex-col gap-1 text-sm">
              <span class="font-semibold text-slate-700 dark:text-slate-200">Username</span>
              <p class="text-slate-600 dark:text-slate-300">{{ auth.user.username }}</p>
            </div>

            <p
              v-if="auth.error"
              class="flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
            >
              <span class="i-mdi-alert-circle-outline shrink-0" aria-hidden="true" />
              {{ auth.error }}
            </p>

            <div class="flex justify-end">
              <button
                type="submit"
                :disabled="auth.loading"
                class="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span v-if="auth.loading" class="i-mdi-loading animate-spin" aria-hidden="true" />
                {{ auth.loading ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </form>

          <!-- Security -->
          <div v-else-if="activeTab === 'security'" class="flex flex-col gap-6">
            <!-- Session -->
            <section class="flex flex-col gap-2">
              <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">Session</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Sign out of your account on this device.
              </p>
              <button
                type="button"
                :disabled="auth.loading"
                class="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                @click="onLogout"
              >
                <span class="i-mdi-logout" aria-hidden="true" />
                Sign out
              </button>
            </section>

            <!-- Danger zone -->
            <section class="flex flex-col gap-2 border-t border-slate-200 pt-5 dark:border-white/10">
              <h3 class="text-base font-semibold text-rose-600 dark:text-rose-400">Delete account</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Permanently delete your account and all of your projects. This cannot be undone.
              </p>

              <p
                v-if="auth.error"
                class="flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
              >
                <span class="i-mdi-alert-circle-outline shrink-0" aria-hidden="true" />
                {{ auth.error }}
              </p>

              <button
                v-if="!confirmingDelete"
                type="button"
                class="inline-flex w-fit items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/40 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-500/10"
                @click="confirmingDelete = true"
              >
                <span class="i-mdi-trash-can-outline" aria-hidden="true" />
                Delete account
              </button>
              <div v-else class="flex items-center gap-2">
                <button
                  type="button"
                  :disabled="auth.loading"
                  class="inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  @click="onDelete"
                >
                  <span v-if="auth.loading" class="i-mdi-loading animate-spin" aria-hidden="true" />
                  Yes, delete my account
                </button>
                <button
                  type="button"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  @click="confirmingDelete = false"
                >
                  Cancel
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
