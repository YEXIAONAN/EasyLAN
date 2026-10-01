<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { SoundOption } from "../composables/useNotificationSound";

const props = defineProps<{
  open: boolean;
  enabled: boolean;
  options: SoundOption[];
  selected: string;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  toggle: [value: boolean];
  select: [id: string];
  preview: [id: string];
  upload: [file: File];
  remove: [id: string];
}>();
const dialog = ref<HTMLElement>();
const first = ref<HTMLButtonElement>();
const picker = ref<HTMLInputElement>();

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    first.value?.focus();
  },
);

function trap(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const items = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>("input, button") || [],
  );
  const head = items[0],
    tail = items.at(-1);
  if (event.shiftKey && document.activeElement === head) {
    event.preventDefault();
    tail?.focus();
  } else if (!event.shiftKey && document.activeElement === tail) {
    event.preventDefault();
    head?.focus();
  }
}

function choose(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("upload", file);
  input.value = "";
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @keydown.esc="emit('close')">
    <section
      ref="dialog"
      class="settings-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      @keydown="trap"
    >
      <header class="settings-header">
        <h2 id="settings-title">Settings</h2>
        <button
          ref="first"
          class="icon-button"
          aria-label="Close settings"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>

      <section class="settings-section" aria-labelledby="notifications-title">
        <h3 id="notifications-title" class="settings-section-title">
          Notifications
        </h3>
        <div class="settings-row">
          <div class="settings-row-text">
            <strong>Notification sound</strong>
            <p>Send and receive use the selected sound, with sending one octave lower.</p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              :checked="enabled"
              @change="
                emit('toggle', ($event.target as HTMLInputElement).checked)
              "
            />
            <span class="switch-track" aria-hidden="true"></span>
            <span class="visually-hidden">Enable notification sound</span>
          </label>
        </div>

        <fieldset class="sound-options">
          <legend class="visually-hidden">Notification sound</legend>
          <div
            v-for="option in options"
            :key="option.id"
            class="sound-option"
            :class="{ selected: selected === option.id }"
          >
            <label class="sound-choice">
              <input
                type="radio"
                name="notification-sound"
                :value="option.id"
                :checked="selected === option.id"
                @change="emit('select', option.id)"
              />
              <span class="sound-name">{{ option.name }}</span>
            </label>
            <div class="sound-actions">
              <button
                class="text-button"
                type="button"
                @click="emit('preview', option.id)"
              >
                Preview
              </button>
              <button
                v-if="option.custom"
                class="text-button"
                type="button"
                @click="emit('remove', option.id)"
              >
                Remove
              </button>
            </div>
          </div>
        </fieldset>

        <input
          ref="picker"
          class="visually-hidden"
          type="file"
          accept="audio/*"
          @change="choose"
        />
        <button class="button" type="button" @click="picker?.click()">
          Upload sound
        </button>
        <p class="settings-hint">
          Uploaded sounds are stored in this browser only.
        </p>
        <p v-if="error" class="settings-error" role="alert">{{ error }}</p>
      </section>
    </section>
  </div>
</template>