import type { InjectionKey } from "vue";
import type { FileInfo } from "../types/message";

// Support is decided by the backend's extension/signature allowlist.
export function canPreview(file: FileInfo): boolean {
  return (
    file.previewType === "text" ||
    file.previewType === "image" ||
    file.previewType === "pdf"
  );
}
export const previewFileKey: InjectionKey<(file: FileInfo) => void> =
  Symbol("previewFile");
