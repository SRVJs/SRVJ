<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import NavBar from '@/components/navBar.vue'
import AuthDialog from '@/components/AuthDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSeo } from '@/composables/useSeo'
import { useAppFonts } from '@/composables/useAppFonts'
import {
  PROJECT_VISIBILITIES,
  type Project,
  type ProjectMember,
  type ProjectVisibility,
} from '@/types/project'
import type { InviteRole } from '@/utils/projectsApi'

useSeo({ title: 'Your projects | SRVJ', path: '/el/projects', noindex: true })
useAppFonts()

const router = useRouter()
const auth = useAuthStore()
const projects = useProjectsStore()
const { isAuthenticated, user } = storeToRefs(auth)
const { projects: list, loading, error, pagination, search } = storeToRefs(projects)
const { init: initDarkMode, setForcedTheme } = useDarkMode()

// Bound to the search box; debounced into the store so each keystroke doesn't fire a request.
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

const authDialogOpen = ref(false)

// The project being edited (its `site_id`), or `null` when the edit modal is closed.
const editingId = ref<string | null>(null)
const editForm = reactive({ title: '', description: '', visibility: 'PRIVATE' as ProjectVisibility })

// The project pending deletion (shown in the confirm modal), or `null` when closed.
const deleteTarget = ref<Project | null>(null)
const deleting = ref(false)

// The project being shared (shown in the invite modal), or `null` when closed.
const inviteTarget = ref<Project | null>(null)
const inviteEmail = ref('')
const inviteRole = ref<InviteRole>('EDITOR')
const inviting = ref(false)

// Transient success toast; auto-dismisses after 3s.
const successMessage = ref('')
let successTimer: ReturnType<typeof setTimeout> | undefined

function showSuccess(message: string) {
  successMessage.value = message
  if (successTimer) clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

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
  // The dashboard is locked to dark mode; the editor keeps the light/dark
  // toggle. Released on unmount so the user's preference resumes elsewhere.
  setForcedTheme('dark')
  await auth.init()
  await loadIfReady()
})

onBeforeUnmount(() => {
  setForcedTheme(null)
  if (successTimer) clearTimeout(successTimer)
  if (searchTimer) clearTimeout(searchTimer)
})

// Refetch when the user signs in/out without leaving the page.
watch(isAuthenticated, loadIfReady)

// Debounce the search box (350ms) before hitting the server.
watch(searchInput, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void projects.setSearch(value)
  }, 350)
})

// Create a project immediately (no modal): a private "Untitled" project, then
// jump straight into its diagram editor.
async function createAndOpen() {
  if (loading.value) return
  const project = await projects.createProject({
    title: 'Untitled',
    description: 'Untitled',
    visibility: 'PRIVATE',
  })
  if (error.value) return
  if (project) openProject(project)
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

function startInvite(project: Project) {
  inviteTarget.value = project
  inviteEmail.value = ''
  inviteRole.value = 'EDITOR'
}

async function submitInvite() {
  const project = inviteTarget.value
  const email = inviteEmail.value.trim()
  if (!project || !email) return
  inviting.value = true
  const ok = await projects.inviteToProject(project.site_id, email, inviteRole.value)
  inviting.value = false
  if (ok) {
    inviteTarget.value = null
    showSuccess(`Invitation sent to ${email}.`)
  }
}

function removeProject(project: Project) {
  deleteTarget.value = project
}

async function confirmDelete() {
  const project = deleteTarget.value
  if (!project) return
  deleting.value = true
  const ok = await projects.deleteProject(project.site_id)
  deleting.value = false
  if (ok) {
    deleteTarget.value = null
    showSuccess(`Project “${project.title}” deleted.`)
  }
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
    <NavBar variant="app" />

    <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
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
            :disabled="loading"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            @click="createAndOpen"
          >
            <span class="i-mdi-plus" aria-hidden="true" />
            New project
          </button>
        </div>

        <!-- Search -->
        <div class="relative mb-6 max-w-5xl">
          <span
            class="i-mdi-magnify pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400"
            aria-hidden="true"
          />
          <input
            v-model="searchInput"
            type="search"
            placeholder="Search projects…"
            aria-label="Search projects"
            class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
          />
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

        <!-- No search results -->
        <div
          v-else-if="list.length === 0 && search"
          class="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          <div class="i-mdi-file-search-outline mx-auto mb-3 text-5xl text-slate-400" aria-hidden="true" />
          No projects match “{{ search }}”.
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
                class="rounded-md p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
                title="Invite collaborator"
                @click.stop="startInvite(project)"
              >
                <span class="i-mdi-account-plus-outline" aria-hidden="true" />
              </button>
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

        <!-- Pagination -->
        <nav
          v-if="pagination && pagination.totalPages > 1"
          class="mt-8 flex items-center justify-center gap-3 text-sm"
          aria-label="Pagination"
        >
          <button
            type="button"
            :disabled="!pagination.hasPrevPage || loading"
            class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="projects.goToPage(pagination.page - 1)"
          >
            <span class="i-mdi-chevron-left" aria-hidden="true" />
            Previous
          </button>
          <span class="text-slate-500 dark:text-slate-400">
            Page {{ pagination.page }} of {{ pagination.totalPages }}
          </span>
          <button
            type="button"
            :disabled="!pagination.hasNextPage || loading"
            class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="projects.goToPage(pagination.page + 1)"
          >
            Next
            <span class="i-mdi-chevron-right" aria-hidden="true" />
          </button>
        </nav>
      </template>
    </main>

    <AuthDialog :open="authDialogOpen" @close="authDialogOpen = false" />

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

    <!-- Invite collaborator modal -->
    <Teleport to="body">
      <div
        v-if="inviteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="inviteTarget = null"
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-label="Invite collaborator"
          class="w-full max-w-sm rounded-xl border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#202020]/85"
          @submit.prevent="submitInvite"
          @keydown.esc="inviteTarget = null"
        >
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">Invite collaborator</h2>
              <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Invite someone to “{{ inviteTarget.title }}”.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              @click="inviteTarget = null"
            >
              <span class="i-mdi-close text-lg" aria-hidden="true" />
            </button>
          </div>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">Email address</span>
            <input
              v-model="inviteEmail"
              type="email"
              required
              autofocus
              placeholder="collaborator@example.com"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
            />
          </label>

          <label class="mt-4 flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-600 dark:text-slate-300">Role</span>
            <select
              v-model="inviteRole"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="EDITOR">Editor — can view and edit</option>
              <option value="VIEWER">Viewer — read-only</option>
            </select>
          </label>

          <p
            v-if="error"
            class="mt-3 flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          >
            <span class="i-mdi-alert-circle-outline shrink-0" aria-hidden="true" />
            {{ error }}
          </p>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="inviteTarget = null"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="inviting || !inviteEmail.trim()"
              class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                :class="inviting ? 'i-mdi-loading animate-spin' : 'i-mdi-send-outline'"
                aria-hidden="true"
              />
              Send invite
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <!-- Delete project confirmation modal -->
    <Teleport to="body">
      <div
        v-if="deleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="deleteTarget = null"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete project"
          tabindex="-1"
          class="w-full max-w-sm rounded-xl border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#202020]/85"
          @keydown.esc="deleteTarget = null"
        >
          <div class="flex items-start gap-3">
            <div
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xl text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
            >
              <span class="i-mdi-trash-can-outline" aria-hidden="true" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">Delete project</h2>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Delete “{{ deleteTarget.title }}”? This also deletes its diagram and can’t be undone.
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="deleteTarget = null"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="deleting"
              class="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              @click="confirmDelete"
            >
              <span
                :class="deleting ? 'i-mdi-loading animate-spin' : 'i-mdi-trash-can-outline'"
                aria-hidden="true"
              />
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Success toast (auto-dismisses after 3s) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="successMessage"
          role="status"
          aria-live="polite"
          class="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          <span class="i-mdi-check-circle-outline text-lg" aria-hidden="true" />
          {{ successMessage }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
