export const SOFT_LONG_TEXT_LIMIT = 64 * 1024;
export const HARD_LONG_TEXT_LIMIT = 128 * 1024;
export function textSendMode(text) {
    const bytes = new TextEncoder().encode(text).byteLength;
    return bytes <= SOFT_LONG_TEXT_LIMIT
        ? "message"
        : bytes <= HARD_LONG_TEXT_LIMIT
            ? "choice"
            : "txt";
}
export function createTextFile(text, date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return new File([new Blob([text], { type: "text/plain;charset=utf-8" })], `message-${stamp}.txt`, { type: "text/plain;charset=utf-8" });
}
