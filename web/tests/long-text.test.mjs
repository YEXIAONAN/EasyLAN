import { test } from "node:test";
import assert from "node:assert/strict";
const {
  textSendMode,
  createTextFile,
  SOFT_LONG_TEXT_LIMIT,
  HARD_LONG_TEXT_LIMIT,
} = await import(process.env.LOCALCHAT_LONG_TEXT_MODULE);
const { canPreview } = await import(process.env.LOCALCHAT_PREVIEW_MODULE);

test("UTF-8 thresholds preserve short code and exact 64/128 KiB boundaries", () => {
  assert.equal(textSendMode("a".repeat(10 * 1024)), "message");
  assert.equal(textSendMode("a".repeat(SOFT_LONG_TEXT_LIMIT)), "message");
  assert.equal(textSendMode("a".repeat(SOFT_LONG_TEXT_LIMIT + 1)), "choice");
  assert.equal(textSendMode("a".repeat(80 * 1024)), "choice");
  assert.equal(textSendMode("a".repeat(HARD_LONG_TEXT_LIMIT)), "choice");
  assert.equal(textSendMode("a".repeat(HARD_LONG_TEXT_LIMIT + 1)), "txt");
  assert.equal(textSendMode("a".repeat(200 * 1024)), "txt");
  assert.equal(textSendMode("中".repeat(22000)), "choice"); // 22k characters, 66k bytes.
  assert.equal(textSendMode("😀".repeat(33000)), "txt"); // UTF-16 length is only 66k.
  assert.equal(textSendMode('```json\n{"ok":true}\n```'), "message");
});

test("generated TXT retains all UTF-8 bytes and uses a readable local timestamp", async () => {
  const text =
    "  中文😀\r\n\t<script>literal</script>\n" + "日志\n".repeat(40000);
  const file = createTextFile(text, new Date(2026, 9, 1, 23, 31, 5));
  assert.equal(file.name, "message-20261001-233105.txt");
  assert.equal(file.type, "text/plain;charset=utf-8");
  assert.equal(file.size, new TextEncoder().encode(text).byteLength);
  assert.equal(await file.text(), text);
  assert.deepEqual(
    new Uint8Array(await file.arrayBuffer()),
    new TextEncoder().encode(text),
  );
});

test("preview support comes only from server metadata, never from filename", () => {
  for (const previewType of ["text", "image", "pdf"])
    assert.equal(canPreview({ previewType }), true);
  for (const file of [
    { name: "hello.txt" },
    { name: "manual.pdf", previewType: "none" },
    { name: "fake.png", previewType: "none" },
    { previewType: "html" },
    { previewType: "svg" },
  ])
    assert.equal(canPreview(file), false);
});
