import { resolveSignupConfig, runtimeEnvironment } from "./_lib/config.js";
import { keyedDigest } from "./_lib/digest.js";
import { normalizeEmail } from "./_lib/email.js";
import {
  BodyError,
  isSameOriginRequest,
  jsonResponse,
  neutralSignupResponse,
  readJsonBody,
} from "./_lib/http.js";
import { ResendGateway } from "./_lib/resend-gateway.js";
import { encryptSignupToken } from "./_lib/token.js";
import { isRecord } from "./_lib/validation.js";

/**
 * @typedef {{getSubscription(email: string, segmentId: string, topicId: string): Promise<{
 * exists: boolean, subscribed: boolean, inSegment: boolean, topicOptIn: boolean}>,
 * sendConfirmation(message: Record<string, string>): Promise<void>}} SignupGateway
 */

/**
 * Public POST seam used by Vercel and tests.
 * @param {Request} request
 * @param {{env: Record<string, string | undefined>, gateway?: SignupGateway, now?: number}} dependencies
 */
export async function handleSignupRequest(request, dependencies) {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "forbidden" }, 403);

  let body;
  try {
    body = await readJsonBody(request, 2_048);
  } catch (error) {
    if (error instanceof BodyError && error.code === "too_large") {
      return jsonResponse({ error: "request_too_large" }, 413);
    }
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const payload = isRecord(body) ? body : {};
  const email = normalizeEmail(payload.email);
  if (!email) return jsonResponse({ error: "invalid_email" }, 400);

  let config;
  try {
    config = resolveSignupConfig(dependencies.env);
  } catch {
    return jsonResponse({ error: "temporarily_unavailable" }, 503);
  }
  if (!config.enabled) return neutralSignupResponse();

  const now = dependencies.now ?? Date.now();
  const renderedAt = typeof payload.renderedAt === "number" ? payload.renderedAt : null;
  const tooFast = renderedAt !== null && now - renderedAt >= 0 && now - renderedAt < 700;
  const browserFastPost = tooFast && request.headers.get("sec-fetch-site") === "same-origin";
  if (typeof payload.company === "string" && payload.company.trim()) return neutralSignupResponse();
  if (browserFastPost) return neutralSignupResponse();

  if (config.ownerEmail && email !== config.ownerEmail) return neutralSignupResponse();

  try {
    const gateway = dependencies.gateway || new ResendGateway(config.apiKey);
    const subscription = await gateway.getSubscription(email, config.segmentId, config.topicId);
    if (
      subscription.exists &&
      subscription.subscribed &&
      subscription.inSegment &&
      subscription.topicOptIn
    ) {
      return neutralSignupResponse();
    }

    const token = await encryptSignupToken(
      { email, mode: config.mode },
      config.tokenKeys[0],
      { now },
    );
    const digest = await keyedDigest(`${config.mode}\0${email}`, config.idempotencySecret);
    await gateway.sendConfirmation({
      to: email,
      from: config.from,
      templateId: config.templateId,
      brandName: config.brandName,
      confirmUrl: `${config.publicSiteUrl}/api/confirm?token=${encodeURIComponent(token)}`,
      privacyUrl: config.privacyUrl,
      postalAddress: config.postalAddress,
      mode: config.mode,
      idempotencyKey: `early-access/${config.mode}/${digest}`,
    });
    return neutralSignupResponse();
  } catch {
    return jsonResponse({ error: "temporarily_unavailable" }, 503);
  }
}

export default {
  /** @param {Request} request */
  fetch(request) {
    return handleSignupRequest(request, { env: runtimeEnvironment() });
  },
};
