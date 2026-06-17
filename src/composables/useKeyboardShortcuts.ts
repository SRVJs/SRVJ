import { onBeforeUnmount, onMounted } from 'vue'
import { useDiagramStore } from '@/stores/diagram'
import { useEditorTool } from '@/composables/useEditorTool'

/** Returns true when the event originated from an editable field. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

/**
 * Global keyboard shortcuts for the editor:
 *  - Delete / Backspace → delete the current selection
 *  - Ctrl/Cmd + A       → select everything
 *  - Ctrl/Cmd + Z       → undo
 *  - Ctrl/Cmd + Shift + Z or Ctrl + Y → redo
 *  - Escape             → clear the selection
 */
export function useKeyboardShortcuts() {
  const store = useDiagramStore()
  const { resetTool, setTool } = useEditorTool()

  function onKeyDown(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) return

    const ctrl = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()

    if (ctrl && key === 'a') {
      event.preventDefault()
      store.selectAll()
      return
    }

    // `V` → select/cursor tool (Excalidraw shortcut).
    if (!ctrl && key === 'v') {
      resetTool()
      return
    }

    // `P` → freehand pen tool (Excalidraw shortcut).
    if (!ctrl && key === 'p') {
      setTool('draw')
      return
    }

    if (ctrl && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) store.redo()
      else store.undo()
      return
    }

    if (ctrl && key === 'y') {
      event.preventDefault()
      store.redo()
      return
    }

    if (event.key === 'Escape') {
      resetTool()
      store.clearSelection()
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (store.hasSelection) {
        event.preventDefault()
        store.deleteSelected()
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
