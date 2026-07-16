/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
