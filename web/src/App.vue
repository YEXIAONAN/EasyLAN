<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import ChatSidebar from "./components/ChatSidebar.vue";
import ChatHeader from "./components/ChatHeader.vue";
import MessageList from "./components/MessageList.vue";
import ChatComposer from "./components/ChatComposer.vue";
import UsernameDialog from "./components/UsernameDialog.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import FileTransferCard from "./components/FileTransferCard.vue";
import { useUsername } from "./composables/useUsername";
import { useWebSocket } from "./composables/useWebSocket";
import { useUpload } from "./composables/useUpload";
import { useFileDrop } from "./composables/useFileDrop";
import { useAppInfo } from "./composables/useAppInfo";
import { useNotificationSound } from "./composables/useNotificationSound";
import type { Message } from "./types/message";

const { username, dialogOpen, save } = useUsername();
const { version, loading: infoLoading } = useAppInfo();
const sound = useNotificationSound();

// 他人消息到达：前台播放提示音；页面隐藏且已授权时再弹一条系统通知。
function handleIncoming(message: Message) {
  void sound.play();
  if (
    !document.hidden ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return;
  const body =
    message.type === "file"
      ? `Sent a file: ${message.file?.name ?? ""}`
      : message.content ?? "";
  const notice = new Notification(message.username || "LocalChat", { body });
  notice.onclick = () => {
    window.focus();
    notice.close();
  };
}

const { messages, devices, state, ownIds, clientId, error, sendText } =
  useWebSocket(username, handleIncoming);
const {
  uploads,
  error: uploadError,
  addFiles,
  pause,
  resume,
  cancel,
  dismiss,
} = useUpload(username, clientId);
// 发送成功时播放发送提示音：跟随所选音效的低八度变体，听感 "hui~"。
function sendMessage(content: string) {
  const sent = sendText(content);
  if (sent) void sound.playSend();
  return sent;
}
const media = window.matchMedia("(max-width: 767px)");
const mobile = ref(media.matches);
const drawerOpen = ref(false);
const settingsOpen = ref(false);
const header = ref<InstanceType<typeof ChatHeader>>();

// 开启提示音的同时（用户手势内）申请系统通知权限。
function updateSoundEnabled(value: boolean) {
  sound.setEnabled(value);
  if (
    value &&
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  ) {
    void Notification.requestPermission();
  }
}

function updateBreakpoint() {
  mobile.value = media.matches;
  drawerOpen.value = false;
}
onMounted(() => {
  media.addEventListener("change", updateBreakpoint);
  // 首次用户手势时解锁音频上下文，满足自动播放策略。
  window.addEventListener("pointerdown", sound.unlock, { once: true });
  window.addEventListener("keydown", sound.unlock, { once: true });
});
onBeforeUnmount(() => {
  media.removeEventListener("change", updateBreakpoint);
  window.removeEventListener("pointerdown", sound.unlock);
  window.removeEventListener("keydown", sound.unlock);
});
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
  if (dialogOpen.value || settingsOpen.value || state.value !== "connected") {
    uploadError.value = "Connect to LocalChat before sending files.";
    return;
  }
  addFiles(files);
}
const { dragging } = useFileDrop(queueFiles);
</script>

<template>
  <div class="app-layout" :inert="dialogOpen || settingsOpen">
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
      :client-id="clientId"
      :state="state"
      :mobile="mobile"
      :open="drawerOpen"
      @close="closeDrawer"
      @rename="rename"
      @settings="settingsOpen = true"
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
        :send-text="sendMessage"
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
  <SettingsDialog
    :open="settingsOpen"
    :enabled="sound.enabled.value"
    :options="sound.options.value"
    :selected="sound.selection.value"
    :error="sound.error.value"
    @close="settingsOpen = false"
    @toggle="updateSoundEnabled"
    @select="sound.select"
    @preview="sound.preview"
    @upload="sound.upload"
    @remove="sound.remove"
  />
  <div v-if="dragging && !dialogOpen && !settingsOpen" class="drop-overlay">
    <div>
      <span class="drop-symbol" aria-hidden="true">↥</span>
      <h2>Drop files to send</h2>
      <p>Up to 1 GB per file</p>
    </div>
  </div>
</template>
