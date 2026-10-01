<script setup lang="ts">
import { ref } from "vue";
import type { ConnectionState } from "../types/message";
defineProps<{ state: ConnectionState; count: number; drawerOpen: boolean }>();
defineEmits<{ menu: [] }>();
const menuButton = ref<HTMLButtonElement>();
const server = location.host;
defineExpose({ focusMenu: () => menuButton.value?.focus() });
</script>

<template>
  <header class="chat-header">
    <button
      ref="menuButton"
      class="menu-button icon-button"
      aria-label="Open sidebar"
      :aria-expanded="drawerOpen"
      @click="$emit('menu')"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6h16M4 12h16M4 18h16"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <div class="chat-heading">
      <h2>Local Network</h2>
      <p class="header-server">
        <span>Server</span> <code>{{ server }}</code>
      </p>
    </div>
    <div class="header-status">
      <span class="connection" :class="state"
        ><i class="status-dot" :class="state" aria-hidden="true"></i
        >{{
          state === "connected"
            ? "Connected"
            : state === "connecting"
              ? "Connecting"
              : "Disconnected"
        }}</span
      >
      <span class="desktop-device-count"
        >{{ count }} {{ count === 1 ? "device" : "devices" }}</span
      >
      <button
        class="header-devices"
        aria-label="View connected devices"
        @click="$emit('menu')"
      >
        {{ count }} {{ count === 1 ? "device" : "devices" }}
      </button>
    </div>
  </header>
</template>
