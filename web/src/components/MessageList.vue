<script setup lang="ts">
import { t, systemMessage } from "../i18n";
import { computed, nextTick, ref, watch } from "vue";
import type { Message } from "../types/message";
import MessageItem from "./MessageItem.vue";
import { groupMessages, messageTime } from "../presentation/messages";
const props = defineProps<{ messages: Message[]; ownIds: Set<string> }>();
const groups = computed(() => groupMessages(props.messages, props.ownIds));
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
    :aria-label="t('Chat messages')"
    @scroll="onScroll"
  >
    <div class="message-stream">
      <div
        v-if="!messages.some((m) => m.type !== 'system')"
        class="empty-state"
      >
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
        <h2>{{ t('No messages yet') }}</h2>
        <p>{{ t('Send a message or drop a file to share with this network.') }}</p>
        <p class="session-hint">
          {{ t('Messages clear on refresh. Files expire when the server stops.') }}
        </p>
      </div>
      <template v-for="group in groups" :key="group.key">
        <div v-if="group.system" class="system-message">
          {{ systemMessage(group.messages[0].content) }}
        </div>
        <article
          v-else
          class="message-group"
          :class="{ own: group.own }"
          :aria-label="
            group.own
              ? t('Your messages')
              : t('Messages from {name}', { name: group.messages[0].username || '?' })
          "
        >
          <div
            v-if="!group.own"
            class="avatar message-avatar"
            aria-hidden="true"
          >
            {{ [...(group.messages[0].username || "?")][0]?.toUpperCase() }}
          </div>
          <div class="message-group-body">
            <div v-if="!group.own" class="group-meta">
              <strong>{{ group.messages[0].username }}</strong>
              <span aria-hidden="true">·</span>
              <span>{{ group.messages[0].ip }}</span>
              <span aria-hidden="true">·</span>
              <time>{{ messageTime(group.messages[0]) }}</time>
            </div>
            <div class="message-bubbles">
              <MessageItem
                v-for="(message, index) in group.messages"
                :key="message.id || index"
                :message="message"
              />
            </div>
            <time v-if="group.own" class="group-time">{{
              messageTime(group.messages[group.messages.length - 1])
            }}</time>
          </div>
        </article>
      </template>
    </div>
    <button
      v-if="unread"
      class="new-message-button button primary"
      @click="bottom"
    >
      {{ t(unread === 1 ? "{count} new message" : "{count} new messages", { count: unread }) }} ↓
    </button>
  </section>
</template>
