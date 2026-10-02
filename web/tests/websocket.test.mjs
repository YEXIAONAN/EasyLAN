import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useWebSocket } from '../js/websocket.js';
import { ref } from '../js/state.js';
function environment() {
  const sockets = [], title = new EventTarget();
  title.visibilityState = 'visible'; title.hasFocus = () => true; title.querySelector = () => null;
  Object.assign(globalThis, { document: title, window: new EventTarget(), location: { protocol: 'http:', host: 'localhost' }, localStorage: { getItem: () => null } });
  globalThis.WebSocket = class {
    static OPEN = 1; static CONNECTING = 0; readyState = 0; bufferedAmount = 0; sent = [];
    constructor(url) { this.url = url; sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.onclose?.(); }
  };
  return sockets;
}
test('rename updates the live connection without reconnecting, and explicit cleanup removes the identity subscription', () => {
  const sockets = environment(), username = ref('Waiting'); const client = useWebSocket(username);
  const ws = sockets[0]; ws.readyState = 1; ws.onopen(); username.value = 'New name';
  assert.equal(sockets.length, 1); assert.deepEqual(ws.sent.at(-1), { type: 'hello', username: 'New name' });
  client.dispose(); username.value = 'After close'; assert.equal(sockets.length, 1);
});
test('messages are delivered incrementally in original order and invalid JSON cannot break the next broadcast', () => {
  const sockets = environment(), received = []; const client = useWebSocket(ref('Waiting'), { messageReceived: m => received.push(m) });
  const ws = sockets[0]; ws.onmessage({ data: '{bad' });
  assert.match(client.error.value, /invalid/);
  ws.onmessage({ data: JSON.stringify({ type: 'text', id: 'a', clientId: 'peer', content: '<script>literal</script>' }) });
  ws.onmessage({ data: JSON.stringify({ type: 'file', id: 'b', clientId: 'peer', file: { id: 'file', previewType: 'image' } }) });
  assert.deepEqual(received.map(m => m.id), ['a', 'b']); assert.equal(received[0].content, '<script>literal</script>'); client.dispose();
});
