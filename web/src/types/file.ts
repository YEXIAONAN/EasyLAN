export type UploadStatus =
  | "queued"
  | "uploading"
  | "paused"
  | "completing"
  | "completed"
  | "failed"
  | "cancelling"
  | "cancelled";
export interface Upload {
  key: string;
  file: File;
  fileId: string;
  totalChunks: number;
  completedChunks: number;
  uploadedBytes: number;
  speed: number;
  status: UploadStatus;
  error: string;
}
