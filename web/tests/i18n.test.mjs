import { test } from "node:test";
import assert from "node:assert/strict";
import { computed } from "vue";
const { locale, initializeLocale, setLocale, t, notice, systemMessage } =
  await import(process.env.LOCALCHAT_I18N_MODULE);

function environment(saved) {
  const storage = new Map(saved ? [["localchat.language", saved]] : []);
  const attributes = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.document = {
    documentElement: { setAttribute: (key, value) => attributes.set(key, value) },
  };
  return { storage, attributes };
}

test("fresh or unknown language defaults to English; explicit Chinese persists and updates document language", () => {
  const env = environment();
  env.storage.set("localchat.notification.sendSound", "false");
  initializeLocale();
  assert.equal(locale.value, "en");
  assert.equal(t("Settings"), "Settings");
  assert.equal(env.attributes.get("lang"), "en");
  setLocale("zh-CN");
  assert.equal(t("Settings"), "设置");
  assert.equal(env.storage.get("localchat.language"), "zh-CN");
  assert.equal(env.attributes.get("lang"), "zh-CN");
  initializeLocale();
  assert.equal(locale.value, "zh-CN");
  setLocale("invalid");
  assert.equal(locale.value, "zh-CN");
  assert.equal(env.storage.get("localchat.notification.sendSound"), "false");
  env.storage.set("localchat.language", "invalid");
  initializeLocale();
  assert.equal(locale.value, "en");
});

test("live translations update reactive consumers, preserve interpolation exactly and support count forms", () => {
  environment();
  initializeLocale();
  const label = computed(() => t("Receive sound"));
  assert.equal(label.value, "Receive sound");
  setLocale("zh-CN");
  assert.equal(label.value, "接收提示音");
  assert.equal(t("{count} devices", { count: 2 }), "2 台设备");
  const filename = "Settings {count} $& 中文.txt";
  assert.equal(t("Upload {name}", { name: filename }), `上传 ${filename}`);
  assert.equal(t("Unrecognized notice"), "Unrecognized notice");
  setLocale("en");
  assert.equal(label.value, "Receive sound");
  assert.equal(t("{count} device", { count: 1 }), "1 device");
});

test("only known system/error templates are translated; identities and arbitrary notice details stay intact", () => {
  environment();
  setLocale("zh-CN");
  const name = "Copy joined LocalChat";
  assert.equal(systemMessage(`${name} joined LocalChat`), `${name} 加入了 LocalChat`);
  assert.equal(systemMessage("Waiting left LocalChat"), "Waiting 离开了 LocalChat");
  assert.equal(systemMessage("opaque server event"), "opaque server event");
  assert.equal(notice("Settings.txt exceeds the 1 GB file limit."), "Settings.txt 超过 1 GB 文件大小限制。");
  assert.equal(notice("Request failed (503)."), "请求失败（503）。");
  assert.equal(notice("Cancellation failed: Request failed (503). Click Retry to delete temporary chunks."), "取消失败：请求失败（503）。 点击重试以删除临时分片。");
  assert.equal(notice("Original diagnostic: /tmp/example.txt"), "Original diagnostic: /tmp/example.txt");
});

test("blocked storage and missing browser document cannot break translations or locale switching", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("Blocked"); },
    setItem() { throw new Error("Blocked"); },
  };
  delete globalThis.document;
  initializeLocale();
  assert.equal(locale.value, "en");
  setLocale("zh-CN");
  assert.equal(t("Send"), "发送");
  initializeLocale();
  assert.equal(locale.value, "en");
});
