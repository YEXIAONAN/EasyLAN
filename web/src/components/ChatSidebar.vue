<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { ConnectionState, Device } from "../types/message";
import { REPOSITORY_URL } from "../config";

const props = defineProps<{
  devices: Device[];
  version: string;
  infoLoading: boolean;
  soundEnabled: boolean;
  clientId: string;
  state: ConnectionState;
  mobile: boolean;
  open: boolean;
}>();
const emit = defineEmits<{
  close: [];
  rename: [];
  sound: [enabled: boolean];
}>();
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
      <h2 class="sidebar-section-title">Chats</h2>
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
          ><strong>Local Network</strong><small>Messages & files</small></span
        >
        <i class="status-dot" :class="state" aria-hidden="true"></i>
      </button>
    </nav>

    <section class="sidebar-devices" aria-labelledby="devices-title">
      <h2 id="devices-title" class="sidebar-section-title">
        Devices <span>· {{ devices.length }}</span>
      </h2>
      <ul class="device-list">
        <li v-for="device in devices" :key="device.id">
          <component
            :is="device.id === clientId ? 'button' : 'div'"
            class="device-row"
            :type="device.id === clientId ? 'button' : undefined"
            :aria-label="
              device.id === clientId ? 'Change your name' : undefined
            "
            @click="device.id === clientId && emit('rename')"
          >
            <span class="avatar" aria-hidden="true">{{
              [...device.username][0]?.toUpperCase()
            }}</span>
            <div class="device-details">
              <strong>{{ device.username }}</strong>
              <p>
                <span v-if="device.id === clientId">You · </span
                ><span>{{ device.ip }}</span>
              </p>
            </div>
            <i
              class="status-dot connected"
              title="Online"
              aria-label="Online"
            ></i>
          </component>
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

    <div class="sidebar-footer">
      <button
        class="sidebar-sound"
        type="button"
        aria-label="Message sound"
        :aria-pressed="soundEnabled"
        @click="emit('sound', !soundEnabled)"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M4 7h3l4-3v12l-4-3H4V7Z"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
          <path
            v-if="soundEnabled"
            d="M14 6a6 6 0 0 1 0 8"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
          <path
            v-else
            d="m14 8 4 4m0-4-4 4"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
        <span>Message sound</span
        ><span class="sound-state">{{ soundEnabled ? "On" : "Off" }}</span>
      </button>
      <div class="sidebar-server">
        <span>Server</span><span class="server-address">{{ server }}</span>
      </div>
      <a
        v-if="REPOSITORY_URL"
        class="sidebar-repository"
        :href="REPOSITORY_URL"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="repository-label"
          >GitHub
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M9 3h4v4M13 3 7 9M7 3H3v10h10V9"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>LocalChat Repository</span>
      </a>
      <p class="sidebar-version" aria-label="Application version">
        {{ version || (infoLoading ? "…" : "Version unavailable") }}
      </p>
    </div>
  </aside>
</template>
