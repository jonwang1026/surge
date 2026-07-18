import {
  resolveResendWebhookSecret,
  resolveSignupConfig,
  runtimeEnvironment,
} from "./_lib/config.js";
import { normalizeEmail } from "./_lib/email.js";
import { jsonResponse } from "./_lib/http.js";
import { ResendGateway } from "./_lib/resend-gateway.js";
import { isRecord } from "./_lib/validation.js";

const WEBHOOK_BODY_MAX_BYTES = 262_144;
const EMAIL_EVENT_PREFIX = "email.";
const SUPPRESSION_EVENT_TYPES = new Set(["email.complained", "email.suppressed"]);
const DELIVERY_LOG_EVENT_TYPES = new Set(["email.delivery_delayed", "email.failed"]);

/**
 * @typedef {{verifyWebhook(payload: string, headers: {id: string, timestamp: string,
 * signature: string}, secret: string): unknown,
 * suppressContact(suppression: {email: string, topicId: string}): Promise<void>}} WebhookGateway
 */

/**
 * Public POST seam used by Vercel and tests.
 * @param {Request} request
 * @param {{env: Record<string, string | undefined>, gateway?: WebhookGateway}} dependencies
 */
export async function handleResendWebhook(request, dependencies) {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let config;
  let webhookSecret;
  try {
    config = resolveSignupConfig(dependencies.env);
    webhookSecret = resolveResendWebhookSecret(dependencies.env);
  } catch {
    return jsonResponse({ error: "temporarily_unavailable" }, 503);
  }
  if (!config.enabled) {
    return jsonResponse({ error: "temporarily_unavailable" }, 503);
  }

  const headers = {
    id: request.headers.get("svix-id") || "",
    timestamp: request.headers.get("svix-timestamp") || "",
    signature: request.headers.get("svix-signature") || "",
  };
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > WEBHOOK_BODY_MAX_BYTES) {
    return jsonResponse({ error: "request_too_large" }, 413);
  }
  const payload = await request.text();
  if (new TextEncoder().encode(payload).byteLength > WEBHOOK_BODY_MAX_BYTES) {
    return jsonResponse({ error: "request_too_large" }, 413);
  }

  const gateway = dependencies.gateway || new ResendGateway(config.apiKey);
  let event;
  try {
    event = gateway.verifyWebhook(payload, headers, webhookSecret);
  } catch {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }
  if (!isEmailEvent(event)) return jsonResponse({ ok: true }, 200);

  const type = event.type;
  const emailId = typeof event.data.email_id === "string" ? event.data.email_id : "unknown";
  const recipient = normalizeEmail(Array.isArray(event.data.to) ? event.data.to[0] : null);
  const shouldSuppress = isPermanentBounce(type, event.data) || SUPPRESSION_EVENT_TYPES.has(type);

  if (shouldSuppress && recipient) {
    try {
      await gateway.suppressContact({ email: recipient, topicId: config.topicId });
    } catch {
      return jsonResponse({ error: "temporarily_unavailable" }, 503);
    }
  }

  if (DELIVERY_LOG_EVENT_TYPES.has(type)) {
    console.warn("resend_delivery_event", { type, emailId });
  }
  return jsonResponse({ ok: true }, 200);
}

/** @param {unknown} value @returns {value is {type: string, data: Record<string, unknown>}} */
function isEmailEvent(value) {
  return Boolean(
    isRecord(value) &&
      typeof value.type === "string" &&
      value.type.startsWith(EMAIL_EVENT_PREFIX) &&
      isRecord(value.data),
  );
}

/** @param {string} type @param {Record<string, unknown>} data */
function isPermanentBounce(type, data) {
  return type === "email.bounced" && isRecord(data.bounce) && data.bounce.type === "Permanent";
}

export default {
  /** @param {Request} request */
  fetch(request) {
    return handleResendWebhook(request, { env: runtimeEnvironment() });
  },
};
