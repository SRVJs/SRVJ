import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDiagramStore } from '@/stores/diagram'
import { useAuthStore } from '@/stores/auth'
import { getDiagram, saveDiagram } from '@/utils/projectsApi'
import { AUTOSAVE_DELAY, DIAGRAM_VERSION } from '@/utils/constants'
import { diagramToSnapshot } from '@/types/project'
import type { DiagramSnapshot } from '@/types/diagram'

const EMPTY_SNAPSHOT: DiagramSnapshot = { version: DIAGRAM_VERSION, nodes: [], edges: [] }

/**
 * Backend-backed twin of {@link useDiagramPersistence}: loads a diagram's canvas
 * from the SRVJ backend (by `diagram.site_id`) and debounce-saves changes back.
 * The backend `Diagram` already stores `version`/`nodes`/`edges`, so a load is
 * just `diagramToSnapshot(...)` → `applySnapshot`, and a save ships the snapshot
 * fields straight through. Real-time/CRDT merging is server-side.
 *
 * `getSiteId` is a getter so the caller can pass a reactive route param.
 */
export function useDiagramSync(getSiteId: () => string | null) {
  const store = useDiagramStore()
  const auth = useAuthStore()
  const { nodes, edges } = storeToRefs(store)

  let timer: ReturnType<typeof setTimeout> | undefined
  // Gate auto-save until the initial load has populated the store, so the
  // first GET doesn't immediately echo back as a PATCH.
  let ready = false

  async function load(): Promise<boolean> {
    const id = getSiteId()
    if (!id || !auth.token) return false
    try {
      const diagram = await getDiagram(id, auth.token)
      store.applySnapshot(diagram ? diagramToSnapshot(diagram) : EMPTY_SNAPSHOT)
      ready = true
      return true
    } catch {
      // Leave the canvas empty on failure; the toolbar still works.
      store.applySnapshot(EMPTY_SNAPSHOT)
      return false
    }
  }

  function save() {
    const id = getSiteId()
    if (!id || !auth.token) return
    const snapshot = store.snapshot
    void saveDiagram(
      id,
      { version: snapshot.version, nodes: snapshot.nodes, edges: snapshot.edges },
      auth.token,
    )
  }

  function start() {
    watch(
      [nodes, edges],
      () => {
        if (!ready) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(save, AUTOSAVE_DELAY)
      },
      { deep: true },
    )
  }

  return { load, save, start }
}
