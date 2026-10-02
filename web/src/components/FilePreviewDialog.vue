<script setup lang="ts">
import { t, notice } from "../i18n";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { FileInfo } from "../types/message";
import { formatBytes } from "../format";
import { useFileDownload } from "../composables/useFileDownload";

const props = defineProps<{ file: FileInfo }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement>();
const closeButton = ref<HTMLButtonElement>();
const loading = ref(true);
const text = ref("");
const truncated = ref(false);
const error = ref("");
const copyNotice = ref("");
const {
  checking,
  error: downloadError,
  download,
} = useFileDownload(props.file);
const url = `/api/files/${encodeURIComponent(props.file.id)}/preview`;
const downloadUrl = `/api/files/${encodeURIComponent(props.file.id)}`;
const controller = new AbortController();
const previousFocus = document.activeElement as HTMLElement | null;
let timer: ReturnType<typeof setTimeout>;

onMounted(async () => {
  await nextTick();
  closeButton.value?.focus();
  timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: props.file.previewType === "text" ? "GET" : "HEAD",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? "File is no longer available."
          : "Preview unavailable. You can still download this file.",
      );
    if (response.headers.get("X-Preview-Type") !== props.file.previewType)
      throw new Error("Preview unavailable. You can still download this file.");
    if (props.file.previewType === "text") {
      text.value = await response.text();
      truncated.value = response.headers.get("X-Preview-Truncated") === "true";
    }
  } catch (err) {
    error.value =
      err instanceof Error && err.name !== "AbortError"
        ? err.message
        : "Preview unavailable. You can still download this file.";
  } finally {
    clearTimeout(timer);
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  controller.abort();
  // Vue removes inert from the chat during the same update before restoring focus.
  void nextTick(() => previousFocus?.focus());
});
async function copy() {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text.value);
    copyNotice.value = "Copied.";
  } catch {
    copyNotice.value = "Copy unavailable. Select the text to copy it.";
  }
}
function trap(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>("button, a[href]") || [],
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
  <div
    class="preview-backdrop"
    @click.self="emit('close')"
    @keydown.esc.prevent="emit('close')"
    @keydown="trap"
  >
    <section
      ref="dialog"
      class="preview-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      :aria-busy="loading"
    >
      <header class="preview-header">
        <h2 id="preview-title">{{ file.name }}</h2>
        <button
          v-if="file.previewType === 'text' && !loading && !error"
          class="text-button"
          @click="copy"
        >
          {{ t('Copy') }}
        </button>
        <button
          ref="closeButton"
          class="icon-button"
          :aria-label="t('Close preview')"
          @click="emit('close')"
        >
          ×
        </button>
      </header>
      <div class="preview-body">
        <p v-if="downloadError" class="preview-status" role="alert">
          {{ notice(downloadError) }}
        </p>
        <p v-if="loading" class="preview-status" role="status">
          {{ t('Loading preview…') }}
        </p>
        <p v-else-if="error" class="preview-status" role="alert">{{ notice(error) }}</p>
        <template v-else-if="file.previewType === 'text'">
          <p v-if="truncated" class="preview-limit">
            {{ t('Previewing first 512 KiB.') }}
          </p>
          <p v-if="copyNotice" class="preview-limit" role="status">
            {{ t(copyNotice) }}
          </p>
          <pre class="preview-text">{{ text }}</pre>
          <p v-if="truncated" class="preview-limit">
            {{ t('Preview truncated. Download full file below.') }}
          </p>
        </template>
        <img
          v-else-if="file.previewType === 'image'"
          class="preview-image"
          :src="url"
          :alt="file.name"
          @error="
            error = 'Preview unavailable. You can still download this file.'
          "
        />
        <template v-else-if="file.previewType === 'pdf'">
          <p class="preview-status">
            {{ t('Use your browser’s native viewer to preview this PDF.') }}
          </p>
          <a
            class="download-button"
            :href="url"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t('Open PDF preview') }} ↗</a
          >
          <p class="preview-limit pdf-hint">
            {{ t('If preview is unavailable in this browser, download the file to open it locally.') }}
          </p>
        </template>
      </div>
      <footer class="preview-footer">
        <span>{{ formatBytes(file.size) }}</span>
        <a
          class="download-button"
          :href="downloadUrl"
          :download="file.name"
          :aria-disabled="checking"
          @click.prevent="download"
          >{{
            checking
              ? t("Checking…")
              : truncated
                ? t("Download full file")
                : t("Download")
          }}
          ↓</a
        >
      </footer>
    </section>
  </div>
</template>
