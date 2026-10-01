import { getCurrentInstance, onBeforeUnmount, ref, type Ref } from "vue";
import type { Upload } from "../types/file";

export const CHUNK_SIZE = 16 * 1024 * 1024;
export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const MAX_CONCURRENT_UPLOADS = 4;
const MAX_RETRIES = 3;

class UploadStopped extends Error {}

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
interface Runtime {
  sessionReady: Promise<boolean>;
  resolveSession: (ready: boolean) => void;
  done: Set<number>;
  pending: Set<number>;
  controllers: Set<AbortController>;
  finished?: Promise<void>;
  cancelRequested: boolean;
  sessionLost: boolean;
  elapsed: number;
}

export function useUpload(username: Ref<string>, clientId: Ref<string>) {
  const uploads = ref<Upload[]>([]);
  const error = ref("");
  const runtimes = new Map<string, Runtime>();
  let sequence = 0;
  let active = false;
  let disposed = false;

  async function request(
    upload: Upload,
    url: string,
    options: RequestInit,
    abortable = true,
  ) {
    const runtime = runtimes.get(upload.key)!;
    const controller = new AbortController();
    if (abortable) runtime.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 404 || response.status === 410)
          runtime.sessionLost = true;
        throw new RequestError(
          body.error || `Request failed (${response.status}).`,
          response.status,
        );
      }
      // Consume responses here so timeouts also cover reading the response body.
      return response.status === 204 ? undefined : await response.json();
    } finally {
      clearTimeout(timer);
      runtime.controllers.delete(controller);
    }
  }

  function addFiles(files: File[]) {
    const accepted: Upload[] = [];
    if (!username.value || disposed) {
      error.value = "Choose your name before sending a file.";
      return accepted;
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        error.value = `${file.name} exceeds the 1 GB file limit.`;
        continue;
      }
      const key = String(++sequence);
      uploads.value.push({
        key,
        file,
        fileId: "",
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        completedChunks: 0,
        uploadedBytes: 0,
        speed: 0,
        status: "queued",
        error: "",
      });
      accepted.push(uploads.value[uploads.value.length - 1]);
      let resolveSession!: (ready: boolean) => void;
      const sessionReady = new Promise<boolean>((resolve) => {
        resolveSession = resolve;
      });
      runtimes.set(key, {
        sessionReady,
        resolveSession,
        done: new Set(),
        pending: new Set(),
        controllers: new Set(),
        cancelRequested: false,
        sessionLost: false,
        elapsed: 0,
      });
    }
    pump();
    return accepted;
  }

  // Long text keeps the draft until the existing upload flow has a server
  // session. Rejected initialization leaves both the draft and retryable File.
  function waitForSession(upload: Upload): Promise<boolean> {
    return runtimes.get(upload.key)?.sessionReady || Promise.resolve(false);
  }

  function pump() {
    if (active || disposed) return;
    const upload = uploads.value.find((item) => item.status === "queued");
    if (!upload) return;
    active = true;
    const runtime = runtimes.get(upload.key)!;
    runtime.finished = run(upload).finally(() => {
      active = false;
      pump();
    });
  }

  async function retryRequest(
    upload: Upload,
    url: string,
    options: RequestInit,
  ) {
    let last: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (["paused", "queued", "failed"].includes(upload.status))
        throw new UploadStopped();
      if (disposed || runtimes.get(upload.key)!.cancelRequested)
        throw new Error("Upload cancelled.");
      try {
        return await request(upload, url, options);
      } catch (err) {
        last = err;
        // A lost session or invalid payload cannot be repaired by resending a chunk.
        if (
          err instanceof RequestError &&
          [400, 404, 410, 413, 415].includes(err.status)
        )
          throw err;
        if (attempt < MAX_RETRIES)
          await new Promise((resolve) =>
            setTimeout(resolve, 500 * 2 ** attempt),
          );
      }
    }
    throw last;
  }

  async function run(upload: Upload) {
    const runtime = runtimes.get(upload.key)!;
    let started = 0;
    try {
      upload.status = "uploading";
      upload.error = "";
      if (!upload.fileId) {
        // Keep init alive on cancellation so we can receive its ID and delete it.
        const result = await request(
          upload,
          "/api/files",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: upload.file.name,
              size: upload.file.size,
              chunkSize: CHUNK_SIZE,
              chunks: upload.totalChunks,
              username: username.value,
              clientId: clientId.value,
            }),
          },
          false,
        );
        if (typeof result?.fileId !== "string" || !result.fileId)
          throw new Error(
            "Could not create upload session. Retry to send this file.",
          );
        upload.fileId = result.fileId;
        runtime.resolveSession(!runtime.cancelRequested && !disposed);
      }
      started = performance.now();
      async function worker() {
        while (
          upload.status === "uploading" &&
          !runtime.cancelRequested &&
          !disposed
        ) {
          let index = 0;
          while (
            index < upload.totalChunks &&
            (runtime.done.has(index) || runtime.pending.has(index))
          )
            index++;
          if (index === upload.totalChunks) return;
          runtime.pending.add(index);
          const chunk = upload.file.slice(
            index * CHUNK_SIZE,
            Math.min((index + 1) * CHUNK_SIZE, upload.file.size),
          );
          try {
            await retryRequest(
              upload,
              `/api/files/${upload.fileId}/chunks/${index}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/octet-stream" },
                body: chunk,
              },
            );
            if (!runtime.cancelRequested) {
              runtime.done.add(index);
              upload.completedChunks = runtime.done.size;
              upload.uploadedBytes += chunk.size;
              upload.speed =
                upload.uploadedBytes /
                Math.max(
                  (runtime.elapsed + performance.now() - started) / 1000,
                  0.001,
                );
            }
          } catch (err) {
            if (
              !runtime.cancelRequested &&
              !(err instanceof UploadStopped) &&
              upload.status === "uploading"
            ) {
              upload.status = "failed";
              upload.error = describe(err);
            }
            throw err;
          } finally {
            runtime.pending.delete(index);
          }
        }
      }
      await Promise.allSettled(
        Array.from({ length: MAX_CONCURRENT_UPLOADS }, () => worker()),
      );
      if (runtime.cancelRequested || disposed || upload.status !== "uploading")
        return;
      if (runtime.done.size !== upload.totalChunks) return;
      upload.status = "completing";
      await retryRequest(upload, `/api/files/${upload.fileId}/complete`, {
        method: "POST",
      });
      upload.status = "completed";
    } catch (err) {
      if (!upload.fileId) runtime.resolveSession(false);
      if (!runtime.cancelRequested) {
        upload.status = "failed";
        upload.error = describe(err);
      }
    } finally {
      if (started) runtime.elapsed += performance.now() - started;
      upload.speed = 0;
    }
  }

  function pause(upload: Upload) {
    if (upload.status === "uploading" || upload.status === "queued")
      upload.status = "paused";
  }
  function resume(upload: Upload) {
    if (!["paused", "failed"].includes(upload.status)) return;
    const runtime = runtimes.get(upload.key)!;
    if (runtime.cancelRequested) {
      void cancel(upload);
      return;
    }
    if (runtime.sessionLost) {
      runtime.done.clear();
      runtime.elapsed = 0;
      runtime.sessionLost = false;
      upload.fileId = "";
      upload.uploadedBytes = 0;
      upload.completedChunks = 0;
    }
    upload.status = "queued";
    upload.error = "";
    pump();
  }
  async function cancel(upload: Upload) {
    if (
      ["completed", "completing", "cancelled", "cancelling"].includes(
        upload.status,
      )
    )
      return;
    const runtime = runtimes.get(upload.key)!;
    runtime.cancelRequested = true;
    runtime.resolveSession(false);
    upload.status = "cancelling";
    upload.error = "";
    runtime.controllers.forEach((controller) => controller.abort());
    await runtime.finished;
    try {
      if (upload.fileId)
        await request(
          upload,
          `/api/files/${upload.fileId}`,
          { method: "DELETE" },
          false,
        );
      upload.status = "cancelled";
    } catch (err) {
      upload.status = "failed";
      upload.error = `Cancellation failed: ${describe(err)} Click Retry to delete temporary chunks.`;
    }
  }
  function dismiss(upload: Upload) {
    if (!["completed", "cancelled"].includes(upload.status)) return;
    uploads.value = uploads.value.filter((item) => item.key !== upload.key);
    runtimes.delete(upload.key);
  }
  if (getCurrentInstance())
    onBeforeUnmount(() => {
      disposed = true;
      runtimes.forEach((runtime) => {
        runtime.resolveSession(false);
        runtime.cancelRequested = true;
        runtime.controllers.forEach((controller) => controller.abort());
      });
    });
  return {
    uploads,
    error,
    addFiles,
    waitForSession,
    pause,
    resume,
    cancel,
    dismiss,
  };
}

function describe(error: unknown) {
  if (error instanceof Error && error.name === "AbortError")
    return "The request timed out. Retry to continue from completed chunks.";
  return error instanceof Error
    ? error.message
    : "Upload failed. Retry to continue.";
}
