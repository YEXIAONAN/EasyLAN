import { ref } from './state.js';
import { useNotification } from './notifications.js';
import { HARD_LONG_TEXT_LIMIT } from './longText.js';

export const MAX_MESSAGE_SIZE = HARD_LONG_TEXT_LIMIT;
export function useWebSocket(username, { changed = () => {}, messageReceived = () => {} } = {}) {
  const messages = ref([]), devices = ref([]), state = ref('disconnected');
  const clientId = ref(''), ownIds = ref(new Set()), ip = ref(''), error = ref('');
  const notification = useNotification(ownIds);
  let socket, timer, attempts = 0, disposed = false;
  function connect() {
    if (disposed || !username.value || [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket?.readyState)) return;
    state.value = 'connecting'; changed();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const current = new WebSocket(`${protocol}//${location.host}/ws?username=${encodeURIComponent(username.value)}`);
    socket = current;
    current.onopen = () => {
      if (socket !== current || disposed) return;
      state.value = 'connected'; attempts = 0;
      current.send(JSON.stringify({ type: 'hello', username: username.value }));
      changed();
    };
    current.onmessage = (event) => {
      if (socket !== current || disposed) return;
      let message;
      try { message = JSON.parse(event.data); }
      catch { error.value = 'The server sent an invalid message.'; changed(); return; }
      if (message.type === 'welcome' && message.clientId) {
        clientId.value = message.clientId; ownIds.value.add(message.clientId); ip.value = message.ip || '';
      } else if (message.type === 'presence') {
        devices.value = message.devices || [];
      } else if (message.type === 'error') {
        error.value = message.content || 'Unable to send message.';
      } else if (['text', 'file', 'system'].includes(message.type)) {
        messages.value.push(message);
        messageReceived(message);
        notification.notifyIncomingMessage(message);
      }
      changed();
    };
    current.onclose = () => {
      if (socket !== current || disposed) return;
      socket = undefined; devices.value = []; state.value = 'disconnected'; changed();
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 15000));
    };
    current.onerror = () => current.close();
  }
  function sendText(content) {
    if (new TextEncoder().encode(content).length > MAX_MESSAGE_SIZE) error.value = 'Message is too large. Consider sending it as a file.';
    else if (socket?.readyState !== WebSocket.OPEN) error.value = 'Waiting for a connection. Your message is still here.';
    else if (socket.bufferedAmount > MAX_MESSAGE_SIZE * 6) error.value = 'Previous message is still sending. Try again in a moment.';
    else {
      socket.send(JSON.stringify({ type: 'text', username: username.value, content }));
      return true;
    }
    changed(); return false;
  }
  const unsubscribe = username.subscribe(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'hello', username: username.value }));
    else { clearTimeout(timer); connect(); }
  });
  connect();
  function dispose() {
    disposed = true; clearTimeout(timer); unsubscribe(); socket?.close(); notification.dispose();
  }
  return { messages, devices, state, clientId, ownIds, ip, error, sendText, ...notification, dispose };
}
