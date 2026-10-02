<script setup lang="ts">
import { t, notice } from "../i18n";
import { inject } from "vue";
import type { FileInfo } from "../types/message";
import { formatBytes } from "../format";
import { useFileDownload } from "../composables/useFileDownload";
import { canPreview, previewFileKey } from "../presentation/preview";
const props = defineProps<{ file: FileInfo }>();
const { checking, error, download } = useFileDownload(props.file);
const preview = inject(previewFileKey);
</script>

<template>
  <div class="file-message">
    <div class="file-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M14 3H6v18h12V7l-4-4Zm0 0v5h4M9 12h6M9 16h4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div class="file-details">
      <strong>{{ file.name }}</strong
      ><span>{{ formatBytes(file.size) }} </span>
    </div>
    <div
      class="file-actions"
      :class="{ 'with-preview': canPreview(file) && preview }"
    >
      <button
        v-if="canPreview(file) && preview"
        class="text-button"
        @click="preview(file)"
      >
        {{ t('Preview') }}
      </button>
      <a
        class="download-button"
        :href="`/api/files/${file.id}`"
        :download="file.name"
        :aria-disabled="checking"
        @click.prevent="download"
        >{{ checking ? t("Checking…") : t("Download") }}
        <span aria-hidden="true">↓</span></a
      >
    </div>
    <p v-if="error" class="transfer-error full-width" role="alert">
      {{ notice(error) }}
    </p>
  </div>
</template>
