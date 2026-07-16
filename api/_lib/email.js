const LOCAL_PART = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Validate and normalize an address without changing mailbox semantics.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeEmail(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254 || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;

  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at !== trimmed.indexOf("@")) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (
    local.length > 64 ||
    !LOCAL_PART.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.length > 253 ||
    !domain.includes(".")
  ) {
    return null;
  }

  const labels = domain.split(".");
  if (labels.some((label) => !DOMAIN_LABEL.test(label))) return null;

  return `${local}@${domain}`;
}
