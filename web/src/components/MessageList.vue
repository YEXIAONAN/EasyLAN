<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { Message } from "../types/message";
import MessageItem from "./MessageItem.vue";
const props = defineProps<{ messages: Message[]; ownIds: Set<string> }>();
const container = ref<HTMLElement>();
const nearBottom = ref(true);
const unread = ref(0);
function onScroll() {
  const el = container.value;
  if (!el) return;
  nearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  if (nearBottom.value) unread.value = 0;
}
function bottom() {
  container.value?.scrollTo({ top: container.value.scrollHeight });
  unread.value = 0;
  nearBottom.value = true;
}
watch(
  () => props.messages.length,
  async () => {
    const follow = nearBottom.value;
    await nextTick();
    if (follow) bottom();
    else unread.value++;
  },
);
</script>

<template>
  <section
    ref="container"
    class="message-list"
    aria-label="Chat messages"
    @scroll="onScroll"
  >
    <div v-if="!messages.some((m) => m.type !== 'system')" class="empty-state">
      <svg
        class="empty-chat-icon"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M9 10h30v23H19L9 41V10Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path
          d="M17 19h14M17 25h10"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <h2>No messages yet</h2>
      <p>Send a message or drop a file to share with this network.</p>
      <p class="session-hint">
        Messages clear on refresh. Files expire when the server stops.
      </p>
    </div>
    <MessageItem
      v-for="(message, index) in messages"
      :key="message.id || index"
      :message="message"
      :own="ownIds.has(message.clientId || '')"
    />
    <button
      v-if="unread"
      class="new-message-button button primary"
      @click="bottom"
    >
      {{ unread }} new {{ unread === 1 ? "message" : "messages" }} ↓
    </button>
  </section>
</template>
