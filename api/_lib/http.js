const API_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

/** @param {unknown} body @param {number} status */
export function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status, headers: API_HEADERS });
}

export function neutralSignupResponse() {
  return jsonResponse({ ok: true }, 202);
}

/** @param {Request} request */
export function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== new URL(request.url).origin) return false;
  return !fetchSite || fetchSite === "same-origin";
}

/** @param {Request} request @param {number} maxBytes */
export async function readJsonBody(request, maxBytes) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new BodyError("too_large");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new BodyError("unsupported_media_type");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new BodyError("too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new BodyError("invalid_json");
  }
}

export class BodyError extends Error {
  /** @param {"too_large" | "unsupported_media_type" | "invalid_json"} code */
  constructor(code) {
    super(code);
    this.code = code;
  }
}
