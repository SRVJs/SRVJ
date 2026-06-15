<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const auth = useAuthStore()

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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account settings"
        class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        @keydown.esc="emit('close')"
      >
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">Account settings</h2>
            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Update your name and avatar.
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

        <form class="flex flex-col gap-4" @submit.prevent="onSave">
          <!-- Avatar picker -->
          <div class="flex items-center gap-4">
            <span
              class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
            >
              <img
                v-if="previewSrc"
                :src="previewSrc"
                :alt="fullname"
                class="h-full w-full object-cover"
              />
              <span v-else class="i-mdi-account text-2xl" aria-hidden="true" />
            </span>
            <div class="flex flex-col gap-1">
              <button
                type="button"
                class="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onPickFile"
            />
          </div>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">Full name</span>
            <input
              ref="nameInput"
              v-model="fullname"
              type="text"
              required
              autocomplete="name"
              placeholder="Jane Doe"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
            class="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <span v-if="auth.loading" class="i-mdi-loading animate-spin" aria-hidden="true" />
            {{ auth.loading ? 'Saving…' : 'Save changes' }}
          </button>
        </form>

        <!-- Danger zone -->
        <div class="mt-6 border-t border-slate-100 pt-4 dark:border-slate-700">
          <template v-if="!confirmingDelete">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
              @click="confirmingDelete = true"
            >
              <span class="i-mdi-trash-can-outline" aria-hidden="true" />
              Delete account
            </button>
          </template>
          <div v-else class="flex flex-col gap-2">
            <p class="text-sm text-slate-600 dark:text-slate-300">
              This permanently deletes your account and cannot be undone. Are you sure?
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                :disabled="auth.loading"
                class="inline-flex items-center justify-center gap-2 rounded-md border border-rose-600 bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                @click="onDelete"
              >
                <span v-if="auth.loading" class="i-mdi-loading animate-spin" aria-hidden="true" />
                Yes, delete
              </button>
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                @click="confirmingDelete = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
