<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { createTextFile, textSendMode } from "../presentation/longText";
const props = defineProps<{
  connected: boolean;
  sendText: (content: string) => boolean;
  sendFile: (file: File) => Promise<boolean>;
}>();
const emit = defineEmits<{ files: [files: File[]] }>();
const draft = ref("");
const textarea = ref<HTMLTextAreaElement>();
const picker = ref<HTMLInputElement>();
const choice = ref(false);
const pending = ref(false);
const notice = ref("");
watch(draft, () => {
  choice.value = false;
  notice.value = "";
});
async function resize() {
  await nextTick();
  if (textarea.value) {
    textarea.value.style.height = "auto";
    textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, 140)}px`;
  }
}
function send() {
  if (!props.connected || pending.value || !draft.value.trim()) return;
  const mode = textSendMode(draft.value);
  if (mode === "txt") {
    void sendTXT();
    return;
  }
  if (mode === "choice") {
    choice.value = true;
    return;
  }
  sendMessage();
}
function sendMessage() {
  if (!props.connected || pending.value || !draft.value.trim()) return;
  if (textSendMode(draft.value) === "txt") {
    void sendTXT();
    return;
  }
  if (props.sendText(draft.value)) {
    draft.value = "";
    resize();
  }
}
async function sendTXT() {
  if (!props.connected || pending.value || !draft.value.trim()) return;
  const original = draft.value;
  pending.value = true;
  choice.value = false;
  notice.value = "Queuing TXT file…";
  try {
    if (!(await props.sendFile(createTextFile(original))))
      throw new Error("Upload session unavailable");
    if (draft.value === original) {
      draft.value = "";
      await resize();
    }
    notice.value = "Long message converted to TXT.";
  } catch {
    notice.value =
      "Could not start TXT upload. Your text is still here; retry the file transfer or send again.";
  } finally {
    pending.value = false;
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
          :disabled="!connected || !draft.trim() || pending"
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
      <div v-if="choice" class="long-text-prompt" role="status">
        <span>Long message detected. Send as:</span>
        <button
          class="text-button"
          :disabled="!connected || pending"
          @click="sendMessage"
        >
          Send as Message
        </button>
        <button
          class="text-button"
          :disabled="!connected || pending"
          @click="sendTXT"
        >
          Send as TXT
        </button>
      </div>
      <p v-else-if="notice" class="composer-notice" role="status">
        {{ notice }}
      </p>
    </div>
  </footer>
</template>
