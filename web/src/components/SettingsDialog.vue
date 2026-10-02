<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { LANGUAGES, locale, setLocale, t } from "../i18n";
import {
  SOUND_PRESETS, type SoundId, type SoundKind,
} from "../composables/useNotification";

const props = defineProps<{
  soundEnabled: boolean;
  sentSoundEnabled: boolean;
  receivedTone: SoundId;
  sentTone: SoundId;
}>();
const emit = defineEmits<{
  close: [];
  sound: [enabled: boolean];
  sentSound: [enabled: boolean];
  tone: [kind: SoundKind, value: string];
  preview: [kind: SoundKind];
}>();
const panel = ref<HTMLElement>();
const closeButton = ref<HTMLButtonElement>();
const channels = computed(() => [
  { kind: "receive" as const, label: "Receive sound", enabled: props.soundEnabled, tone: props.receivedTone },
  { kind: "send" as const, label: "Send sound", enabled: props.sentSoundEnabled, tone: props.sentTone },
]);
onMounted(async () => {
  await nextTick();
  closeButton.value?.focus();
});
function toggle(kind: SoundKind) {
  if (kind === "receive") emit("sound", !props.soundEnabled);
  else emit("sentSound", !props.sentSoundEnabled);
}
function trap(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    panel.value?.querySelectorAll<HTMLElement>("button:not([disabled]), select") || [],
  );
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first?.focus();
  }
}
</script>

<template>
  <div
    class="dialog-backdrop"
    @click.self="emit('close')"
    @keydown.esc.stop.prevent="emit('close')"
    @keydown="trap"
  >
    <section ref="panel" class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="settings-header">
        <h2 id="settings-title">{{ t('Settings') }}</h2>
        <button ref="closeButton" class="icon-button" :aria-label="t('Close settings')" @click="emit('close')">×</button>
      </header>
      <div class="settings-language">
        <label for="localchat-language">{{ t('Language') }}</label>
        <select id="localchat-language" :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value)">
          <option v-for="language in LANGUAGES" :key="language.id" :value="language.id">{{ language.label }}</option>
        </select>
      </div>
      <section class="settings-sounds" aria-labelledby="sounds-title">
        <h3 id="sounds-title">{{ t('Sounds') }}</h3>
        <div v-for="channel in channels" :key="channel.kind" class="settings-sound-row">
          <button
            class="settings-toggle"
            :aria-label="t(channel.label)"
            :aria-pressed="channel.enabled"
            @click="toggle(channel.kind)"
          >
            <span>{{ t(channel.label) }}</span>
            <span class="settings-toggle-state" :class="{ enabled: channel.enabled }">{{ t(channel.enabled ? 'On' : 'Off') }}</span>
          </button>
          <div class="settings-tone">
            <select
              :aria-label="t(`${channel.label} tone`)"
              :value="channel.tone"
              @change="emit('tone', channel.kind, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="preset in SOUND_PRESETS" :key="preset.id" :value="preset.id">{{ t(preset.label) }}</option>
            </select>
            <button
              class="sound-preview icon-button"
              :aria-label="t(`Preview ${channel.label.toLowerCase()}`)"
              :title="t(`Preview ${channel.label.toLowerCase()}`)"
              :disabled="!channel.enabled"
              @click="emit('preview', channel.kind)"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m7 5 8 5-8 5V5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>
      <p class="settings-hint">{{ t('Changes are saved in this browser.') }}</p>
    </section>
  </div>
</template>
