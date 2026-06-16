import { apiFetch } from './api'
import type { Diagram, Project, ProjectPayload, SaveDiagramPayload } from '@/types/project'

/**
 * Typed wrappers over the SRVJ backend's project/diagram endpoints. Every call
 * goes through {@link apiFetch}, which attaches the bearer token, unwraps the
 * standard `ApiEnvelope`, and transparently refreshes the access token on a
 * 401. The token is threaded in from the caller (the projects store) so this
 * module stays free of store imports — mirroring `utils/api.ts`.
 *
 * Resources are addressed by their public `site_id` (uuid), not the internal
 * integer `id`. A project owns exactly one diagram (1:1); the list/detail
 * endpoints embed that diagram, and the editor loads/saves it by its own
 * `diagram.site_id`. Versioning / real-time (CRDT) collaboration is handled
 * server-side.
 *
 *   GET    /project                — the signed-in user's projects (each embeds `diagram`)
 *   GET    /project/:siteId        — one project (incl. its diagram + members)
 *   POST   /project/create         — create a project (+ blank diagram)
 *   PATCH  /project/:siteId        — rename / re-describe / re-scope
 *   DELETE /project/:siteId        — delete (cascades the diagram)
 *   GET    /diagram/:siteId        — a diagram's canvas (by `diagram.site_id`)
 *   PATCH  /diagram/:siteId        — save the canvas (autosave)
 */

export function listProjects(token: string | null) {
  return apiFetch<Project[]>('/project', { token })
}

export function getProject(siteId: string, token: string | null) {
  return apiFetch<Project>(`/project/${siteId}`, { token })
}

export function createProject(payload: ProjectPayload, token: string | null) {
  return apiFetch<Project>('/project/create', { method: 'POST', body: payload, token })
}

export function updateProject(siteId: string, payload: ProjectPayload, token: string | null) {
  return apiFetch<Project>(`/project/edit/${siteId}`, { method: 'PUT', body: payload, token })
}

export function deleteProject(siteId: string, token: string | null) {
  return apiFetch<void>(`/project/${siteId}`, { method: 'DELETE', token })
}

export function getDiagram(diagramSiteId: string, token: string | null) {
  return apiFetch<Diagram>(`/diagram/${diagramSiteId}`, { token })
}

export function saveDiagram(
  diagramSiteId: string,
  payload: SaveDiagramPayload,
  token: string | null,
) {
  return apiFetch<Diagram>(`/diagram/${diagramSiteId}`, { method: 'PATCH', body: payload, token })
}
