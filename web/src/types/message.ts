export interface FileInfo {
  id: string;
  name: string;
  size: number;
  previewType?: "text" | "image" | "pdf" | "none";
}
export interface Device {
  id: string;
  username: string;
  ip: string;
}
export interface Message {
  type: "text" | "file" | "system" | "welcome" | "presence" | "error";
  id?: string;
  clientId?: string;
  username?: string;
  ip?: string;
  content?: string;
  timestamp?: number;
  file?: FileInfo;
  devices?: Device[];
  online?: number;
}
export type ConnectionState = "connected" | "connecting" | "disconnected";
