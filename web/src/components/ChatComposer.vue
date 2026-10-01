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
    <div class="composer">
      <button
        class="attach-button"
        title="Attach files"
        aria-label="Attach files"
        :disabled="!connected"
        @click="picker?.click()"
      >
        +</button
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
        placeholder="Write a message…"
        rows="1"
        @input="resize"
        @keydown="keydown"
      ></textarea
      ><button
        class="button primary send-button"
        :disabled="!connected || !draft.trim() || bytes > MAX_MESSAGE_SIZE"
        @click="send"
      >
        Send <span aria-hidden="true">↑</span>
      </button>
    </div>
    <div class="composer-hints">
      <span :class="{ 'text-danger': bytes > MAX_MESSAGE_SIZE }">{{
        bytes > MAX_MESSAGE_SIZE
          ? "Message is too large. Consider sending it as a file."
          : "Enter to send · Shift + Enter for a new line"
      }}</span
      ><span class="composer-file-hint">Files up to 1 GB</span>
    </div>
  </footer>
</template>
