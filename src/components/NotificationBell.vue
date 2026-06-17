<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useNotifications } from '@/composables/useNotifications'

/**
 * TEST-ONLY notifications widget for the in-app header. Opens a live SSE feed
 * (`/notification/stream`) on mount and offers a small form to POST test
 * notifications to `/notification/publish`. Purely a harness for exercising the
 * backend endpoints — not a finished notifications UX.
 */
const {
  notifications,
  status,
  unread,
  lastError,
  loadingList,
  connect,
  disconnect,
  fetchList,
  publish,
  markAllRead,
  clear,
} = useNotifications()

const open = ref(false)
const title = ref('Test notification')
const message = ref('Hello from SRVJ 👋')
const sending = ref(false)
const sendError = ref<string | null>(null)

const statusColor: Record<string, string> = {
  idle: 'bg-slate-400',
  connecting: 'bg-amber-400 animate-pulse',
  open: 'bg-emerald-500',
  error: 'bg-red-500',
}

function toggle() {
  open.value = !open.value
  if (open.value) markAllRead()
}

async function send() {
  if (!title.value.trim() && !message.value.trim()) return
  sending.value = true
  sendError.value = null
  try {
    await publish({ title: title.value, message: message.value })
  } catch (err) {
    sendError.value = err instanceof Error ? err.message : 'Failed to publish'
  } finally {
    sending.value = false
  }
}

function relativeTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

onMounted(() => {
  void fetchList()
  void connect()
})
onBeforeUnmount(() => disconnect())
</script>

<template>
  <div class="relative">
    <button
      type="button"
      :aria-label="`Notifications (${status})`"
      title="Notifications (test)"
      class="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
      @click="toggle"
    >
      <span class="i-mdi-bell-outline text-slate-700 dark:text-slate-200" aria-hidden="true" />
      <span
        class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900"
        :class="statusColor[status]"
        aria-hidden="true"
      />
      <span
        v-if="unread > 0"
        class="absolute -right-1.5 -top-2 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white"
      >
        {{ unread > 99 ? '99+' : unread }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <!-- header -->
      <div class="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
          <span class="text-[11px] text-slate-400">test</span>
        </div>
        <button
          type="button"
          class="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          @click="clear"
        >
          Clear
        </button>
      </div>

      <!-- publish test form -->
      <form class="space-y-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700" @submit.prevent="send">
        <input
          v-model="title"
          type="text"
          placeholder="Title"
          class="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <input
          v-model="message"
          type="text"
          placeholder="Message"
          class="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          :disabled="sending"
          class="w-full rounded bg-indigo-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {{ sending ? 'Publishing…' : 'Publish test notification' }}
        </button>
        <p v-if="sendError" class="text-xs text-red-500">{{ sendError }}</p>
      </form>

      <!-- live feed -->
      <div class="max-h-64 overflow-y-auto">
        <p v-if="lastError && status === 'error'" class="px-3 py-2 text-xs text-red-500">
          Stream error: {{ lastError }}
        </p>
        <p v-if="loadingList" class="px-3 py-6 text-center text-sm text-slate-400">Loading…</p>
        <p
          v-else-if="notifications.length === 0"
          class="px-3 py-6 text-center text-sm text-slate-400"
        >
          No notifications yet.
        </p>
        <ul v-if="!loadingList && notifications.length">
          <li
            v-for="n in notifications"
            :key="n.id"
            class="border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-slate-800"
          >
            <div class="flex items-baseline justify-between gap-2">
              <span class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{{ n.title }}</span>
              <span class="shrink-0 text-[11px] text-slate-400">{{ relativeTime(n.receivedAt) }}</span>
            </div>
            <span
              v-if="n.type"
              class="mt-0.5 inline-block max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              {{ n.type }}
            </span>
            <p class="text-sm text-slate-600 dark:text-slate-300">{{ n.message }}</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
