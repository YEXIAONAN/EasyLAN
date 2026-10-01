import { ref } from "vue";
import type { FileInfo } from "../types/message";

export function useFileDownload(file: FileInfo) {
  const checking = ref(false);
  const error = ref("");
  async function download() {
    if (checking.value) return;
    checking.value = true;
    error.value = "";
    try {
      const url = `/api/files/${encodeURIComponent(file.id)}`;
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "This file expired when the server stopped."
            : "This file is unavailable. Please try again.",
        );
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Download unavailable.";
    } finally {
      checking.value = false;
    }
  }
  return { checking, error, download };
}
