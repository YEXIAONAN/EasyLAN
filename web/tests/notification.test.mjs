import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, ref } from "vue";
const { useNotification } = await import(
  process.env.LOCALCHAT_NOTIFICATION_MODULE
);
const { useWebSocket } = await import(process.env.LOCALCHAT_WEBSOCKET_MODULE);

// Exercise the actual composables with controlled native browser APIs, not a
// parallel implementation. Audio scheduling is checked without requiring speakers.
function environment({
  saved,
  blocked = false,
  noAudio = false,
  noCanvas = false,
} = {}) {
  const storage = new Map(
    saved ? [["localchat.notification.sound", saved]] : [],
  );
  const attributes = new Map([
    ["href", "/favicon.svg"],
    ["type", "image/svg+xml"],
  ]);
  const icon = {
    getAttribute: (key) => attributes.get(key) ?? null,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key),
  };
  const drawing = [];
  class Doc extends EventTarget {
    title = "LocalChat";
    visibilityState = "visible";
    querySelector() {
      return icon;
    }
    createElement() {
      return {
        getContext: () =>
          noCanvas
            ? null
            : {
                drawImage: () => drawing.push("logo"),
                beginPath() {},
                arc: (...args) => drawing.push(args),
                set fillStyle(value) {
                  drawing.push(value);
                },
                fill() {},
              },
        toDataURL: () => "data:image/png;base64,unread",
      };
    }
  }
  const document = new Doc();
  let image;
  class Image {
    constructor() {
      image = this;
    }
  }
  const contexts = [],
    sounds = [];
  class AudioContext {
    state = "suspended";
    currentTime = 10;
    destination = {};
    constructor() {
      contexts.push(this);
    }
    async resume() {
      if (blocked) throw new Error("Autoplay blocked");
      this.state = "running";
    }
    async close() {
      this.state = "closed";
    }
    createOscillator() {
      const sound = {
        frequency: {},
        connect() {},
        disconnect() {},
        start(time) {
          this.startTime = time;
        },
        stop(time) {
          this.stopTime = time;
        },
      };
      sounds.push(sound);
      return sound;
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    }
  }
  Object.assign(globalThis, {
    document,
    Image,
    window: { AudioContext: noAudio ? undefined : AudioContext },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });
  return {
    document,
    storage,
    attributes,
    contexts,
    sounds,
    drawing,
    loadIcon: () => image.onload?.(),
    hide: () => {
      document.visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    },
    show: () => {
      document.visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    },
  };
}
const peer = (type = "text", clientId = "peer") => ({
  type,
  clientId,
  username: "Waiting",
  ip: "127.0.0.1",
  content: "hello",
});

test("visible chat stays silent; hidden peers update count/title/dot, burst audio is coalesced and return clears", async () => {
  const env = environment(),
    ownIds = ref(new Set(["self"])),
    n = useNotification(ownIds);
  env.loadIcon();
  await n.unlockAudio();
  n.notifyIncomingMessage(peer());
  assert.equal(n.unreadCount.value, 0);
  assert.equal(env.sounds.length, 0);
  assert.equal(env.document.title, "LocalChat");
  env.hide();
  n.notifyIncomingMessage(peer());
  assert.equal(env.document.title, "(1) LocalChat");
  assert.equal(env.attributes.get("href"), "data:image/png;base64,unread");
  assert.equal(env.sounds.length, 2); // one two-tone ding-dong, not two notifications
  assert.equal(env.sounds[0].frequency.value, 660);
  assert.equal(env.sounds[1].frequency.value, 520);
  assert.ok(env.sounds[1].stopTime - env.sounds[0].startTime < 0.35);
  n.notifyIncomingMessage(peer("file"));
  assert.equal(env.document.title, "(2) LocalChat");
  assert.equal(env.sounds.length, 2);
  env.show();
  assert.equal(n.unreadCount.value, 0);
  assert.equal(env.document.title, "LocalChat");
  assert.equal(env.attributes.get("href"), "/favicon.svg");
  assert.equal(env.attributes.get("type"), "image/svg+xml");
  assert.equal(env.sounds.length, 2);
  assert.ok(env.drawing.includes("#F04438"));
  n.dispose();
});

test("same-name peers notify, own IDs before/after reconnect and every non-chat event stay silent", () => {
  const env = environment(),
    ownIds = ref(new Set(["self", "old-self"])),
    n = useNotification(ownIds);
  env.hide();
  for (const type of ["text", "file"]) {
    n.notifyIncomingMessage(peer(type, "self"));
    n.notifyIncomingMessage(peer(type, "old-self"));
    n.notifyIncomingMessage(peer(type, ""));
  }
  // A sender without a server identity is conservatively not notified.
  n.notifyIncomingMessage({ type: "text", username: "Waiting" });
  for (const type of [
    "system",
    "welcome",
    "presence",
    "error",
    "connected",
    "disconnected",
    "reconnect",
    "progress",
    "chunk",
    "complete",
    "retry",
    "preview",
    "download",
    "hello",
    "ping",
    "pong",
  ])
    n.notifyIncomingMessage(peer(type));
  // Model all 64 successful 16 MiB chunks in a 1 GiB upload: none are messages.
  for (let chunk = 0; chunk < 64; chunk++)
    n.notifyIncomingMessage({ type: "chunk", clientId: "peer", chunk });
  assert.equal(n.unreadCount.value, 0);
  n.notifyIncomingMessage(peer("file"));
  assert.equal(n.unreadCount.value, 1);
  assert.equal(env.document.title, "(1) LocalChat");
  n.dispose();
});

test("title caps at 99+; muted sound persists while unread state resets across page lifetimes", async () => {
  const env = environment(),
    n = useNotification(ref(new Set()));
  env.loadIcon();
  await n.unlockAudio();
  n.setSoundEnabled(false);
  env.hide();
  for (let i = 0; i < 101; i++) n.notifyIncomingMessage(peer());
  assert.equal(n.unreadCount.value, 101);
  assert.equal(env.document.title, "(99+) LocalChat");
  assert.equal(env.sounds.length, 0);
  assert.deepEqual(
    [...env.storage],
    [["localchat.notification.sound", "false"]],
  );
  n.dispose();
  const refreshed = useNotification(ref(new Set()));
  assert.equal(refreshed.soundEnabled.value, false);
  assert.equal(refreshed.unreadCount.value, 0);
  assert.equal(env.document.title, "LocalChat");
  assert.equal(env.attributes.get("href"), "/favicon.svg");
  refreshed.dispose();
});

test("autoplay is unlocked only by interaction; audio absence/failure cannot block visual unread", async () => {
  for (const options of [{}, { blocked: true }, { noAudio: true }]) {
    const env = environment(options),
      n = useNotification(ref(new Set()));
    env.loadIcon();
    env.hide();
    n.notifyIncomingMessage(peer());
    assert.equal(env.contexts.length, 0);
    assert.equal(env.sounds.length, 0);
    env.document.dispatchEvent(new Event("pointerdown"));
    await n.unlockAudio();
    assert.equal(n.audioUnlocked.value, !options.blocked && !options.noAudio);
    n.notifyIncomingMessage(peer());
    assert.equal(env.document.title, "(2) LocalChat");
    assert.equal(env.attributes.get("href"), "data:image/png;base64,unread");
    n.dispose();
    assert.ok(env.contexts.every((context) => context.state === "closed"));
    env.document.dispatchEvent(new Event("pointerdown"));
    env.hide();
    n.notifyIncomingMessage(peer());
    assert.equal(env.document.title, "LocalChat");
  }
});

test("late favicon loading cannot revive cleared badges; blocked canvas/storage preserve title and chat", () => {
  const env = environment(),
    n = useNotification(ref(new Set()));
  env.hide();
  n.notifyIncomingMessage(peer());
  env.show();
  env.loadIcon();
  assert.equal(env.attributes.get("href"), "/favicon.svg");
  n.dispose();
  const failed = environment({ noCanvas: true });
  globalThis.localStorage = {
    getItem() {
      throw new Error("Blocked");
    },
    setItem() {
      throw new Error("Blocked");
    },
  };
  const fallback = useNotification(ref(new Set()));
  failed.loadIcon();
  fallback.setSoundEnabled(false);
  failed.hide();
  fallback.notifyIncomingMessage(peer());
  assert.equal(failed.document.title, "(1) LocalChat");
  assert.equal(failed.attributes.get("href"), "/favicon.svg");
  fallback.dispose();
});

test("actual WebSocket handler displays messages first, ignores presence/system and retains ownership on reconnect", async () => {
  const env = environment({ saved: "false" });
  globalThis.location = { host: "localhost:8788", protocol: "http:" };
  const sockets = [];
  globalThis.WebSocket = class {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 0;
    constructor() {
      sockets.push(this);
    }
    send() {}
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  };
  let client;
  const renderer = createRenderer({
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode() {},
    nextSibling() {},
  });
  const app = renderer.createApp({
    setup() {
      client = useWebSocket(ref("Waiting"));
      return () => null;
    },
  });
  app.mount({});
  const socket = sockets[0];
  const receive = (message) =>
    socket.onmessage({ data: JSON.stringify(message) });
  receive({ type: "welcome", clientId: "self" });
  env.loadIcon();
  env.hide();
  receive(peer("text", "self"));
  receive(peer("file", "self"));
  receive(peer("system"));
  receive({ type: "presence", devices: [] });
  assert.equal(env.document.title, "LocalChat");
  receive(peer());
  receive(peer("file"));
  assert.equal(client.messages.value.length, 5);
  assert.equal(env.document.title, "(2) LocalChat");
  // The server-issued new connection ID is added alongside the earlier one.
  receive({ type: "welcome", clientId: "new-self" });
  receive(peer("file", "self"));
  receive(peer("text", "new-self"));
  assert.equal(env.document.title, "(2) LocalChat");
  assert.equal(client.error.value, "");
  app.unmount();
  env.hide();
  env.document.dispatchEvent(new Event("keydown"));
  assert.equal(env.document.title, "LocalChat");
  assert.equal(env.attributes.get("href"), "/favicon.svg");
});
