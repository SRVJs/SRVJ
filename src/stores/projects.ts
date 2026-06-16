import { defineStore } from 'pinia'
import { ApiError } from '@/utils/api'
import * as projectsApi from '@/utils/projectsApi'
import { useAuthStore } from './auth'
import type { Project, ProjectPayload } from '@/types/project'

interface ProjectsState {
  /** All of the signed-in user's projects (dashboard list). */
  projects: Project[]
  /** In-flight flag for any list/CRUD request. */
  loading: boolean
  /** Last human-readable error, or `null`. */
  error: string | null
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

/**
 * Projects owned by the signed-in user. CRUD goes through {@link projectsApi},
 * which talks to the SRVJ backend; the bearer token is pulled from the auth
 * store on each call. A project owns one diagram (1:1) — the canvas itself is
 * loaded/saved by the editor via `useDiagramSync`, not here. Mirrors the
 * additive auth pattern: none of this gates the editor when signed out.
 */
export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({
    projects: [],
    loading: false,
    error: null,
  }),

  actions: {
    /** Token of the signed-in user (or `null`), used for every request. */
    token(): string | null {
      return useAuthStore().token
    },

    /** Load every project for the dashboard. */
    async fetchProjects() {
      this.loading = true
      this.error = null
      try {
        this.projects = await projectsApi.listProjects(this.token())
      } catch (error) {
        this.error = messageOf(error)
      } finally {
        this.loading = false
      }
    },

    /** Create a project, then re-fetch the list from the server; returns the
     * created project (for navigating into its editor) on success. */
    async createProject(payload: ProjectPayload): Promise<Project | null> {
      this.loading = true
      this.error = null
      try {
        const project = await projectsApi.createProject(payload, this.token())
        await this.fetchProjects()
        return project
      } catch (error) {
        this.error = messageOf(error)
        return null
      } finally {
        this.loading = false
      }
    },

    /** Update a project, then re-fetch the list from the server. */
    async updateProject(siteId: string, payload: ProjectPayload): Promise<boolean> {
      this.error = null
      try {
        await projectsApi.updateProject(siteId, payload, this.token())
        await this.fetchProjects()
        return true
      } catch (error) {
        this.error = messageOf(error)
        return false
      }
    },

    /** Delete a project (cascades its diagram), then re-fetch the list. */
    async deleteProject(siteId: string): Promise<boolean> {
      this.error = null
      try {
        await projectsApi.deleteProject(siteId, this.token())
        await this.fetchProjects()
        return true
      } catch (error) {
        this.error = messageOf(error)
        return false
      }
    },
  },
})
