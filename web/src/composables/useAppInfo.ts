import { onBeforeUnmount, onMounted, ref } from "vue";

// The Go binary owns the version. Never fall back to a frontend version string.
export function useAppInfo() {
  const version = ref("");
  const loading = ref(true);
  const controller = new AbortController();
  onMounted(async () => {
    try {
      const response = await fetch("/api/info", { signal: controller.signal });
      if (!response.ok) throw new Error("App info unavailable");
      const info = await response.json();
      if (info.name === "LocalChat" && typeof info.version === "string")
        version.value = info.version;
    } catch {
      // A missing footer version must not interrupt chat or file transfer.
    } finally {
      loading.value = false;
    }
  });
  onBeforeUnmount(() => controller.abort());
  return { version, loading };
}
