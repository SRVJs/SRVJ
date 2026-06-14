<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from '@vue-flow/core'
import { useDiagramStore } from '@/stores/diagram'

// A single straight-line edge with an inline-editable text label sitting on the
// midpoint (the "Push work" / "Delegate" labels in the reference diagram).
// Double-click the line (or the label) to edit; Enter / blur commits, Esc cancels.
const props = defineProps<EdgeProps>()
const store = useDiagramStore()

const geometry = computed(() =>
  getStraightPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  }),
)
const path = computed(() => geometry.value[0])
const labelX = computed(() => geometry.value[1])
const labelY = computed(() => geometry.value[2])

const label = computed(() => (typeof props.label === 'string' ? props.label : ''))

const editing = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

async function startEditing() {
  if (editing.value) return
  draft.value = label.value
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function commitEditing() {
  if (!editing.value) return
  store.updateEdgeLabel(props.id, draft.value.trim())
  editing.value = false
}

function cancelEditing() {
  editing.value = false
}
</script>

<template>
  <BaseEdge :id="id" :path="path" :marker-end="markerEnd" :style="style" />

  <EdgeLabelRenderer>
    <div
      class="edge-label nodrag nopan"
      :class="{ 'edge-label--empty': !label && !editing }"
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      }"
      @dblclick.stop="startEditing"
    >
      <input
        v-if="editing"
        ref="inputRef"
        v-model="draft"
        type="text"
        class="edge-label__input"
        placeholder="Label"
        @keydown.enter.prevent="commitEditing"
        @keydown.esc.prevent="cancelEditing"
        @blur="commitEditing"
        @pointerdown.stop
      />
      <span v-else-if="label" class="edge-label__text">{{ label }}</span>
      <span v-else class="edge-label__hint">+ label</span>
    </div>
  </EdgeLabelRenderer>
</template>
