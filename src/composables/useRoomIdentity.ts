import { computed, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import {
  OWNER_COLOR,
  OWNER_LABEL,
  peerColor,
  type PresenceUser,
} from '@/utils/presence'

/** Stable per-tab id for an anonymous guest (no account). */
let guestId: string | null = null
function getGuestId(): string {
  if (!guestId) {
    guestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `guest-${crypto.randomUUID()}`
        : `guest-${Math.random().toString(36).slice(2)}`
  }
  return guestId
}

/**
 * The local user's presence identity for the room — drives how *their* cursor
 * appears to everyone else. The project **owner** is rendered as a solid black
 * cursor labelled "owner"; every other collaborator gets their account name and
 * a deterministic colour. Guests (signed out, but holding a room link) join as
 * an anonymous "Guest".
 *
 * Ownership is read from the projects store: the project whose embedded diagram
 * matches the open canvas, checked against the signed-in user's id (via the
 * project `ownerId` or an `OWNER` member). If the projects list isn't loaded
 * yet, a fetch is kicked off so the owner badge resolves once it arrives.
 *
 * @param diagramId Getter for the open diagram's `site_id` (the room/canvas id).
 */
export function useRoomIdentity(diagramId: Ref<string | null>) {
  const auth = useAuthStore()
  const projects = useProjectsStore()

  /** True when the signed-in user owns the project behind the open diagram. */
  const isOwner = computed(() => {
    const userId = auth.user?.id
    if (!userId || !diagramId.value) return false
    const project = projects.projects.find(
      (p) => p.diagram?.site_id === diagramId.value,
    )
    if (!project) return false
    if (project.ownerId === userId) return true
    return (project.members ?? []).some(
      (m) => m.role === 'OWNER' && m.userId === userId,
    )
  })

  const identity = computed<PresenceUser | null>(() => {
    if (!diagramId.value) return null // single-player local canvas

    const user = auth.user
    if (!user) {
      const id = getGuestId()
      return { id, name: 'Guest', color: peerColor(id), isOwner: false }
    }

    const id = String(user.id)
    if (isOwner.value) {
      return { id, name: OWNER_LABEL, color: OWNER_COLOR, isOwner: true }
    }
    const name = user.fullname || user.username || 'Anonymous'
    return { id, name, color: peerColor(id), isOwner: false }
  })

  /** Ensure projects are loaded so ownership can be determined in the editor. */
  function ensureOwnershipResolved() {
    if (
      auth.isAuthenticated &&
      diagramId.value &&
      projects.projects.length === 0 &&
      !projects.loading
    ) {
      void projects.fetchProjects()
    }
  }

  return { identity, isOwner, ensureOwnershipResolved }
}
