<script setup lang="ts">
import { ref } from "vue";
import type { FileInfo } from "../types/message";
import { formatBytes } from "../format";
const props = defineProps<{ file: FileInfo }>();
const checking = ref(false);
const error = ref("");
async function download() {
  if (checking.value) return;
  checking.value = true;
  error.value = "";
  try {
    const url = `/api/files/${props.file.id}`;
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? "This file expired when the server stopped."
          : "This file is unavailable. Please try again.",
      );
    const link = document.createElement("a");
    link.href = url;
    link.download = props.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Download unavailable.";
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <div class="file-message">
    <div class="file-icon" aria-hidden="true">↓</div>
    <div class="file-details">
      <strong>{{ file.name }}</strong
      ><span
        >{{ formatBytes(file.size) }}
        <span class="file-ready">· Ready to download</span></span
      >
    </div>
    <a
      class="button download-button"
      :href="`/api/files/${file.id}`"
      :download="file.name"
      :aria-disabled="checking"
      @click.prevent="download"
      >{{ checking ? "Checking…" : "Download" }}
      <span aria-hidden="true">↓</span></a
    >
    <p v-if="error" class="transfer-error full-width" role="alert">
      {{ error }}
    </p>
  </div>
</template>
