import { resolveSignupConfig, runtimeEnvironment } from "./_lib/config.js";
import { ResendGateway } from "./_lib/resend-gateway.js";
import { decryptSignupToken } from "./_lib/token.js";

/**
 * @typedef {{confirmContact(confirmation: {email: string, segmentId: string, topicId: string,
 * properties: Record<string, string>}): Promise<void>}} ConfirmationGateway
 */

/**
 * Public GET seam used by Vercel and tests.
 * @param {Request} request
 * @param {{env: Record<string, string | undefined>, gateway?: ConfirmationGateway, now?: number}} dependencies
 */
export async function handleConfirmationRequest(request, dependencies) {
  const requestUrl = new URL(request.url);
  let config;
  try {
    config = resolveSignupConfig(dependencies.env);
  } catch {
    return resultRedirect(requestUrl.origin, "temporary");
  }
  if (!config.enabled || request.method !== "GET") {
    return resultRedirect(requestUrl.origin, "invalid");
  }

  const token = requestUrl.searchParams.get("token");
  if (!token || token.length > 2_000) return resultRedirect(config.publicSiteUrl, "invalid");

  let claims;
  try {
    claims = await decryptSignupToken(token, config.tokenKeys, {
      now: dependencies.now,
      expectedMode: config.mode,
    });
  } catch {
    return resultRedirect(config.publicSiteUrl, "invalid");
  }

  try {
    const gateway = dependencies.gateway || new ResendGateway(config.apiKey);
    await gateway.confirmContact({
      email: claims.email,
      segmentId: config.segmentId,
      topicId: config.topicId,
      properties: {
        confirmed_at: new Date(dependencies.now ?? Date.now()).toISOString(),
        consent_version: claims.consentVersion,
        consent_method: "double_opt_in",
        signup_source: config.signupSource,
      },
    });
    return resultRedirect(config.publicSiteUrl, "success");
  } catch {
    return resultRedirect(config.publicSiteUrl, "temporary");
  }
}

/** @param {string} origin @param {"success" | "invalid" | "temporary"} status */
function resultRedirect(origin, status) {
  return new Response(null, {
    status: 303,
    headers: {
      "cache-control": "no-store",
      location: `${origin}/earlyaccess/confirmed/?status=${status}`,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export default {
  /** @param {Request} request */
  fetch(request) {
    return handleConfirmationRequest(request, { env: runtimeEnvironment() });
  },
};
