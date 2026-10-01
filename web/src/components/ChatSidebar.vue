<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { ConnectionState, Device } from "../types/message";

const props = defineProps<{
  devices: Device[];
  username: string;
  ip: string;
  clientId: string;
  state: ConnectionState;
  mobile: boolean;
  open: boolean;
}>();
const emit = defineEmits<{ close: []; rename: [] }>();
const panel = ref<HTMLElement>();
const closeButton = ref<HTMLButtonElement>();
const server = location.host;

watch(
  () => props.open,
  async (open) => {
    if (open && props.mobile) {
      await nextTick();
      closeButton.value?.focus();
    }
  },
);

function trapFocus(event: KeyboardEvent) {
  if (!props.mobile || !props.open || event.key !== "Tab") return;
  const controls = Array.from(
    panel.value?.querySelectorAll<HTMLElement>("button, a[href]") || [],
  );
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
</script>

<template>
  <aside
    ref="panel"
    class="chat-sidebar"
    :class="{ 'drawer-open': open }"
    :role="mobile ? 'dialog' : undefined"
    :aria-modal="mobile && open ? true : undefined"
    :aria-hidden="mobile && !open ? true : undefined"
    :inert="mobile && !open"
    aria-labelledby="sidebar-title"
    @keydown.esc.prevent="mobile && emit('close')"
    @keydown="trapFocus"
  >
    <div class="sidebar-brand">
      <div class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M5 5h14v10H9l-4 4V5Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          <path
            d="M9 9h6M9 12h4"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <div>
        <h1 id="sidebar-title">LocalChat</h1>
        <p>Local network messaging</p>
      </div>
      <button
        ref="closeButton"
        class="sidebar-close icon-button"
        aria-label="Close sidebar"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <nav class="sidebar-chat" aria-label="Chats">
      <h2 class="sidebar-section-title">Chat</h2>
      <button
        class="network-chat"
        aria-current="page"
        @click="mobile && emit('close')"
      >
        <span class="network-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M4 5h16v11H9l-5 4V5Z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <circle cx="8" cy="10" r="1" fill="currentColor" />
            <circle cx="12" cy="10" r="1" fill="currentColor" />
            <circle cx="16" cy="10" r="1" fill="currentColor" />
          </svg>
        </span>
        <span
          ><strong>Local Network</strong
          ><small>Messages & temporary files</small></span
        >
        <i class="status-dot" :class="state" aria-hidden="true"></i>
      </button>
    </nav>

    <section class="sidebar-devices" aria-labelledby="devices-title">
      <h2 id="devices-title" class="sidebar-section-title">
        Devices <span>· {{ devices.length }}</span>
      </h2>
      <ul class="device-list">
        <li v-for="device in devices" :key="device.id" class="device-row">
          <span class="avatar" aria-hidden="true">{{
            [...device.username][0]?.toUpperCase()
          }}</span>
          <div class="device-details">
            <strong>{{ device.username }}</strong>
            <p>
              <span v-if="device.id === clientId">You · </span
              ><code>{{ device.ip }}</code>
            </p>
          </div>
          <i
            class="status-dot connected"
            title="Online"
            aria-label="Online"
          ></i>
        </li>
      </ul>
      <p v-if="!devices.length" class="sidebar-empty">
        {{
          state === "connecting"
            ? "Connecting to the server…"
            : "No connected devices"
        }}
      </p>
    </section>

    <div class="sidebar-server">
      <span>Server</span><code>{{ server }}</code>
    </div>
    <button
      class="sidebar-user"
      aria-label="Change your name"
      @click="emit('rename')"
    >
      <span class="avatar user-avatar" aria-hidden="true">{{
        [...(username || "?")][0]?.toUpperCase()
      }}</span>
      <span class="current-user"
        ><strong>{{ username || "Choose your name" }}</strong
        ><code>{{ ip || "Not connected" }}</code></span
      >
      <svg class="edit-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m15 5 4 4M5 19l1-5L16 4a2.8 2.8 0 0 1 4 4L10 18l-5 1Z"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </aside>
</template>
