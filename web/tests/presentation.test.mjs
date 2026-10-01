import { test } from "node:test";
import assert from "node:assert/strict";
const { groupMessages, presentText } = await import(
  process.env.LOCALCHAT_PRESENTATION_MODULE
);
const message = (overrides = {}) => ({
  type: "text",
  clientId: "peer",
  username: "Waiting",
  ip: "192.168.1.20",
  timestamp: 1000,
  content: "Hello",
  ...overrides,
});

test("adjacent text and files share an identity heading without changing original messages", () => {
  const messages = [
    message({ id: "a" }),
    message({ id: "b", timestamp: 1100 }),
    message({
      id: "c",
      type: "file",
      timestamp: 1120,
      file: { id: "file", name: "test.txt", size: 10 },
    }),
  ];
  const groups = groupMessages(messages, new Set());
  assert.equal(groups.length, 1);
  assert.equal(groups[0].messages.length, 3);
  assert.equal(groups[0].messages[2], messages[2]);
  assert.equal(groups[0].key, "a");
});

test("sender switches, renames, IP changes, time gaps and reversed timestamps start new groups", () => {
  for (const change of [
    { clientId: "other" },
    { username: "New name" },
    { ip: "::1" },
    { timestamp: 1121 },
    { timestamp: 999 },
    { timestamp: undefined },
  ]) {
    assert.equal(
      groupMessages([message(), message(change)], new Set()).length,
      2,
    );
  }
  assert.equal(
    groupMessages([message(), message({ timestamp: 1120 })], new Set()).length,
    1,
  );
  assert.equal(
    groupMessages(
      [message({ clientId: undefined }), message({ clientId: undefined })],
      new Set(),
    ).length,
    2,
  );
});

test("system messages interrupt grouping; ownership follows connection IDs rather than display names", () => {
  const messages = [
    message(),
    message({ type: "system", content: "Joined" }),
    message(),
    message({ clientId: "self" }),
  ];
  const groups = groupMessages(messages, new Set(["self"]));
  assert.equal(groups.length, 4);
  assert.equal(groups[1].system, true);
  assert.equal(groups[0].own, false);
  assert.equal(groups[3].own, true);
});

test("ordinary multiline chat, logs and URLs remain UI text with all spacing preserved", () => {
  for (const text of [
    "第一行\n    第二行\n第三行",
    "Please import this tomorrow.\nThanks!",
    "2026-10-01 INFO connected\n2026-10-01 INFO ready",
    "https://example.com/" + "long".repeat(300),
  ]) {
    assert.deepEqual(presentText(text), { code: false, language: "", text });
  }
});

test("explicit fences, JSON and recognizable source/config snippets get code presentation", () => {
  const cases = [
    ["```python\ndef greet():\n    return 'hello'\n```", "python"],
    ['{ "port": 8787 }', "JSON"],
    ["server {\n    listen 8080;\n}", "Config"],
    ["const port = 8787;\nconsole.log(port);", "JavaScript"],
    ["def greet():\n    return 'hello'", "Python"],
    ["$ go build ./cmd/localchat", "Shell"],
  ];
  for (const [text, language] of cases) {
    const result = presentText(text);
    assert.equal(result.code, true);
    assert.equal(result.language, language);
  }
  assert.equal(
    presentText(cases[0][0]).text,
    "def greet():\n    return 'hello'",
  );
  assert.equal(presentText("{braces in ordinary text}").code, false);
});
