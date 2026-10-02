<script setup lang="ts">
import { t } from "../i18n";
import { ref } from "vue";
import type { ConnectionState } from "../types/message";
defineProps<{ state: ConnectionState; count: number; drawerOpen: boolean }>();
defineEmits<{ menu: [] }>();
const menuButton = ref<HTMLButtonElement>();
defineExpose({ focusMenu: () => menuButton.value?.focus() });
</script>

<template>
  <header class="chat-header">
    <button
      ref="menuButton"
      class="menu-button icon-button"
      :aria-label="t('Open sidebar')"
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
      <h2>{{ t('Local Network') }}</h2>
    </div>
    <div class="header-status">
      <span class="desktop-device-count"
        >{{ t(count === 1 ? "{count} device" : "{count} devices", { count }) }}</span
      >
      <button
        class="header-devices"
        :aria-label="t('View connected devices')"
        @click="$emit('menu')"
      >
        {{ t(count === 1 ? "{count} device" : "{count} devices", { count }) }}
      </button>
      <span class="connection" :class="state"
        ><i class="status-dot" :class="state" aria-hidden="true"></i
        >{{
          state === "connected"
            ? t("Connected")
            : state === "connecting"
              ? t("Connecting")
              : t("Disconnected")
        }}</span
      >
    </div>
  </header>
</template>
