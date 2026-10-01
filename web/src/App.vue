<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, provide, ref } from "vue";
import ChatSidebar from "./components/ChatSidebar.vue";
import ChatHeader from "./components/ChatHeader.vue";
import MessageList from "./components/MessageList.vue";
import ChatComposer from "./components/ChatComposer.vue";
import UsernameDialog from "./components/UsernameDialog.vue";
import FileTransferCard from "./components/FileTransferCard.vue";
import FilePreviewDialog from "./components/FilePreviewDialog.vue";
import type { FileInfo } from "./types/message";
import { previewFileKey } from "./presentation/preview";
import { useUsername } from "./composables/useUsername";
import { useWebSocket } from "./composables/useWebSocket";
import { useUpload } from "./composables/useUpload";
import { useFileDrop } from "./composables/useFileDrop";
import { useAppInfo } from "./composables/useAppInfo";

const { username, dialogOpen, save } = useUsername();
const { version, loading: infoLoading } = useAppInfo();
const {
  messages,
  devices,
  state,
  ownIds,
  clientId,
  error,
  sendText,
  soundEnabled,
  setSoundEnabled,
} = useWebSocket(username);
const {
  uploads,
  error: uploadError,
  addFiles,
  waitForSession,
  pause,
  resume,
  cancel,
  dismiss,
} = useUpload(username, clientId);
const media = window.matchMedia("(max-width: 767px)");
const mobile = ref(media.matches);
const drawerOpen = ref(false);
const header = ref<InstanceType<typeof ChatHeader>>();
const previewFile = ref<FileInfo | null>(null);
provide(previewFileKey, (file) => {
  previewFile.value = file;
});

function updateBreakpoint() {
  mobile.value = media.matches;
  drawerOpen.value = false;
}
onMounted(() => media.addEventListener("change", updateBreakpoint));
onBeforeUnmount(() => media.removeEventListener("change", updateBreakpoint));
async function closeDrawer() {
  drawerOpen.value = false;
  if (mobile.value) {
    await nextTick();
    header.value?.focusMenu();
  }
}
function rename() {
  drawerOpen.value = false;
  dialogOpen.value = true;
}
function queueFiles(files: File[]) {
  if (dialogOpen.value || state.value !== "connected") {
    uploadError.value = "Connect to LocalChat before sending files.";
    return;
  }
  addFiles(files);
}
const { dragging } = useFileDrop(queueFiles);
async function queueTextFile(file: File): Promise<boolean> {
  if (dialogOpen.value || state.value !== "connected") return false;
  const [upload] = addFiles([file]);
  return upload ? waitForSession(upload) : false;
}
</script>

<template>
  <div class="app-layout" :inert="dialogOpen || !!previewFile">
    <div
      v-if="mobile && drawerOpen"
      class="drawer-backdrop"
      aria-hidden="true"
      @click="closeDrawer"
    ></div>
    <ChatSidebar
      :devices="devices"
      :version="version"
      :info-loading="infoLoading"
      :sound-enabled="soundEnabled"
      @sound="setSoundEnabled"
      :client-id="clientId"
      :state="state"
      :mobile="mobile"
      :open="drawerOpen"
      @close="closeDrawer"
      @rename="rename"
    />
    <main class="chat-main" :inert="mobile && drawerOpen">
      <ChatHeader
        ref="header"
        :state="state"
        :count="devices.length"
        :drawer-open="drawerOpen"
        @menu="mobile && (drawerOpen = true)"
      />
      <MessageList :messages="messages" :own-ids="ownIds" />
      <section
        v-if="uploads.length"
        class="transfer-tray"
        aria-label="File transfers"
      >
        <FileTransferCard
          v-for="upload in uploads"
          :key="upload.key"
          :upload="upload"
          @pause="pause(upload)"
          @resume="resume(upload)"
          @cancel="cancel(upload)"
          @dismiss="dismiss(upload)"
        />
      </section>
      <div v-if="error || uploadError" class="error-banner" role="alert">
        <span>{{ error || uploadError }}</span
        ><button
          class="icon-button"
          aria-label="Dismiss error"
          @click="
            error = '';
            uploadError = '';
          "
        >
          ×
        </button>
      </div>
      <ChatComposer
        :connected="state === 'connected'"
        :send-text="sendText"
        :send-file="queueTextFile"
        @files="queueFiles"
      />
    </main>
  </div>
  <UsernameDialog
    :open="dialogOpen"
    :username="username"
    @save="save"
    @close="dialogOpen = false"
  />
  <FilePreviewDialog
    v-if="previewFile"
    :file="previewFile"
    @close="previewFile = null"
  />
  <div v-if="dragging && !dialogOpen && !previewFile" class="drop-overlay">
    <div>
      <span class="drop-symbol" aria-hidden="true">↥</span>
      <h2>Drop files to send</h2>
      <p>Up to 1 GB per file</p>
    </div>
  </div>
</template>
