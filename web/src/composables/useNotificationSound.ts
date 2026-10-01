import { computed, ref } from "vue";

/** 系统默认提示音的标识。 */
export const DEFAULT_SOUND_ID = "default";
/** 开关状态在 localStorage 中的键。 */
export const SOUND_ENABLED_KEY = "localchat.sound.enabled";
/** 所选音效标识在 localStorage 中的键。 */
export const SOUND_SELECTION_KEY = "localchat.sound.selection";
/** 用户上传音频的大小上限（2 MiB）。 */
export const MAX_SOUND_BYTES = 2 * 1024 * 1024;

/**
 * 发送提示音：800 Hz 正弦，约 0.34 s，淡入淡出各 0.05 s，轻微下滑，听感 "hui~"。
 * 音色为纯净正弦，柔和。
 */
export const SEND_TONE = {
  frequency: 800,
  glideTo: 760,
  duration: 0.34,
  fade: 0.05,
  peak: 0.18,
  glideTime: 0.2,
};

/**
 * 接收提示音：1200 Hz 正弦，约 0.26 s，淡入淡出各 0.05 s，较快下滑，听感 "xiu~"。
 * 音高更高、时值更短，并叠加一层轻二次谐波使音色更亮更脆。
 */
export const RECEIVE_TONE = {
  frequency: 1200,
  glideTo: 1020,
  duration: 0.26,
  fade: 0.05,
  peak: 0.16,
  glideTime: 0.12,
};

/** 接收音叠加的二次谐波，用于与发送音的纯正弦音色形成区分。 */
export const RECEIVE_HARMONIC = {
  frequency: 2400,
  glideTo: 2040,
  peak: 0.05,
};

const DB_NAME = "localchat-sounds";
const DB_VERSION = 1;
const STORE_NAME = "sounds";

/** 音频类型后缀兜底，部分浏览器对 m4a 等文件不提供 MIME。 */
const AUDIO_FILE = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba|webm)$/i;

export interface SoundOption {
  id: string;
  name: string;
  custom: boolean;
}

interface SoundRecord {
  id: string;
  name: string;
  data: ArrayBuffer;
}

const DEFAULT_OPTION: SoundOption = {
  id: DEFAULT_SOUND_ID,
  name: "System default",
  custom: false,
};

/**
 * 把持久化的选择收敛为可用标识：空或不可用（自定义音已被删除）时回退系统默认。
 * 纯函数，便于测试。
 */
export function resolveSoundId(stored: string, customIds: string[]): string {
  if (!stored || stored === DEFAULT_SOUND_ID) return DEFAULT_SOUND_ID;
  return customIds.includes(stored) ? stored : DEFAULT_SOUND_ID;
}

function readEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

function readSelection(): string {
  try {
    return localStorage.getItem(SOUND_SELECTION_KEY) || DEFAULT_SOUND_ID;
  } catch {
    return DEFAULT_SOUND_ID;
  }
}

function openDatabase(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(undefined);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(undefined);
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T | undefined> {
  return openDatabase().then((db) => {
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve) => {
      let request: IDBRequest;
      try {
        const transaction = db.transaction(STORE_NAME, mode);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
        request = work(transaction.objectStore(STORE_NAME));
      } catch {
        db.close();
        return resolve(undefined);
      }
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(undefined);
    });
  });
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_FILE.test(file.name);
}

// 单个惰性 AudioContext，避免重复创建与过多上下文被回收。
let context: AudioContext | undefined;
const bufferCache = new Map<string, AudioBuffer>();

function audioContext(): AudioContext | undefined {
  if (context) return context;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    context = Ctor ? new Ctor() : undefined;
  } catch {
    context = undefined;
  }
  return context;
}

/** 合成一个带淡入淡出与轻微下滑的正弦音，不依赖任何外部资源。 */
function playSine(
  ctx: AudioContext,
  start: number,
  frequency: number,
  glideTo: number,
  duration: number,
  fade: number,
  peak: number,
  glideTime: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(glideTo, start + glideTime);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + fade);
  gain.gain.setValueAtTime(peak, start + duration - fade);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

/** 发送提示音：800 Hz 柔和正弦，听感 "hui~"。 */
function playSendTone(ctx: AudioContext) {
  const start = ctx.currentTime;
  playSine(
    ctx,
    start,
    SEND_TONE.frequency,
    SEND_TONE.glideTo,
    SEND_TONE.duration,
    SEND_TONE.fade,
    SEND_TONE.peak,
    SEND_TONE.glideTime,
  );
}

/** 接收提示音：1200 Hz 正弦 + 轻二次谐波，音色更亮更脆，听感 "xiu~"。 */
function playReceiveTone(ctx: AudioContext) {
  const start = ctx.currentTime;
  playSine(
    ctx,
    start,
    RECEIVE_TONE.frequency,
    RECEIVE_TONE.glideTo,
    RECEIVE_TONE.duration,
    RECEIVE_TONE.fade,
    RECEIVE_TONE.peak,
    RECEIVE_TONE.glideTime,
  );
  playSine(
    ctx,
    start,
    RECEIVE_HARMONIC.frequency,
    RECEIVE_HARMONIC.glideTo,
    RECEIVE_TONE.duration,
    RECEIVE_TONE.fade,
    RECEIVE_HARMONIC.peak,
    RECEIVE_TONE.glideTime,
  );
}

/** 解码并播放用户上传的音频；记录缺失或解码失败时返回 false 由上层回退默认音。 */
async function playCustom(ctx: AudioContext, id: string): Promise<boolean> {
  try {
    let buffer = bufferCache.get(id);
    if (!buffer) {
      const record = await run<SoundRecord>("readonly", (store) =>
        store.get(id),
      );
      if (!record?.data) return false;
      buffer = await ctx.decodeAudioData(record.data.slice(0));
      bufferCache.set(id, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return true;
  } catch {
    return false;
  }
}

/**
 * 通知提示音：开关与所选标识存 localStorage，上传的音频数据存 IndexedDB，
 * 播放统一走 Web Audio API（避免 blob: 与 CSP 冲突）。
 */
export function useNotificationSound() {
  const enabled = ref(readEnabled());
  const selection = ref(DEFAULT_SOUND_ID);
  const customSounds = ref<SoundOption[]>([]);
  const error = ref("");
  let pendingSelection = readSelection();

  const options = computed<SoundOption[]>(() => [
    DEFAULT_OPTION,
    ...customSounds.value,
  ]);

  async function load() {
    const records = await run<SoundRecord[]>("readonly", (store) =>
      store.getAll(),
    );
    if (!records?.length) {
      selection.value = DEFAULT_SOUND_ID;
      return;
    }
    customSounds.value = records.map((record) => ({
      id: record.id,
      name: record.name,
      custom: true,
    }));
    selection.value = resolveSoundId(
      pendingSelection,
      customSounds.value.map((sound) => sound.id),
    );
  }
  void load();

  function setEnabled(value: boolean) {
    enabled.value = value;
    try {
      localStorage.setItem(SOUND_ENABLED_KEY, value ? "1" : "0");
    } catch {
      /* 隐私模式可能禁用存储，开关仍在本次会话内生效。 */
    }
  }

  function select(id: string) {
    selection.value = resolveSoundId(
      id,
      customSounds.value.map((sound) => sound.id),
    );
    pendingSelection = selection.value;
    try {
      localStorage.setItem(SOUND_SELECTION_KEY, selection.value);
    } catch {
      /* 同上。 */
    }
  }

  /** 首次用户手势时恢复音频上下文，满足浏览器自动播放策略。 */
  function unlock() {
    const ctx = audioContext();
    if (ctx?.state === "suspended") void ctx.resume();
  }

  async function trigger(id: string) {
    const resolved = resolveSoundId(
      id,
      customSounds.value.map((sound) => sound.id),
    );
    const ctx = audioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      if (resolved === DEFAULT_SOUND_ID || !(await playCustom(ctx, resolved))) {
        playReceiveTone(ctx);
      }
    } catch {
      /* 播放失败不影响聊天主流程。 */
    }
  }

  /** 收到他人消息时调用；开关关闭则不发声。 */
  function play() {
    if (!enabled.value) return;
    return trigger(selection.value);
  }

  /** 自己发送消息成功后调用；固定使用发送音，不受音效选择影响。 */
  async function playSend() {
    if (!enabled.value) return;
    const ctx = audioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      playSendTone(ctx);
    } catch {
      /* 播放失败不影响发送主流程。 */
    }
  }

  /** 设置页试听；不受开关限制。 */
  function preview(id: string) {
    return trigger(id);
  }

  async function upload(file: File): Promise<boolean> {
    error.value = "";
    if (!isAudioFile(file)) {
      error.value = "Choose an audio file, for example MP3 or WAV.";
      return false;
    }
    if (file.size > MAX_SOUND_BYTES) {
      error.value = "Sound files must be 2 MB or smaller.";
      return false;
    }
    const data = await file.arrayBuffer();
    const record: SoundRecord = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name.slice(0, 60),
      data,
    };
    const stored = await run("readwrite", (store) => store.put(record));
    if (stored === undefined) {
      error.value = "This browser cannot store custom sounds.";
      return false;
    }
    customSounds.value = [
      ...customSounds.value,
      { id: record.id, name: record.name, custom: true },
    ];
    select(record.id);
    await preview(record.id);
    return true;
  }

  async function remove(id: string) {
    await run("readwrite", (store) => store.delete(id));
    bufferCache.delete(id);
    customSounds.value = customSounds.value.filter((sound) => sound.id !== id);
    if (selection.value === id) select(DEFAULT_SOUND_ID);
  }

  return {
    enabled,
    selection,
    options,
    error,
    setEnabled,
    select,
    unlock,
    play,
    playSend,
    preview,
    upload,
    remove,
  };
}