import { test } from "node:test";
import assert from "node:assert/strict";
import { ref } from "vue";
const { useUpload, CHUNK_SIZE, MAX_CONCURRENT_UPLOADS } = await import(
  process.env.LOCALCHAT_UPLOAD_MODULE
);
const { createTextFile } = await import(process.env.LOCALCHAT_LONG_TEXT_MODULE);
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
async function until(condition) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > 12000) throw new Error("Condition timed out");
    await tick();
  }
}
function file(name, size) {
  return {
    name,
    size,
    slice: (start, end) => ({ size: Math.min(end, size) - start, start, end }),
  };
}
function fakeNetwork({ fail = () => false, delay = 15 } = {}) {
  const calls = [],
    stored = new Map();
  let current = 0,
    maximum = 0,
    sequence = 0,
    broadcasts = 0;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body });
    if (url === "/api/files") {
      const id = String(++sequence);
      stored.set(id, {
        ...JSON.parse(options.body),
        done: new Set(),
        completed: false,
      });
      return Response.json({ fileId: id });
    }
    const [, id, index] = url.match(/files\/(\d+)(?:\/chunks\/(\d+))?/) || [];
    const session = stored.get(id);
    if (options.method === "DELETE") {
      stored.delete(id);
      return new Response(null, { status: 204 });
    }
    if (url.includes("/chunks/")) {
      current++;
      maximum = Math.max(maximum, current);
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          options.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timeout);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
        if (
          fail(Number(index), calls.filter((call) => call.url === url).length)
        )
          return Response.json({ error: "Injected failure" }, { status: 503 });
        session.done.add(Number(index));
        return new Response(null, { status: 204 });
      } finally {
        current--;
      }
    }
    assert.equal(session.done.size, session.chunks);
    if (!session.completed) {
      session.completed = true;
      broadcasts++;
    }
    return Response.json({ id, name: session.name, size: session.size });
  };
  return {
    calls,
    stored,
    get maximum() {
      return maximum;
    },
    get current() {
      return current;
    },
    get broadcasts() {
      return broadcasts;
    },
  };
}
function create() {
  return useUpload(ref("Waiting"), ref("browser-1"));
}

test("queue respects a global four-chunk limit and exact 16 MB slices", async () => {
  const network = fakeNetwork(),
    upload = create();
  upload.addFiles([
    file("first.zip", CHUNK_SIZE * 5 + 77),
    file("second.zip", CHUNK_SIZE * 2),
  ]);
  await until(() =>
    upload.uploads.value.every((item) => item.status === "completed"),
  );
  assert.equal(network.maximum, MAX_CONCURRENT_UPLOADS);
  assert.equal(network.broadcasts, 2);
  const chunks = network.calls.filter((call) => call.method === "PUT");
  assert.equal(chunks.length, 8);
  assert.equal(chunks[5].body.size, 77);
  assert.equal(upload.uploads.value[0].uploadedBytes, CHUNK_SIZE * 5 + 77);
});

test("pause finishes active chunks and resume preserves completed chunks", async () => {
  const network = fakeNetwork({ delay: 40 }),
    upload = create();
  upload.addFiles([file("pause.zip", CHUNK_SIZE * 9)]);
  const item = upload.uploads.value[0];
  await until(() => network.current === 4);
  upload.pause(item);
  await until(() => network.current === 0);
  await tick();
  assert.equal(item.completedChunks, 4);
  assert.equal(network.calls.filter((call) => call.method === "PUT").length, 4);
  upload.resume(item);
  await until(() => item.status === "completed");
  assert.equal(network.calls.filter((call) => call.method === "PUT").length, 9);
});

test("one failed chunk is retried three times; manual retry keeps successful chunks", async () => {
  let broken = true;
  const network = fakeNetwork({ fail: (index) => broken && index === 1 }),
    upload = create();
  upload.addFiles([file("retry.zip", CHUNK_SIZE * 3)]);
  const item = upload.uploads.value[0];
  await until(() => item.status === "failed");
  await until(() => network.current === 0);
  assert.equal(
    network.calls.filter((call) => call.url.endsWith("/chunks/1")).length,
    4,
  );
  assert.equal(item.completedChunks, 2);
  broken = false;
  upload.resume(item);
  await until(() => item.status === "completed");
  assert.equal(
    network.calls.filter((call) => call.url.endsWith("/chunks/0")).length,
    1,
  );
  assert.equal(
    network.calls.filter((call) => call.url.endsWith("/chunks/2")).length,
    1,
  );
  assert.equal(
    network.calls.filter((call) => call.url.endsWith("/chunks/1")).length,
    5,
  );
});

test("cancel aborts in-flight requests and deletes the server session", async () => {
  const network = fakeNetwork({ delay: 100 }),
    upload = create();
  upload.addFiles([file("cancel.zip", CHUNK_SIZE * 10)]);
  const item = upload.uploads.value[0];
  await until(() => network.current === 4);
  await upload.cancel(item);
  assert.equal(item.status, "cancelled");
  assert.equal(network.current, 0);
  assert.equal(network.stored.size, 0);
  assert.equal(network.broadcasts, 0);
});

test("zero-byte files complete without chunks and oversized files are rejected", async () => {
  const network = fakeNetwork(),
    upload = create();
  upload.addFiles([file("empty.txt", 0), file("too-big.zip", 1024 ** 3 + 1)]);
  await until(() => upload.uploads.value[0].status === "completed");
  assert.equal(upload.uploads.value.length, 1);
  assert.match(upload.error.value, /1 GB/);
  assert.equal(network.calls.filter((call) => call.method === "PUT").length, 0);
});

test("pause also stops automatic retries of a failed in-flight chunk", async () => {
  let broken = true;
  const network = fakeNetwork({
    fail: (index) => broken && index === 1,
    delay: 30,
  });
  const upload = create();
  upload.addFiles([file("pause-retry.zip", CHUNK_SIZE * 3)]);
  const item = upload.uploads.value[0];
  await until(() => network.current === 3);
  upload.pause(item);
  await until(() => network.current === 0);
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.equal(item.status, "paused");
  assert.equal(
    network.calls.filter((call) => call.url.endsWith("/chunks/1")).length,
    1,
  );
  broken = false;
  upload.resume(item);
  await until(() => item.status === "completed");
  assert.equal(
    network.calls.filter((call) => call.url.endsWith("/chunks/0")).length,
    1,
  );
  assert.equal(
    network.calls.filter((call) => call.url.endsWith("/chunks/2")).length,
    1,
  );
});

test("generated long TXT uses existing chunks and becomes ready only after session creation", async () => {
  const network = fakeNetwork({ delay: 30 });
  const upload = create();
  const source = "中文😀\n".repeat(25000);
  const file = createTextFile(source);
  const [item] = upload.addFiles([file]);
  assert.equal(await upload.waitForSession(item), true);
  assert.notEqual(item.fileId, "");
  assert.equal(item.file, file);
  assert.equal(await item.file.text(), source);
  await until(() => item.status === "completed");
  const init = JSON.parse(
    network.calls.find((call) => call.method === "POST").body,
  );
  assert.equal(init.size, new TextEncoder().encode(source).byteLength);
  assert.equal(init.chunkSize, CHUNK_SIZE);
  assert.equal(network.broadcasts, 1);
});

test("failed initialization resolves false and retains generated File for Retry", async () => {
  let failInit = true;
  const network = fakeNetwork();
  const request = globalThis.fetch;
  globalThis.fetch = (url, options) =>
    url === "/api/files" && failInit
      ? Promise.resolve(
          Response.json({ error: "Init unavailable" }, { status: 503 }),
        )
      : request(url, options);
  const upload = create();
  const file = createTextFile("a".repeat(200 * 1024));
  const [item] = upload.addFiles([file]);
  assert.equal(await upload.waitForSession(item), false);
  assert.equal(item.status, "failed");
  assert.equal(item.file, file);
  failInit = false;
  upload.resume(item);
  await until(() => item.status === "completed");
  assert.equal(network.broadcasts, 1);
});

test("TXT waiting in queue can be cancelled without clearing a waiting draft", async () => {
  fakeNetwork({ delay: 30 });
  const upload = create();
  const [first, second] = upload.addFiles([
    file("first.zip", CHUNK_SIZE * 2),
    createTextFile("待发送"),
  ]);
  const ready = upload.waitForSession(second);
  await upload.cancel(second);
  assert.equal(await ready, false);
  assert.equal(second.status, "cancelled");
  await until(() => first.status === "completed");
});
