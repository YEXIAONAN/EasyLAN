<script setup lang="ts">
import { computed } from "vue";
import type { Upload } from "../types/file";
import { formatBytes } from "../format";
const props = defineProps<{ upload: Upload }>();
defineEmits<{ pause: []; resume: []; cancel: []; dismiss: [] }>();
const progress = computed(() =>
  props.upload.file.size
    ? Math.floor((props.upload.uploadedBytes / props.upload.file.size) * 100)
    : props.upload.status === "completed"
      ? 100
      : 0,
);
const labels = {
  queued: "In queue",
  uploading: "Uploading",
  paused: "Paused",
  completing: "Preparing download",
  completed: "Uploaded",
  failed: "Upload failed",
  cancelling: "Cancelling",
  cancelled: "Cancelled",
};
</script>

<template>
  <article class="transfer-card" :class="upload.status">
    <div class="transfer-top">
      <div class="file-icon" aria-hidden="true">↥</div>
      <div class="transfer-name">
        <strong>{{ upload.file.name }}</strong>
        <p v-if="upload.status === 'completed'">
          {{ formatBytes(upload.file.size) }} <span>· Ready</span>
        </p>
        <p v-else>
          {{ formatBytes(upload.uploadedBytes) }}
          <span>/ {{ formatBytes(upload.file.size) }}</span>
        </p>
      </div>
      <span class="transfer-state">{{ labels[upload.status] }}</span
      ><button
        v-if="upload.status === 'completed' || upload.status === 'cancelled'"
        class="dismiss-transfer"
        aria-label="Dismiss transfer"
        @click="$emit('dismiss')"
      >
        ×
      </button>
    </div>
    <div
      v-if="upload.status !== 'completed' && upload.status !== 'cancelled'"
      class="transfer-progress"
      role="progressbar"
      :aria-label="`Upload ${upload.file.name}`"
      :aria-valuenow="progress"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div :style="{ width: `${progress}%` }"></div>
    </div>
    <div class="transfer-bottom">
      <span
        v-if="upload.status !== 'completed' && upload.status !== 'cancelled'"
        >{{ upload.completedChunks }} / {{ upload.totalChunks }} chunks
        <span class="transfer-speed"
          >· {{ formatBytes(upload.speed) }}/s</span
        ></span
      ><strong
        v-if="upload.status !== 'completed' && upload.status !== 'cancelled'"
        >{{ progress }}%</strong
      >
      <div class="transfer-actions">
        <button
          v-if="upload.status === 'uploading' || upload.status === 'queued'"
          class="text-button"
          @click="$emit('pause')"
        >
          Pause</button
        ><button
          v-if="upload.status === 'paused' || upload.status === 'failed'"
          class="text-button"
          @click="$emit('resume')"
        >
          {{ upload.status === "paused" ? "Resume" : "Retry" }}</button
        ><button
          v-if="
            ['queued', 'uploading', 'paused', 'failed'].includes(upload.status)
          "
          class="text-button cancel-button"
          @click="$emit('cancel')"
        >
          Cancel</button
        ><a
          v-if="upload.status === 'completed'"
          class="text-button"
          :href="`/api/files/${upload.fileId}`"
          >Download ↓</a
        >
      </div>
    </div>
    <p v-if="upload.error" class="transfer-error" role="alert">
      {{ upload.error }}
    </p>
  </article>
</template>
