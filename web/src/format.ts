export function formatBytes(size: number) {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  return `${(size / 1024 ** exponent).toFixed(exponent === 0 ? 0 : exponent === 3 ? 2 : 1)} ${units[exponent]}`;
}
