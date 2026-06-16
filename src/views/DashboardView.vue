<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppHeader from '@/components/AppHeader.vue'
import AuthDialog from '@/components/AuthDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSeo } from '@/composables/useSeo'
import {
  PROJECT_VISIBILITIES,
  type Project,
  type ProjectMember,
  type ProjectVisibility,
} from '@/types/project'

useSeo({ title: 'Your projects — SRVJ', path: '/dashboard', noindex: true })

const router = useRouter()
const auth = useAuthStore()
const projects = useProjectsStore()
const { isAuthenticated, user } = storeToRefs(auth)
const { projects: list, loading, error } = storeToRefs(projects)
const { init: initDarkMode } = useDarkMode()

const authDialogOpen = ref(false)
const creating = ref(false)
const form = reactive({ title: '', description: '', visibility: 'PRIVATE' as ProjectVisibility })

// The project being edited (its `site_id`), or `null` when the edit modal is closed.
const editingId = ref<string | null>(null)
const editForm = reactive({ title: '', description: '', visibility: 'PRIVATE' as ProjectVisibility })

const VISIBILITY_LABEL: Record<ProjectVisibility, string> = {
  PRIVATE: 'Private',
  PUBLIC: 'Public',
  UNLISTED: 'Unlisted',
}

const VISIBILITY_ICON: Record<ProjectVisibility, string> = {
  PRIVATE: 'i-mdi-lock-outline',
  PUBLIC: 'i-mdi-earth',
  UNLISTED: 'i-mdi-link-variant',
}

async function loadIfReady() {
  if (isAuthenticated.value) await projects.fetchProjects()
}

onMounted(async () => {
  initDarkMode()
  await auth.init()
  await loadIfReady()
})

// Refetch when the user signs in/out without leaving the page.
watch(isAuthenticated, loadIfReady)

function openCreate() {
  form.title = ''
  form.description = ''
  form.visibility = 'PRIVATE'
  creating.value = true
}

async function submitCreate() {
  const title = form.title.trim()
  if (!title) return
  const project = await projects.createProject({
    title,
    description: form.description.trim() || undefined,
    visibility: form.visibility,
  })
  if (project) {
    creating.value = false
    openProject(project)
  }
}

function openProject(project: Project) {
  // A project owns one diagram (1:1); open the editor at that diagram's site_id.
  const diagramId = project.diagram?.site_id
  if (!diagramId) return
  router.push({ name: 'editor', params: { diagramId } })
}

function startEdit(project: Project) {
  editingId.value = project.site_id
  editForm.title = project.title
  editForm.description = project.description ?? ''
  editForm.visibility = project.visibility
}

async function submitEdit() {
  const id = editingId.value
  const title = editForm.title.trim()
  if (!id || !title) return
  const ok = await projects.updateProject(id, {
    title,
    description: editForm.description.trim() || undefined,
    visibility: editForm.visibility,
  })
  if (ok) editingId.value = null
}

async function removeProject(project: Project) {
  if (!window.confirm(`Delete project “${project.title}”? This also deletes its diagram.`)) return
  await projects.deleteProject(project.site_id)
}

/** Members shown on a card: everyone except the signed-in user (so the owner
 * doesn't see their own avatar), keeping only those with an avatar image. */
function otherMembers(project: Project): ProjectMember[] {
  return (project.members ?? []).filter((m) => m.userId !== user.value?.id && m.user?.avatar)
}

function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}
</script>

<template>
  <div class="bg-dots min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
    <AppHeader />

    <main class="mx-auto max-w-5xl px-6 py-10">
      <!-- Signed out -->
      <div
        v-if="!isAuthenticated"
        class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <div class="i-mdi-folder-lock-outline mx-auto mb-4 text-5xl text-slate-400" aria-hidden="true" />
        <h1 class="text-xl font-bold">Sign in to view your projects</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your projects and diagrams are saved to your account.
        </p>
        <button
          type="button"
          class="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          @click="authDialogOpen = true"
        >
          <span class="i-mdi-login" aria-hidden="true" />
          Sign in
        </button>
      </div>

      <!-- Signed in -->
      <template v-else>
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold">Your projects</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Organise your diagrams into projects.
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            @click="openCreate"
          >
            <span class="i-mdi-plus" aria-hidden="true" />
            New project
          </button>
        </div>

        <p
          v-if="error"
          class="mb-4 flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
        >
          <span class="i-mdi-alert-circle-outline shrink-0" aria-hidden="true" />
          {{ error }}
        </p>

        <!-- Loading -->
        <div v-if="loading && list.length === 0" class="py-16 text-center text-slate-400">
          <span class="i-mdi-loading mr-2 animate-spin text-xl align-middle" aria-hidden="true" />
          Loading projects…
        </div>

        <!-- Empty -->
        <div
          v-else-if="list.length === 0"
          class="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          <div class="i-mdi-folder-open-outline mx-auto mb-3 text-5xl text-slate-400" aria-hidden="true" />
          No projects yet. Create your first one to get started.
        </div>

        <!-- Grid -->
        <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="project in list"
            :key="project.id"
            class="group relative flex flex-col rounded-xl border border-black/7 bg-white/1 p-5 shadow-md backdrop-blur-sm transition-all duration-300 hover:shadow-xl dark:border-white/10 dark:bg-white/1"
          >
            <div
              class="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100"
            >
              <button
                type="button"
                class="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                title="Edit project"
                @click.stop="startEdit(project)"
              >
                <span class="i-mdi-pencil-outline" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                title="Delete project"
                @click.stop="removeProject(project)"
              >
                <span class="i-mdi-trash-can-outline" aria-hidden="true" />
              </button>
            </div>
            <button type="button" class="flex flex-1 flex-col text-left" @click="openProject(project)">
              <div
                class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-xl text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              >
                <span class="i-mdi-folder-outline" aria-hidden="true" />
              </div>
              <h2 class="pr-14 font-semibold">{{ project.title }}</h2>
              <p v-if="project.description" class="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                {{ project.description }}
              </p>
              <div class="mt-4 flex items-center gap-3 text-xs text-slate-400">
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                >
                  <span :class="VISIBILITY_ICON[project.visibility]" aria-hidden="true" />
                  {{ VISIBILITY_LABEL[project.visibility] }}
                </span>
                <span v-if="project.updatedAt">{{ formatDate(project.updatedAt) }}</span>

                <!-- Other members' avatars (the signed-in owner's own face is omitted). -->
                <div v-if="otherMembers(project).length" class="ml-auto flex -space-x-2">
                  <img
                    v-for="m in otherMembers(project).slice(0, 4)"
                    :key="m.id"
                    :src="m.user?.avatar"
                    :alt="m.user?.fullname"
                    :title="m.user?.fullname"
                    class="h-6 w-6 rounded-full border-2 border-white object-cover dark:border-slate-800"
                  />
                  <span
                    v-if="otherMembers(project).length > 4"
                    class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-600 dark:text-slate-200"
                  >
                    +{{ otherMembers(project).length - 4 }}
                  </span>
                </div>
              </div>
            </button>
          </li>
        </ul>
      </template>
    </main>

    <AuthDialog :open="authDialogOpen" @close="authDialogOpen = false" />

    <!-- Create project modal -->
    <Teleport to="body">
      <div
        v-if="creating"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="creating = false"
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-label="New project"
          class="w-full max-w-sm rounded-xl border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#202020]/85"
          @submit.prevent="submitCreate"
          @keydown.esc="creating = false"
        >
          <div class="mb-5 flex items-start justify-between gap-4">
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">New project</h2>
            <button
              type="button"
              aria-label="Close"
              class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              @click="creating = false"
            >
              <span class="i-mdi-close text-lg" aria-hidden="true" />
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-slate-600 dark:text-slate-300">Title</span>
              <input
                v-model="form.title"
                type="text"
                required
                autofocus
                placeholder="e.g. System architecture"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-slate-600 dark:text-slate-300">Description (optional)</span>
              <textarea
                v-model="form.description"
                rows="3"
                placeholder="What’s this project about?"
                class="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-slate-600 dark:text-slate-300">Visibility</span>
              <select
                v-model="form.visibility"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              >
                <option v-for="v in PROJECT_VISIBILITIES" :key="v" :value="v">
                  {{ VISIBILITY_LABEL[v] }}
                </option>
              </select>
            </label>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="creating = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="loading || !form.title.trim()"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create project
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <!-- Edit project modal -->
    <Teleport to="body">
      <div
        v-if="editingId"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="editingId = null"
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-label="Edit project"
          class="w-full max-w-sm rounded-xl border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#202020]/85"
          @submit.prevent="submitEdit"
          @keydown.esc="editingId = null"
        >
          <div class="mb-5 flex items-start justify-between gap-4">
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">Edit project</h2>
            <button
              type="button"
              aria-label="Close"
              class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              @click="editingId = null"
            >
              <span class="i-mdi-close text-lg" aria-hidden="true" />
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-slate-600 dark:text-slate-300">Title</span>
              <input
                v-model="editForm.title"
                type="text"
                required
                autofocus
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-slate-600 dark:text-slate-300">Description</span>
              <textarea
                v-model="editForm.description"
                rows="3"
                placeholder="What’s this project about?"
                class="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-slate-600 dark:text-slate-300">Visibility</span>
              <select
                v-model="editForm.visibility"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
              >
                <option v-for="v in PROJECT_VISIBILITIES" :key="v" :value="v">
                  {{ VISIBILITY_LABEL[v] }}
                </option>
              </select>
            </label>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="editingId = null"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="loading || !editForm.title.trim()"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>
