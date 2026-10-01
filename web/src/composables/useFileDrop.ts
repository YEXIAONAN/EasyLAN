import { onBeforeUnmount, onMounted, ref } from "vue";

export function useFileDrop(onFiles: (files: File[]) => void) {
  const dragging = ref(false);
  let depth = 0;
  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");
  function enter(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth++;
    dragging.value = true;
  }
  function over(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }
  function leave(event: DragEvent) {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) dragging.value = false;
  }
  function drop(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    dragging.value = false;
    onFiles(Array.from(event.dataTransfer?.files || []));
  }
  function reset() {
    depth = 0;
    dragging.value = false;
  }
  onMounted(() => {
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("blur", reset);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("dragenter", enter);
    window.removeEventListener("dragover", over);
    window.removeEventListener("dragleave", leave);
    window.removeEventListener("drop", drop);
    window.removeEventListener("blur", reset);
  });
  return { dragging };
}
