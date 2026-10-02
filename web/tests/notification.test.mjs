import { test } from "node:test";
import assert from "node:assert/strict";
import { ref } from "../js/state.js";
const { useNotification, SOUND_PRESETS } = await import(
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
    title = "EasyLAN";
    visibilityState = "visible";
    focused = true;
    hasFocus() {
      return this.focused;
    }
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
    window: Object.assign(new EventTarget(), {
      AudioContext: noAudio ? undefined : AudioContext,
    }),
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
    blur: () => {
      document.focused = false;
      window.dispatchEvent(new Event("blur"));
    },
    focus: () => {
      document.focused = true;
      window.dispatchEvent(new Event("focus"));
    },
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
const settle = () => new Promise((resolve) => setImmediate(resolve));
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
  assert.equal(env.document.title, "EasyLAN");
  env.hide();
  n.notifyIncomingMessage(peer());
  assert.equal(env.document.title, "(1) EasyLAN");
  assert.equal(env.attributes.get("href"), "data:image/png;base64,unread");
  assert.equal(env.sounds.length, 2); // one two-tone ding-dong, not two notifications
  assert.equal(env.sounds[0].frequency.value, 660);
  assert.equal(env.sounds[1].frequency.value, 520);
  assert.ok(env.sounds[1].stopTime - env.sounds[0].startTime < 0.35);
  n.notifyIncomingMessage(peer("file"));
  assert.equal(env.document.title, "(2) EasyLAN");
  assert.equal(env.sounds.length, 2);
  env.show();
  assert.equal(n.unreadCount.value, 0);
  assert.equal(env.document.title, "EasyLAN");
  assert.equal(env.attributes.get("href"), "/favicon.svg");
  assert.equal(env.attributes.get("type"), "image/svg+xml");
  assert.equal(env.sounds.length, 2);
  assert.ok(env.drawing.includes("#F04438"));
  n.dispose();
});

test("same-name peers notify; own IDs never add unread, and non-chat events stay silent", () => {
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
  assert.equal(env.document.title, "(1) EasyLAN");
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
  assert.equal(env.document.title, "(99+) EasyLAN");
  assert.equal(env.sounds.length, 0);
  assert.deepEqual(
    [...env.storage],
    [["localchat.notification.sound", "false"]],
  );
  n.dispose();
  const refreshed = useNotification(ref(new Set()));
  assert.equal(refreshed.soundEnabled.value, false);
  assert.equal(refreshed.unreadCount.value, 0);
  assert.equal(env.document.title, "EasyLAN");
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
    assert.equal(env.document.title, "(2) EasyLAN");
    assert.equal(env.attributes.get("href"), "data:image/png;base64,unread");
    n.dispose();
    assert.ok(env.contexts.every((context) => context.state === "closed"));
    env.document.dispatchEvent(new Event("pointerdown"));
    env.hide();
    n.notifyIncomingMessage(peer());
    assert.equal(env.document.title, "EasyLAN");
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
  assert.equal(failed.document.title, "(1) EasyLAN");
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
  const client = useWebSocket(ref("Waiting"));
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
  assert.equal(env.document.title, "EasyLAN");
  receive(peer());
  receive(peer("file"));
  assert.equal(client.messages.value.length, 5);
  assert.equal(env.document.title, "(2) EasyLAN");
  // The server-issued new connection ID is added alongside the earlier one.
  receive({ type: "welcome", clientId: "new-self" });
  receive(peer("file", "self"));
  receive(peer("text", "new-self"));
  assert.equal(env.document.title, "(2) EasyLAN");
  assert.equal(client.error.value, "");
  client.dispose();
  env.hide();
  env.document.dispatchEvent(new Event("keydown"));
  assert.equal(env.document.title, "EasyLAN");
  assert.equal(env.attributes.get("href"), "/favicon.svg");
});

test("a visible but unfocused desktop window notifies; focus clears and hidden focus cannot clear", async () => {
  const env = environment(),
    n = useNotification(ref(new Set(["self"])));
  env.loadIcon();
  await n.unlockAudio();
  env.blur();
  assert.equal(env.document.visibilityState, "visible");
  n.notifyIncomingMessage(peer());
  assert.equal(env.document.title, "(1) EasyLAN");
  assert.equal(env.sounds.length, 2);
  assert.ok(env.sounds[0].startTime > env.contexts[0].currentTime);
  env.hide();
  env.focus();
  assert.equal(n.unreadCount.value, 1);
  env.show();
  assert.equal(n.unreadCount.value, 0);
  n.notifyIncomingMessage(peer());
  assert.equal(env.sounds.length, 2);
  n.dispose();
  env.blur();
  env.focus();
  assert.equal(env.document.title, "EasyLAN");
});

test("enabling sound plays one foreground preview; rapid disabling cancels pending preview", async () => {
  const env = environment({ saved: "false" }),
    n = useNotification(ref(new Set()));
  n.setSoundEnabled(true);
  await n.unlockAudio();
  assert.equal(env.sounds.length, 2);
  assert.equal(env.document.title, "EasyLAN");
  assert.equal(n.unreadCount.value, 0);
  n.dispose();
  const delayed = environment({ saved: "false" }),
    cancelled = useNotification(ref(new Set()));
  cancelled.setSoundEnabled(true);
  cancelled.setSoundEnabled(false);
  await cancelled.unlockAudio();
  await Promise.resolve();
  assert.equal(delayed.sounds.length, 0);
  cancelled.dispose();
});

test("a previously unlocked suspended context resumes once; return/mute cancels a delayed beep", async () => {
  for (const cancel of [null, "return", "mute"]) {
    const env = environment(),
      n = useNotification(ref(new Set()));
    await n.unlockAudio();
    env.blur();
    const context = env.contexts[0];
    context.state = "suspended";
    let resumed,
      attempts = 0;
    context.resume = () => {
      attempts++;
      return new Promise((resolve) => {
        resumed = () => {
          context.state = "running";
          resolve();
        };
      });
    };
    n.notifyIncomingMessage(peer());
    n.notifyIncomingMessage(peer("file"));
    assert.equal(attempts, 1);
    assert.equal(n.unreadCount.value, 2);
    if (cancel === "return") env.focus();
    if (cancel === "mute") n.setSoundEnabled(false);
    resumed();
    await settle();
    assert.equal(env.sounds.length, cancel ? 0 : 2);
    n.dispose();
  }
});


test("send sound defaults on independently; valid tones persist and unknown stored tones fall back", async () => {
  const env = environment({ saved: "false" });
  env.storage.set("localchat.notification.receiveTone", "unknown");
  env.storage.set("localchat.notification.sendTone", "wood");
  const n = useNotification(ref(new Set(["self"])));
  assert.equal(n.soundEnabled.value, false);
  assert.equal(n.sentSoundEnabled.value, true);
  assert.equal(n.receivedTone.value, "chime");
  assert.equal(n.sentTone.value, "wood");
  n.setTone("receive", "bell"); // muted selection persists without preview
  n.setTone("send", "invalid");
  assert.equal(n.sentTone.value, "wood");
  n.setSentSoundEnabled(false);
  assert.equal(env.storage.get("localchat.notification.sound"), "false");
  assert.equal(env.storage.get("localchat.notification.sendSound"), "false");
  assert.equal(env.sounds.length, 0);
  n.dispose();
  const restored = useNotification(ref(new Set()));
  assert.equal(restored.receivedTone.value, "bell");
  assert.equal(restored.sentTone.value, "wood");
  assert.equal(restored.sentSoundEnabled.value, false);
  restored.dispose();
});

test("five local presets preview distinct send/receive patterns, never changing title or unread", async () => {
  const env = environment(), n = useNotification(ref(new Set()));
  assert.equal(SOUND_PRESETS.length, 5);
  const patterns = new Set();
  for (const preset of SOUND_PRESETS) {
    for (const kind of ["receive", "send"]) {
      const before = env.sounds.length;
      n.setTone(kind, preset.id);
      await settle();
      const pair = env.sounds.slice(before);
      assert.equal(pair.length, 2);
      const frequencies = pair.map((tone) => tone.frequency.value);
      if (kind === "receive") assert.ok(frequencies[0] > frequencies[1]);
      else assert.ok(frequencies[0] < frequencies[1]);
      patterns.add(`${pair[0].type}:${frequencies.join(",")}`);
      assert.ok(pair[1].stopTime - pair[0].startTime < 0.35);
      assert.equal(env.document.title, "EasyLAN");
      assert.equal(n.unreadCount.value, 0);
    }
  }
  assert.equal(patterns.size, 10);
  n.dispose();
});

test("confirmed own text/files use send sound in foreground/background and retain no unread", async () => {
  for (const type of ["text", "file"]) {
    for (const background of [false, true]) {
      const env = environment(), n = useNotification(ref(new Set(["self", "old-self"])));
      await n.unlockAudio();
      if (background) env.hide();
      n.notifyIncomingMessage(peer(type, type === "file" ? "old-self" : "self"));
      assert.equal(env.sounds.length, 2);
      assert.ok(env.sounds[0].frequency.value < env.sounds[1].frequency.value);
      assert.equal(env.document.title, "EasyLAN");
      assert.equal(n.unreadCount.value, 0);
      assert.equal(env.attributes.get("href"), "/favicon.svg");
      n.notifyIncomingMessage(peer(type, "self"));
      assert.equal(env.sounds.length, 2); // send bursts also coalesce
      n.dispose();
    }
  }
});

test("send and receive channels have independent mute/cooldown; disabling send preserves unread alerts", async () => {
  const env = environment(), n = useNotification(ref(new Set(["self"])));
  await n.unlockAudio();
  n.notifyIncomingMessage(peer("text", "self"));
  assert.equal(env.sounds.length, 2);
  n.setSoundEnabled(false);
  assert.notEqual(env.sounds[0].stopTime, undefined); // receive mute does not stop send
  env.hide();
  n.notifyIncomingMessage(peer());
  assert.equal(env.document.title, "(1) EasyLAN");
  assert.equal(env.sounds.length, 2);
  n.setSentSoundEnabled(false);
  assert.equal(env.sounds[0].stopTime, undefined); // send mute stops its active nodes
  n.notifyIncomingMessage(peer("file", "self"));
  assert.equal(env.sounds.length, 2);
  n.setSoundEnabled(true);
  await settle();
  assert.equal(env.sounds.length, 4);
  n.notifyIncomingMessage(peer("file", "self"));
  assert.equal(env.sounds.length, 4);
  assert.equal(env.document.title, "(1) EasyLAN");
  n.dispose();

  const both = environment(), independent = useNotification(ref(new Set(["self"])));
  await independent.unlockAudio();
  both.hide();
  independent.notifyIncomingMessage(peer("text", "self"));
  independent.notifyIncomingMessage(peer());
  assert.equal(both.sounds.length, 4); // one channel cannot suppress the other
  both.show();
  assert.notEqual(both.sounds[0].stopTime, undefined);
  assert.equal(both.sounds[2].stopTime, undefined); // only receive stopped on return
  independent.dispose();
});

test("pending send audio survives return but is cancelled by mute/disposal; preview uses newest tone", async () => {
  for (const cancel of ["return", "mute", "dispose"]) {
    const env = environment(), n = useNotification(ref(new Set(["self"])));
    await n.unlockAudio();
    env.hide();
    const context = env.contexts[0];
    context.state = "suspended";
    let resume;
    context.resume = () => new Promise((resolve) => {
      resume = () => { context.state = "running"; resolve(); };
    });
    n.notifyIncomingMessage(peer("file", "self"));
    if (cancel === "return") env.show();
    if (cancel === "mute") n.setSentSoundEnabled(false);
    if (cancel === "dispose") n.dispose();
    resume();
    await settle();
    assert.equal(env.sounds.length, cancel === "return" ? 2 : 0);
    assert.equal(env.document.title, "EasyLAN");
    n.dispose();
  }
  const env = environment(), n = useNotification(ref(new Set()));
  n.setTone("send", "chime");
  n.setTone("send", "wood");
  await settle();
  assert.equal(env.sounds.length, 2);
  assert.equal(env.sounds[0].frequency.value, 280);
  n.dispose();
});

test("missing or blocked audio never breaks own message receipt or preferences", async () => {
  for (const options of [{ blocked: true }, { noAudio: true }]) {
    const env = environment(options), n = useNotification(ref(new Set(["self"])));
    n.previewSound("send");
    await settle();
    n.notifyIncomingMessage(peer("text", "self"));
    n.notifyIncomingMessage(peer("file", "self"));
    assert.equal(env.sounds.length, 0);
    assert.equal(env.document.title, "EasyLAN");
    n.dispose();
  }
});


test("WebSocket sending waits for server acknowledgement: failures/chunks are silent, own confirmed text/file sounds once", async () => {
  const env = environment();
  globalThis.location = { host: "localhost:8792", protocol: "http:" };
  const sockets = [];
  globalThis.WebSocket = class {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 0;
    bufferedAmount = 0;
    sent = [];
    constructor() { sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.onclose?.(); }
  };
  let client = useWebSocket(ref("Sound-test"));
  const socket = sockets[0];
  const receive = (message) => socket.onmessage({ data: JSON.stringify(message) });
  env.document.dispatchEvent(new Event("pointerdown"));
  await settle();
  assert.equal(client.sendText("disconnected"), false);
  socket.readyState = 1;
  socket.onopen();
  receive({ type: "welcome", clientId: "self" });
  assert.equal(client.sendText("x".repeat(128 * 1024 + 1)), false);
  socket.bufferedAmount = 128 * 1024 * 6 + 1;
  assert.equal(client.sendText("busy"), false);
  socket.bufferedAmount = 0;
  assert.equal(client.sendText("hello"), true);
  assert.equal(env.sounds.length, 0); // send() alone is not success
  assert.equal(socket.sent.at(-1).content, "hello");
  receive(peer("text", "self"));
  assert.equal(client.messages.value.length, 1);
  assert.equal(env.sounds.length, 2);
  assert.equal(env.document.title, "EasyLAN");
  client.setSentSoundEnabled(false);
  for (let i = 0; i < 64; i++) receive({ type: "chunk", clientId: "self" });
  receive({ type: "error", content: "Upload failed" });
  receive(peer("system", "self"));
  assert.equal(env.sounds.length, 2);
  client.setSentSoundEnabled(true);
  await settle();
  assert.equal(env.sounds.length, 4); // enabling preview
  // A fresh composable resets the cooldown; retained ownership covers old file connections.
  client.dispose();
  const fileEnv = environment();
  client = useWebSocket(ref("Sound-test"));
  const fileSocket = sockets.at(-1);
  const receiveFile = (message) => fileSocket.onmessage({ data: JSON.stringify(message) });
  receiveFile({ type: "welcome", clientId: "old-self" });
  receiveFile({ type: "welcome", clientId: "new-self" });
  fileEnv.document.dispatchEvent(new Event("keydown"));
  await settle();
  for (let i = 0; i < 64; i++) receiveFile({ type: "chunk", clientId: "old-self" });
  assert.equal(fileEnv.sounds.length, 0);
  receiveFile(peer("file", "old-self"));
  assert.equal(client.messages.value.length, 1);
  assert.equal(fileEnv.sounds.length, 2);
  assert.equal(fileEnv.document.title, "EasyLAN");
  client.dispose();
});
