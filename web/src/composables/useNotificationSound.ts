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
 * 同样是单一正弦音，只靠更高的音高与更短的时值同发送音区分。
 */
export const RECEIVE_TONE = {
  frequency: 1200,
  glideTo: 1020,
  duration: 0.26,
  fade: 0.05,
  peak: 0.16,
  glideTime: 0.12,
};

/**
 * 发送音相对所选音效的移调系数：降低一个八度。
 * 这样发送音同样跟随用户所选的音效，又与接收音在高音区/低音区上区分开。
 */
export const SEND_TRANSPOSE = 0.5;

/** 振荡器波形，决定音色。 */
export type SoundWave = "sine" | "triangle" | "square" | "sawtooth";

/**
 * 内置可选音色。
 * 每种音色只用一个振荡器发声，确保一次事件只听到一个声音，
 * 音色差异来自波形本身（正弦/方波/三角波），而不是叠加多个音。
 */
export interface SoundPreset {
  id: string;
  name: string;
  /** 基频。 */
  frequency: number;
  /** 总时长。 */
  duration: number;
  /** 起音时长，用于避免爆音。 */
  attack: number;
  /** 振荡器波形。 */
  type: SoundWave;
  /** 峰值增益。 */
  peak: number;
}

/**
 * 内置音色预设：在系统默认之外再提供 3 种提示音。
 * 三者的基频、时长与波形均不同，音色彼此区分明显；
 * 全部由单个振荡器合成，不依赖外部资源，因此不受 CSP 与网络影响。
 */
export const SOUND_PRESETS: SoundPreset[] = [
  {
    // 明亮钟琴音：高音正弦 + 长衰减，余音悠长。
    id: "chime",
    name: "Chime",
    frequency: 1046.5,
    duration: 0.9,
    attack: 0.012,
    type: "sine",
    peak: 0.18,
  },
  {
    // 电子脉冲：方波，短促、有数字感，音色明亮发脆。
    id: "pulse",
    name: "Pulse",
    frequency: 660,
    duration: 0.16,
    attack: 0.005,
    type: "square",
    peak: 0.12,
  },
  {
    // 木质马林巴：三角波，温暖、颗粒感强，介于正弦与方波之间。
    id: "marimba",
    name: "Marimba",
    frequency: 523.25,
    duration: 0.5,
    attack: 0.008,
    type: "triangle",
    peak: 0.18,
  },
];

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

const PRESET_OPTIONS: SoundOption[] = SOUND_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  custom: false,
}));

/**
 * 把持久化的选择收敛为可用标识：空或不可用（音色已被移除）时回退系统默认。
 * 纯函数，便于测试。
 */
export function resolveSoundId(stored: string, availableIds: string[]): string {
  if (!stored || stored === DEFAULT_SOUND_ID) return DEFAULT_SOUND_ID;
  return availableIds.includes(stored) ? stored : DEFAULT_SOUND_ID;
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

/** 接收提示音：1200 Hz 单一正弦，只响一个音，听感 "xiu~"。 */
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
}

/**
 * 播放内置音色预设：只用一个振荡器，配合指数衰减包络，
 * 保证一次事件只发一个声音，且干净无爆音。
 * transpose 用于整体移调（发送音取其低八度变体），默认 1 表示原调。
 */
function playPresetTone(
  ctx: AudioContext,
  preset: SoundPreset,
  transpose = 1,
) {
  const start = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = preset.type;
  oscillator.frequency.setValueAtTime(preset.frequency * transpose, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(preset.peak, start + preset.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + preset.duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + preset.duration);
}

/**
 * 解码并播放用户上传的音频；记录缺失或解码失败时返回 false 由上层回退默认音。
 * playbackRate 用于整体移调（发送音取其低八度变体），默认 1 表示原速原调。
 */
async function playCustom(
  ctx: AudioContext,
  id: string,
  playbackRate = 1,
): Promise<boolean> {
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
    source.playbackRate.value = playbackRate;
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
    ...PRESET_OPTIONS,
    ...customSounds.value,
  ]);

  /** 当前所有可用音色标识（内置预设 + 上传音频）。 */
  function availableIds(): string[] {
    return [
      ...SOUND_PRESETS.map((preset) => preset.id),
      ...customSounds.value.map((sound) => sound.id),
    ];
  }

  async function load() {
    const records = await run<SoundRecord[]>("readonly", (store) =>
      store.getAll(),
    );
    customSounds.value = (records || []).map((record) => ({
      id: record.id,
      name: record.name,
      custom: true,
    }));
    selection.value = resolveSoundId(pendingSelection, availableIds());
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
    selection.value = resolveSoundId(id, availableIds());
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
    const resolved = resolveSoundId(id, availableIds());
    const ctx = audioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const preset = SOUND_PRESETS.find((item) => item.id === resolved);
      if (preset) {
        playPresetTone(ctx, preset);
        return;
      }
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

  /**
   * 自己发送消息成功后调用。
   * 跟随所选音效，但整体降低一个八度，与接收音在高音区/低音区上区分开；
   * 系统默认仍使用规格定义的 800 Hz 发送音。
   */
  async function playSend() {
    if (!enabled.value) return;
    const ctx = audioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const resolved = resolveSoundId(selection.value, availableIds());
      const preset = SOUND_PRESETS.find((item) => item.id === resolved);
      if (preset) {
        playPresetTone(ctx, preset, SEND_TRANSPOSE);
        return;
      }
      if (resolved === DEFAULT_SOUND_ID) {
        playSendTone(ctx);
        return;
      }
      if (!(await playCustom(ctx, resolved, SEND_TRANSPOSE))) {
        playSendTone(ctx);
      }
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