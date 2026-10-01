import { getCurrentInstance, onBeforeUnmount, ref, type Ref } from "vue";
import type { Message } from "../types/message";

const SOUND_KEY = "localchat.notification.sound";
const MIN_SOUND_INTERVAL = 400;

// One instance per client. Connection IDs survive renames and remain in ownIds
// after reconnect, so a delayed file broadcast from an old connection is still own.
export function useNotification(ownIds: Ref<Set<string>>) {
  const unreadCount = ref(0);
  const soundEnabled = ref(true);
  const audioUnlocked = ref(false);
  try {
    soundEnabled.value = localStorage.getItem(SOUND_KEY) !== "false";
  } catch {
    // Storage may be unavailable; the setting still works for this page.
  }
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const originalIcon = icon?.getAttribute("href") || "";
  const originalType = icon?.getAttribute("type");
  let unreadIcon = "";
  let image: HTMLImageElement | undefined;
  let audio: AudioContext | undefined;
  let unlocking: Promise<void> | undefined;
  let disposed = false;
  let lastSound = -Infinity;
  const tones = new Set<OscillatorNode>();

  function updateDocumentTitle() {
    const count = unreadCount.value;
    document.title = count
      ? `(${count > 99 ? "99+" : count}) LocalChat`
      : "LocalChat";
  }
  function updateFavicon() {
    if (!icon) return;
    if (unreadCount.value && unreadIcon) {
      icon.setAttribute("type", "image/png");
      icon.setAttribute("href", unreadIcon);
    } else {
      icon.setAttribute("href", originalIcon);
      if (originalType === null || originalType === undefined)
        icon.removeAttribute("type");
      else icon.setAttribute("type", originalType);
    }
  }
  // Generate just one badge image, asynchronously. A return to the tab while
  // its logo loads must not resurrect the unread badge.
  if (icon && originalIcon) {
    try {
      image = new Image();
      image.onload = () => {
        if (disposed) return;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 32;
          const context = canvas.getContext("2d");
          if (!context) return;
          context.drawImage(image!, 0, 0, 32, 32);
          context.beginPath();
          context.arc(26, 6, 5, 0, Math.PI * 2);
          context.fillStyle = "#F04438";
          context.fill();
          unreadIcon = canvas.toDataURL("image/png");
          updateFavicon();
        } catch {
          // A missing/blocked canvas must not affect title or chat.
        }
      };
      image.onerror = () => {
        /* Keep the original favicon if loading fails. */
      };
      image.src = originalIcon;
    } catch {
      /* Image APIs are optional. */
    }
  }

  function stopSound() {
    for (const tone of tones) {
      try {
        tone.stop();
      } catch {
        /* Already ended. */
      }
      try {
        tone.disconnect();
      } catch {
        /* Audio already closed. */
      }
    }
    tones.clear();
  }
  async function unlockAudio() {
    if (
      disposed ||
      !soundEnabled.value ||
      unlocking ||
      (audioUnlocked.value && audio?.state === "running")
    )
      return unlocking;
    unlocking = (async () => {
      try {
        if (!audio) {
          const Audio =
            window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (!Audio) return;
          audio = new Audio();
        }
        if (audio.state !== "running") await audio.resume();
        audioUnlocked.value = !disposed && audio.state === "running";
      } catch {
        audioUnlocked.value = false;
      }
    })();
    try {
      await unlocking;
    } finally {
      unlocking = undefined;
    }
  }
  function playSound() {
    // Background receipt never attempts to unlock autoplay. Only an actual
    // page interaction does that; visual unread state works without audio.
    if (
      !soundEnabled.value ||
      !audioUnlocked.value ||
      audio?.state !== "running"
    )
      return;
    const now = performance.now();
    if (now - lastSound < MIN_SOUND_INTERVAL) return;
    lastSound = now;
    try {
      const start = audio.currentTime;
      for (const [offset, frequency] of [
        [0, 660],
        [0.13, 520],
      ]) {
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        tone.type = "sine";
        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start + offset);
        gain.gain.linearRampToValueAtTime(0.035, start + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.14);
        tone.connect(gain);
        gain.connect(audio.destination);
        tones.add(tone);
        tone.onended = () => {
          tones.delete(tone);
          tone.disconnect();
          gain.disconnect();
        };
        tone.start(start + offset);
        tone.stop(start + offset + 0.15);
      }
    } catch {
      stopSound();
      audioUnlocked.value = false;
    }
  }
  function clearUnread() {
    unreadCount.value = 0;
    updateDocumentTitle();
    updateFavicon();
    stopSound();
  }
  function notifyIncomingMessage(message: Message) {
    if (
      disposed ||
      document.visibilityState === "visible" ||
      !["text", "file"].includes(message.type) ||
      !message.clientId ||
      ownIds.value.has(message.clientId)
    )
      return;
    unreadCount.value++;
    updateDocumentTitle();
    updateFavicon();
    playSound();
  }
  function setSoundEnabled(enabled: boolean) {
    soundEnabled.value = enabled;
    try {
      localStorage.setItem(SOUND_KEY, String(enabled));
    } catch {
      /* Page-only preference. */
    }
    if (enabled) void unlockAudio();
    else stopSound();
  }
  function handleVisibilityChange() {
    if (document.visibilityState === "visible") clearUnread();
  }
  function interaction() {
    void unlockAudio();
  }
  clearUnread();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("pointerdown", interaction);
  document.addEventListener("keydown", interaction);
  function dispose() {
    disposed = true;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("pointerdown", interaction);
    document.removeEventListener("keydown", interaction);
    if (image) image.onload = image.onerror = null;
    clearUnread();
    try {
      if (audio) void audio.close().catch(() => {});
    } catch {
      /* Already closed. */
    }
  }
  if (getCurrentInstance()) onBeforeUnmount(dispose);
  return {
    unreadCount,
    soundEnabled,
    audioUnlocked,
    notifyIncomingMessage,
    clearUnread,
    setSoundEnabled,
    unlockAudio,
    dispose,
  };
}
