<script setup lang="ts">
import { computed, ref } from "vue";
import type { Message } from "../types/message";
import FileMessage from "./FileMessage.vue";
import { presentText } from "../presentation/messages";
const props = defineProps<{ message: Message }>();
const presentation = computed(() => presentText(props.message.content || ""));
const expanded = ref(false);
const copied = ref(false);
const copyError = ref(false);
const long = computed(
  () =>
    (props.message.content?.length || 0) > 1000 ||
    (props.message.content?.split("\n").length || 0) > 12,
);
async function copy() {
  copyError.value = false;
  try {
    if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(props.message.content || "");
    else {
      const input = document.createElement("textarea");
      input.value = props.message.content || "";
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      input.remove();
      if (!ok) throw new Error("Copy unavailable");
    }
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    copyError.value = true;
  }
}
</script>

<template>
  <div class="message-item">
    <div
      v-if="message.type === 'text'"
      class="text-message"
      :class="{ 'code-message': presentation.code }"
    >
      <div v-if="presentation.code" class="code-toolbar">
        <span>{{ presentation.language }}</span>
      </div>
      <pre
        v-if="presentation.code"
        class="message-content code-content"
        :class="{ collapsed: long && !expanded }"
      ><code>{{ presentation.text }}</code></pre>
      <div
        v-else
        class="message-content"
        :class="{ collapsed: long && !expanded }"
      >
        {{ message.content }}
      </div>
      <button
        v-if="long"
        class="text-button expand-message"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? "Collapse" : "Show more" }}
      </button>
      <button
        class="copy-button icon-button"
        :class="{ 'copy-feedback': copied || copyError }"
        :aria-label="copied ? 'Copied' : 'Copy message'"
        :title="
          copyError ? 'Select text to copy' : copied ? 'Copied' : 'Copy message'
        "
        @click="copy"
      >
        <span v-if="copied" aria-hidden="true">✓</span>
        <span v-else-if="copyError" aria-hidden="true">!</span>
        <svg v-else viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect
            x="7"
            y="7"
            width="9"
            height="10"
            rx="1.5"
            stroke="currentColor"
            stroke-width="1.3"
          />
          <path
            d="M12 4H5a1 1 0 0 0-1 1v7"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <span v-if="copyError" class="copy-error" role="status"
        >Select text to copy</span
      >
    </div>
    <FileMessage v-else-if="message.file" :file="message.file" />
  </div>
</template>
