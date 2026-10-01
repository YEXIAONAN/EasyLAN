import { onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { ConnectionState, Device, Message } from "../types/message";
import { HARD_LONG_TEXT_LIMIT } from "../presentation/longText";

export const MAX_MESSAGE_SIZE = HARD_LONG_TEXT_LIMIT;

export function useWebSocket(username: Ref<string>) {
  const messages = ref<Message[]>([]);
  const devices = ref<Device[]>([]);
  const state = ref<ConnectionState>("disconnected");
  const clientId = ref("");
  const ownIds = ref(new Set<string>());
  const ip = ref("");
  const error = ref("");
  let socket: WebSocket | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let disposed = false;

  function connect() {
    if (
      disposed ||
      !username.value ||
      socket?.readyState === WebSocket.OPEN ||
      socket?.readyState === WebSocket.CONNECTING
    )
      return;
    state.value = "connecting";
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const current = new WebSocket(
      `${protocol}//${location.host}/ws?username=${encodeURIComponent(username.value)}`,
    );
    socket = current;
    current.onopen = () => {
      state.value = "connected";
      attempts = 0;
      current.send(JSON.stringify({ type: "hello", username: username.value }));
    };
    current.onmessage = (event) => {
      if (socket !== current) return;
      try {
        const message = JSON.parse(event.data) as Message;
        if (message.type === "welcome" && message.clientId) {
          clientId.value = message.clientId;
          ownIds.value.add(message.clientId);
          ip.value = message.ip || "";
        } else if (message.type === "presence") {
          devices.value = message.devices || [];
        } else if (message.type === "error") {
          error.value = message.content || "Unable to send message.";
        } else if (["text", "file", "system"].includes(message.type)) {
          messages.value.push(message);
        }
      } catch {
        error.value = "The server sent an invalid message.";
      }
    };
    current.onclose = () => {
      if (socket !== current || disposed) return;
      socket = undefined;
      devices.value = [];
      state.value = "disconnected";
      const delay = Math.min(1000 * 2 ** attempts++, 15000);
      reconnectTimer = setTimeout(connect, delay);
    };
    current.onerror = () => current.close();
  }

  function sendText(content: string) {
    if (new TextEncoder().encode(content).length > MAX_MESSAGE_SIZE) {
      error.value = "Message is too large. Consider sending it as a file.";
      return false;
    }
    if (socket?.readyState !== WebSocket.OPEN) {
      error.value = "Waiting for a connection. Your message is still here.";
      return false;
    }
    if (socket.bufferedAmount > MAX_MESSAGE_SIZE * 6) {
      error.value = "Previous message is still sending. Try again in a moment.";
      return false;
    }
    socket.send(
      JSON.stringify({ type: "text", username: username.value, content }),
    );
    return true;
  }

  watch(
    username,
    (name) => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "hello", username: name }));
      else connect();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(reconnectTimer);
    socket?.close();
  });
  return { messages, devices, state, clientId, ownIds, ip, error, sendText };
}
