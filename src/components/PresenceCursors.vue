<script setup lang="ts">
import { computed } from 'vue'
import type { PresencePeer } from '@/utils/presence'

/**
 * Overlay of remote collaborators' cursors (Miro/Figma-style). Each peer's
 * cursor is stored in **flow coordinates**, so we project it back to wrapper
 * pixels with the live Vue Flow viewport (`flowX * zoom + viewport.x`). The
 * cursor icon and name pill keep a constant screen size (we don't scale them
 * with zoom) and carry each user's colour — the owner is a black "owner" arrow.
 */
const props = defineProps<{
  peers: PresencePeer[]
  viewport: { x: number; y: number; zoom: number }
}>()

interface PlacedPeer {
  clientId: number
  name: string
  color: string
  left: number
  top: number
}

const placed = computed<PlacedPeer[]>(() =>
  props.peers
    .filter((p) => p.cursor)
    .map((p) => ({
      clientId: p.clientId,
      name: p.user.name,
      color: p.user.color,
      left: p.cursor!.x * props.viewport.zoom + props.viewport.x,
      top: p.cursor!.y * props.viewport.zoom + props.viewport.y,
    })),
)
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-30 overflow-hidden">
    <div
      v-for="peer in placed"
      :key="peer.clientId"
      class="presence-cursor absolute left-0 top-0"
      :style="{ transform: `translate(${peer.left}px, ${peer.top}px)` }"
    >
      <!-- Pointer arrow, tinted to the user's colour. -->
      <svg
        width="20"
        height="22"
        viewBox="0 0 20 22"
        fill="none"
        aria-hidden="true"
        class="drop-shadow-sm"
      >
        <path
          d="M2 2 L2 17 L6.2 13 L9 19.5 L11.7 18.3 L8.9 11.9 L14.5 11.9 Z"
          :fill="peer.color"
          stroke="white"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
      </svg>

      <!-- Name pill -->
      <span
        class="absolute left-[16px] top-[16px] whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white shadow-sm"
        :style="{ backgroundColor: peer.color }"
      >
        {{ peer.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Glide cursors between positions so movement looks live, not teleported. */
.presence-cursor {
  transition: transform 90ms linear;
  will-change: transform;
}
</style>
