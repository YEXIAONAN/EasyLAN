import { ref } from "./state.js";
const SOUND_KEY = "localchat.notification.sound";
const MIN_SOUND_INTERVAL = 400;
// [first Hz, second Hz, gap seconds, note duration seconds]. Each preset
// has rising send tones and falling receive tones, synthesized entirely locally.
export const SOUND_PRESETS = [
    {
        id: "chime", label: "Chime", wave: "sine",
        receive: [660, 520, 0.13, 0.15], send: [520, 780, 0.07, 0.12],
    },
    {
        id: "pulse", label: "Pulse", wave: "triangle",
        receive: [620, 460, 0.10, 0.13], send: [400, 640, 0.06, 0.11],
    },
    {
        id: "bell", label: "Bell", wave: "sine",
        receive: [880, 660, 0.12, 0.14], send: [660, 990, 0.065, 0.12],
    },
    {
        id: "drop", label: "Drop", wave: "sine",
        receive: [540, 350, 0.09, 0.13], send: [350, 590, 0.07, 0.13],
    },
    {
        id: "wood", label: "Wood", wave: "triangle",
        receive: [460, 330, 0.06, 0.12], send: [280, 420, 0.06, 0.11],
    },
];
const SEND_SOUND_KEY = "localchat.notification.sendSound";
const TONE_KEYS = {
    receive: "localchat.notification.receiveTone",
    send: "localchat.notification.sendTone",
};
function validTone(value) {
    return SOUND_PRESETS.some((preset) => preset.id === value);
}
// One instance per client. Connection IDs survive renames and remain in ownIds
// after reconnect, so a delayed file broadcast from an old connection is still own.
export function useNotification(ownIds) {
    const unreadCount = ref(0);
    const soundEnabled = ref(true);
    const sentSoundEnabled = ref(true);
    const receivedTone = ref("chime");
    const sentTone = ref("pulse");
    const audioUnlocked = ref(false);
    try {
        soundEnabled.value = localStorage.getItem(SOUND_KEY) !== "false";
        sentSoundEnabled.value = localStorage.getItem(SEND_SOUND_KEY) !== "false";
        const receive = localStorage.getItem(TONE_KEYS.receive);
        const send = localStorage.getItem(TONE_KEYS.send);
        if (validTone(receive))
            receivedTone.value = receive;
        if (validTone(send))
            sentTone.value = send;
    }
    catch {
        // Storage may be unavailable; the setting still works for this page.
    }
    const icon = document.querySelector('link[rel="icon"]');
    const originalIcon = icon?.getAttribute("href") || "";
    const originalType = icon?.getAttribute("type");
    let unreadIcon = "";
    let image;
    let audio;
    let unlocking;
    let disposed = false;
    const playbackGeneration = { receive: 0, send: 0 };
    let resuming;
    const lastSound = { receive: -Infinity, send: -Infinity };
    const tones = new Map();
    const enabledFor = (kind) => kind === "receive" ? soundEnabled.value : sentSoundEnabled.value;
    const toneFor = (kind) => kind === "receive" ? receivedTone : sentTone;
    function updateDocumentTitle() {
        const count = unreadCount.value;
        document.title = count
            ? `(${count > 99 ? "99+" : count}) EasyLAN`
            : "EasyLAN";
    }
    function updateFavicon() {
        if (!icon)
            return;
        if (unreadCount.value && unreadIcon) {
            icon.setAttribute("type", "image/png");
            icon.setAttribute("href", unreadIcon);
        }
        else {
            icon.setAttribute("href", originalIcon);
            if (originalType === null || originalType === undefined)
                icon.removeAttribute("type");
            else
                icon.setAttribute("type", originalType);
        }
    }
    // Generate just one badge image, asynchronously. A return to the tab while
    // its logo loads must not resurrect the unread badge.
    if (icon && originalIcon) {
        try {
            image = new Image();
            image.onload = () => {
                if (disposed)
                    return;
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = canvas.height = 32;
                    const context = canvas.getContext("2d");
                    if (!context)
                        return;
                    context.drawImage(image, 0, 0, 32, 32);
                    context.beginPath();
                    context.arc(26, 6, 5, 0, Math.PI * 2);
                    context.fillStyle = "#F04438";
                    context.fill();
                    unreadIcon = canvas.toDataURL("image/png");
                    updateFavicon();
                }
                catch {
                    // A missing/blocked canvas must not affect title or chat.
                }
            };
            image.onerror = () => {
                /* Keep the original favicon if loading fails. */
            };
            image.src = originalIcon;
        }
        catch {
            /* Image APIs are optional. */
        }
    }
    function isForeground() {
        // A visible tab can still belong to a background window (IDE/Terminal).
        return document.visibilityState === "visible" && document.hasFocus();
    }
    function stopSound(kind) {
        for (const channel of ["receive", "send"]) {
            if (!kind || channel === kind)
                playbackGeneration[channel]++;
        }
        for (const [tone, output] of tones) {
            if (kind && output.kind !== kind)
                continue;
            try {
                tone.stop();
            }
            catch {
                /* Already ended. */
            }
            try {
                tone.disconnect();
                output.gain.disconnect();
            }
            catch {
                /* Audio already closed. */
            }
            tones.delete(tone);
        }
    }
    async function unlockAudio() {
        if (disposed ||
            (!soundEnabled.value && !sentSoundEnabled.value) ||
            unlocking ||
            (audioUnlocked.value && audio?.state === "running"))
            return unlocking;
        unlocking = (async () => {
            try {
                if (!audio) {
                    const Audio = window.AudioContext ||
                        window
                            .webkitAudioContext;
                    if (!Audio)
                        return;
                    audio = new Audio();
                }
                if (audio.state !== "running")
                    await audio.resume();
                audioUnlocked.value = !disposed && audio.state === "running";
            }
            catch {
                audioUnlocked.value = false;
            }
        })();
        try {
            await unlocking;
        }
        finally {
            unlocking = undefined;
        }
    }
    function playSound(kind, preview = false) {
        // Background receipt never creates/unlocks a new context. Previously
        // unlocked audio may need resuming after browser suspension.
        if (disposed ||
            !enabledFor(kind) ||
            !audioUnlocked.value ||
            !audio ||
            (kind === "receive" && !preview && isForeground()))
            return;
        if (audio.state !== "running") {
            const generation = playbackGeneration[kind];
            try {
                if (!resuming) {
                    resuming = audio
                        .resume()
                        .catch(() => { audioUnlocked.value = false; })
                        .finally(() => { resuming = undefined; });
                }
                void resuming.then(() => {
                    if (audio?.state === "running" &&
                        generation === playbackGeneration[kind])
                        playSound(kind, preview);
                });
            }
            catch {
                audioUnlocked.value = false;
            }
            return;
        }
        const now = performance.now();
        if (!preview && now - lastSound[kind] < MIN_SOUND_INTERVAL)
            return;
        lastSound[kind] = now;
        try {
            const preset = SOUND_PRESETS.find((item) => item.id === toneFor(kind).value);
            const [first, second, gap, duration] = preset[kind];
            const start = audio.currentTime + 0.025;
            for (const [offset, frequency] of [
                [0, first],
                [gap, second],
            ]) {
                const tone = audio.createOscillator();
                const gain = audio.createGain();
                tone.type = preset.wave;
                tone.frequency.value = frequency;
                gain.gain.setValueAtTime(0, start + offset);
                gain.gain.linearRampToValueAtTime(0.07, start + offset + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration - 0.01);
                tone.connect(gain);
                gain.connect(audio.destination);
                tones.set(tone, { kind, gain });
                tone.onended = () => {
                    tones.delete(tone);
                    tone.disconnect();
                    gain.disconnect();
                };
                tone.start(start + offset);
                tone.stop(start + offset + duration);
            }
        }
        catch {
            stopSound(kind);
            audioUnlocked.value = false;
        }
    }
    function previewSound(kind) {
        if (disposed || !enabledFor(kind))
            return;
        stopSound(kind);
        const generation = playbackGeneration[kind];
        void unlockAudio().then(() => {
            if (generation === playbackGeneration[kind])
                playSound(kind, true);
        });
    }
    function clearUnread() {
        unreadCount.value = 0;
        updateDocumentTitle();
        updateFavicon();
        stopSound("receive");
    }
    function notifyIncomingMessage(message) {
        if (disposed || !["text", "file"].includes(message.type) || !message.clientId)
            return;
        // Own broadcasts confirm a successful send (including completed files).
        // They use a separate sound channel and never become unread notifications.
        if (ownIds.value.has(message.clientId)) {
            playSound("send");
            return;
        }
        if (isForeground())
            return;
        unreadCount.value++;
        updateDocumentTitle();
        updateFavicon();
        playSound("receive");
    }
    function setChannelEnabled(kind, enabled) {
        (kind === "receive" ? soundEnabled : sentSoundEnabled).value = enabled;
        try {
            localStorage.setItem(kind === "receive" ? SOUND_KEY : SEND_SOUND_KEY, String(enabled));
        }
        catch {
            /* Page-only preference. */
        }
        if (enabled)
            previewSound(kind);
        else
            stopSound(kind);
    }
    const setSoundEnabled = (enabled) => setChannelEnabled("receive", enabled);
    const setSentSoundEnabled = (enabled) => setChannelEnabled("send", enabled);
    function setTone(kind, value) {
        if (!validTone(value))
            return;
        toneFor(kind).value = value;
        try {
            localStorage.setItem(TONE_KEYS[kind], value);
        }
        catch {
            /* Page-only preference. */
        }
        previewSound(kind);
    }
    function handleVisibilityChange() {
        if (isForeground())
            clearUnread();
    }
    function interaction() {
        void unlockAudio();
    }
    clearUnread();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("pointerdown", interaction);
    document.addEventListener("keydown", interaction);
    function dispose() {
        disposed = true;
        audioUnlocked.value = false;
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleVisibilityChange);
        document.removeEventListener("pointerdown", interaction);
        document.removeEventListener("keydown", interaction);
        if (image)
            image.onload = image.onerror = null;
        clearUnread();
        stopSound();
        try {
            if (audio)
                void audio.close().catch(() => { });
        }
        catch {
            /* Already closed. */
        }
    }
    
    return {
        unreadCount,
        soundEnabled,
        sentSoundEnabled,
        receivedTone,
        sentTone,
        setSentSoundEnabled,
        setTone,
        previewSound,
        audioUnlocked,
        notifyIncomingMessage,
        clearUnread,
        setSoundEnabled,
        unlockAudio,
        dispose,
    };
}
