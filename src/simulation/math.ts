export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function normalizeSignedDegrees(degrees: number) {
  const normalized = normalizeDegrees(degrees);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function degreesToRadians(degrees: number) {
  return degrees * DEG2RAD;
}

export function radiansToDegrees(radians: number) {
  return radians * RAD2DEG;
}
