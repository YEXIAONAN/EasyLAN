<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { MAX_MESSAGE_SIZE } from "../composables/useWebSocket";
const props = defineProps<{
  connected: boolean;
  sendText: (content: string) => boolean;
}>();
const emit = defineEmits<{ files: [files: File[]] }>();
const draft = ref("");
const textarea = ref<HTMLTextAreaElement>();
const picker = ref<HTMLInputElement>();
const bytes = computed(() => new TextEncoder().encode(draft.value).length);
async function resize() {
  await nextTick();
  if (textarea.value) {
    textarea.value.style.height = "auto";
    textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, 140)}px`;
  }
}
function send() {
  if (!draft.value.trim()) return;
  if (props.sendText(draft.value)) {
    draft.value = "";
    resize();
  }
}
function keydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
}
function files(event: Event) {
  const input = event.target as HTMLInputElement;
  emit("files", Array.from(input.files || []));
  input.value = "";
}
</script>

<template>
  <footer class="composer-area">
    <div class="composer-inner">
      <div class="composer">
        <button
          class="attach-button"
          title="Attach files"
          aria-label="Attach files"
          :disabled="!connected"
          @click="picker?.click()"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg></button
        ><input
          ref="picker"
          class="visually-hidden"
          type="file"
          multiple
          @change="files"
        /><textarea
          ref="textarea"
          v-model="draft"
          aria-label="Message"
          placeholder="Message…"
          rows="1"
          @input="resize"
          @keydown="keydown"
        ></textarea
        ><button
          class="send-button"
          aria-label="Send"
          title="Send message"
          :disabled="!connected || !draft.trim() || bytes > MAX_MESSAGE_SIZE"
          @click="send"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5m-6 6 6-6 6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <p v-if="bytes > MAX_MESSAGE_SIZE" class="composer-error" role="alert">
        Message is too large. Consider sending it as a file.
      </p>
    </div>
  </footer>
</template>
