<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { ConnectionState, Device } from "../types/message";
import { REPOSITORY_URL } from "../config";
import { t } from "../i18n";

const props = defineProps<{
  devices: Device[];
  version: string;
  infoLoading: boolean;
  clientId: string;
  state: ConnectionState;
  mobile: boolean;
  open: boolean;
}>();
const emit = defineEmits<{
  close: [];
  rename: [];
  settings: [];
}>();
const panel = ref<HTMLElement>();
const closeButton = ref<HTMLButtonElement>();
const server = location.host;
const settingsButton = ref<HTMLButtonElement>();
defineExpose({ focusSettings: () => settingsButton.value?.focus() });

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
    panel.value?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], select:not([disabled])') || [],
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
        :aria-label="t('Close sidebar')"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <nav class="sidebar-chat" :aria-label="t('Chats')">
      <h2 class="sidebar-section-title">{{ t('Chats') }}</h2>
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
          ><strong>{{ t('Local Network') }}</strong><small>{{ t('Messages & files') }}</small></span
        >
        <i class="status-dot" :class="state" aria-hidden="true"></i>
      </button>
    </nav>

    <section class="sidebar-devices" aria-labelledby="devices-title">
      <h2 id="devices-title" class="sidebar-section-title">
        {{ t('Devices') }} <span>· {{ devices.length }}</span>
      </h2>
      <ul class="device-list">
        <li v-for="device in devices" :key="device.id">
          <component
            :is="device.id === clientId ? 'button' : 'div'"
            class="device-row"
            :type="device.id === clientId ? 'button' : undefined"
            :aria-label="
              device.id === clientId ? t('Change your name') : undefined
            "
            @click="device.id === clientId && emit('rename')"
          >
            <span class="avatar" aria-hidden="true">{{
              [...device.username][0]?.toUpperCase()
            }}</span>
            <div class="device-details">
              <strong>{{ device.username }}</strong>
              <p>
                <span v-if="device.id === clientId">{{ t('You') }} · </span
                ><span>{{ device.ip }}</span>
              </p>
            </div>
            <i
              class="status-dot connected"
              :title="t('Online')"
              :aria-label="t('Online')"
            ></i>
          </component>
        </li>
      </ul>
      <p v-if="!devices.length" class="sidebar-empty">
        {{
          state === "connecting"
            ? t("Connecting to the server…")
            : t("No connected devices")
        }}
      </p>
    </section>

    <div class="sidebar-footer">
      <button
        ref="settingsButton"
        class="sidebar-settings"
        type="button"
        :aria-label="t('Settings')"
        aria-haspopup="dialog"
        @click="emit('settings')"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 3-.7 2.5-2.2 1.3-2.5-.6-2 3.6L3.5 12l-1.9 2.2 2 3.6 2.5-.6 2.2 1.3L9 21h4l.7-2.5 2.2-1.3 2.5.6 2-3.6-1.9-2.2 1.9-2.2-2-3.6-2.5.6-2.2-1.3L13 3H9Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
          <circle cx="11" cy="12" r="3" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <span>{{ t('Settings') }}</span>
      </button>
      <div class="sidebar-server">
        <span>{{ t('Server') }}</span><span class="server-address">{{ server }}</span>
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
        <span>{{ t('LocalChat Repository') }}</span>
      </a>
      <p class="sidebar-version" :aria-label="t('Application version')">
        {{ version || (infoLoading ? "…" : t("Version unavailable")) }}
      </p>
    </div>
  </aside>
</template>
