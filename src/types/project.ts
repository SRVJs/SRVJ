import type { DiagramNode, DiagramEdge, DiagramSnapshot } from './diagram'
import type { User } from './auth'

/** Who can see a project (mirrors the Prisma `ProjectVisibility` enum). */
export type ProjectVisibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED'

export const PROJECT_VISIBILITIES: ProjectVisibility[] = ['PRIVATE', 'PUBLIC', 'UNLISTED']

/** A collaborator's role on a project (mirrors the Prisma `ProjectRole` enum). */
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER'

/**
 * A project owned by the signed-in user. Every record is addressed publicly by
 * its `site_id` (a uuid) — the integer `id` is internal to the backend, so the
 * frontend routes and API calls use `site_id`. A project owns exactly **one**
 * diagram (1:1; `Diagram.projectId` is unique server-side), so the project's
 * `title` also names its canvas.
 */
export interface Project {
  id: number
  site_id: string
  title: string
  description?: string | null
  visibility: ProjectVisibility
  ownerId?: number
  createdAt: string
  updatedAt: string
  /** The project's one canvas — embedded by the list/detail endpoints. Open
   * the editor at its `diagram.site_id`. */
  diagram?: Diagram | null
  /** Collaborators, embedded by the list/detail endpoints. */
  members?: ProjectMember[]
}

/** A collaborator on a project, with the member's user embedded. */
export interface ProjectMember {
  id: number
  site_id: string
  role: ProjectRole
  projectId: number
  userId: number
  createdAt: string
  user?: User
}

/**
 * A project's single canvas. Stores `nodes`/`edges`/`version` in the same shape
 * as the editor's {@link DiagramSnapshot} (plus optional free-form `metadata`),
 * so converting between the two is a field copy — see {@link diagramToSnapshot}.
 */
export interface Diagram {
  id: number
  site_id: string
  projectId: number
  version: number
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

/** Body for creating/updating a project. */
export interface ProjectPayload {
  title: string
  description?: string
  visibility: ProjectVisibility
}

/** Body for saving a project's canvas (the editor autosaves this). */
export interface SaveDiagramPayload {
  version: number
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  metadata?: Record<string, unknown> | null
}

/** Project a backend {@link Diagram} into the editor's {@link DiagramSnapshot}. */
export function diagramToSnapshot(diagram: Diagram): DiagramSnapshot {
  return {
    version: diagram.version,
    nodes: diagram.nodes ?? [],
    edges: diagram.edges ?? [],
  }
}
