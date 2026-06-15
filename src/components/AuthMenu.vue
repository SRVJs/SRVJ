<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import AuthDialog from './AuthDialog.vue'
import ProfileDialog from './ProfileDialog.vue'

const auth = useAuthStore()
const { user, isAuthenticated, loading } = storeToRefs(auth)

const dialogOpen = ref(false)
const profileOpen = ref(false)
const menuOpen = ref(false)

function openDialog() {
  dialogOpen.value = true
}

function openProfile() {
  menuOpen.value = false
  profileOpen.value = true
}

async function onLogout() {
  menuOpen.value = false
  await auth.logout()
}
</script>

<template>
  <div class="relative flex items-center">
    <!-- Signed out: a single sign-in entry point. -->
    <button
      v-if="!isAuthenticated"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      @click="openDialog"
    >
      <span class="i-mdi-login" aria-hidden="true" />
      <span class="hidden sm:inline">Sign in</span>
    </button>

    <!-- Signed in: avatar button toggling a small account menu. -->
    <template v-else>
      <button
        type="button"
        :aria-expanded="menuOpen"
        aria-haspopup="menu"
        :title="user?.fullname"
        class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-slate-600 shadow-sm hover:ring-2 hover:ring-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        @click="menuOpen = !menuOpen"
      >
        <img
          v-if="user?.avatar"
          :src="user.avatar"
          :alt="user.fullname"
          class="h-full w-full object-cover"
        />
        <span v-else class="i-mdi-account text-lg" aria-hidden="true" />
      </button>

      <!-- Click-away backdrop. -->
      <div v-if="menuOpen" class="fixed inset-0 z-40" @click="menuOpen = false" />

      <div
        v-if="menuOpen"
        role="menu"
        class="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        <div class="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {{ user?.fullname }}
          </p>
          <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ user?.email }}</p>
        </div>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
          @click="openProfile"
        >
          <span class="i-mdi-account-cog-outline" aria-hidden="true" />
          Account settings
        </button>
        <button
          type="button"
          role="menuitem"
          :disabled="loading"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-900/30"
          @click="onLogout"
        >
          <span class="i-mdi-logout" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </template>

    <AuthDialog :open="dialogOpen" @close="dialogOpen = false" />
    <ProfileDialog :open="profileOpen" @close="profileOpen = false" />
  </div>
</template>
