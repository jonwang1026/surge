import { normalizeEmail } from "./email.js";

/** @typedef {Record<string, string | undefined>} Environment */
/** @typedef {"disabled" | "preview" | "canary" | "live"} SignupMode */
/** @typedef {Exclude<SignupMode, "disabled">} ActiveSignupMode */
/** @typedef {{mode: "disabled", enabled: false}} DisabledSignupConfig */
/** @typedef {{mode: ActiveSignupMode, enabled: true, apiKey: string, from: string, templateId: string,
 * segmentId: string, topicId: string, ownerEmail: string | null, publicSiteUrl: string,
 * brandName: string, privacyUrl: string, postalAddress: string, tokenKeys: [string, ...string[]],
 * idempotencySecret: string,
 * signupSource: "shareable_preview" | "production_canary" | "website"}} ActiveSignupConfig */

/**
 * Resolve deployment mode and the matching Resend resources without ever
 * allowing preview contacts to cross into production resources.
 * @param {Environment} env
 * @returns {DisabledSignupConfig | ActiveSignupConfig}
 */
export function resolveSignupConfig(env) {
  const rawMode = env.SIGNUP_MODE || "disabled";
  if (!isSignupMode(rawMode)) throw new Error("Invalid SIGNUP_MODE");
  const mode = rawMode;
  if (mode === "disabled") return { mode, enabled: false };

  const isTest = mode === "preview";
  const isRestricted = isTest || mode === "canary";
  const segmentId = requireValue(
    isTest ? env.RESEND_TEST_SEGMENT_ID : env.RESEND_EARLY_ACCESS_SEGMENT_ID,
    isTest ? "RESEND_TEST_SEGMENT_ID" : "RESEND_EARLY_ACCESS_SEGMENT_ID",
  );
  const topicId = requireValue(
    isTest ? env.RESEND_TEST_TOPIC_ID : env.RESEND_EARLY_ACCESS_TOPIC_ID,
    isTest ? "RESEND_TEST_TOPIC_ID" : "RESEND_EARLY_ACCESS_TOPIC_ID",
  );
  const ownerEmail = isRestricted ? normalizeEmail(env.TEST_RECIPIENT_EMAIL) : null;
  if (isRestricted && !ownerEmail) throw new Error("Missing TEST_RECIPIENT_EMAIL");

  let publicSiteUrl;
  try {
    publicSiteUrl = new URL(requireValue(env.PUBLIC_SITE_URL, "PUBLIC_SITE_URL"));
  } catch {
    throw new Error("Invalid PUBLIC_SITE_URL");
  }
  if (
    (publicSiteUrl.protocol !== "https:" && publicSiteUrl.hostname !== "localhost") ||
    publicSiteUrl.pathname !== "/" ||
    publicSiteUrl.search ||
    publicSiteUrl.hash
  ) {
    throw new Error("Invalid PUBLIC_SITE_URL");
  }

  const apiKey = requireSecret(env.RESEND_API_KEY, "RESEND_API_KEY", /^re_[A-Za-z0-9_-]{16,}$/u);
  const currentTokenKey = requireTokenKey(env.SIGNUP_TOKEN_KEY_CURRENT, "SIGNUP_TOKEN_KEY_CURRENT");
  const idempotencySecret = requireSecret(env.SIGNUP_IDEMPOTENCY_SECRET, "SIGNUP_IDEMPOTENCY_SECRET", /^\S{32,}$/u);
  /** @type {[string, ...string[]]} */
  const tokenKeys = env.SIGNUP_TOKEN_KEY_PREVIOUS
    ? [currentTokenKey, requireTokenKey(env.SIGNUP_TOKEN_KEY_PREVIOUS, "SIGNUP_TOKEN_KEY_PREVIOUS")]
    : [currentTokenKey];
  const privacyUrl = env.PRIVACY_URL || "";
  const postalAddress = env.BUSINESS_POSTAL_ADDRESS || "";
  if ((mode === "canary" || mode === "live") && (!privacyUrl || !postalAddress)) {
    throw new Error("Missing PRIVACY_URL or BUSINESS_POSTAL_ADDRESS");
  }
  if (privacyUrl && new URL(privacyUrl).protocol !== "https:") {
    throw new Error("Invalid PRIVACY_URL");
  }

  return {
    mode,
    enabled: true,
    apiKey,
    from: requireValue(env.RESEND_FROM_EMAIL, "RESEND_FROM_EMAIL"),
    templateId: requireValue(env.RESEND_CONFIRM_TEMPLATE_ID, "RESEND_CONFIRM_TEMPLATE_ID"),
    segmentId,
    topicId,
    ownerEmail,
    publicSiteUrl: publicSiteUrl.origin,
    brandName: env.BRAND_NAME || "SURGE",
    privacyUrl,
    postalAddress,
    tokenKeys,
    idempotencySecret,
    signupSource:
      mode === "preview"
        ? "shareable_preview"
        : mode === "canary"
          ? "production_canary"
          : "website",
  };
}

/**
 * Webhook verification is independent from sending a confirmation email.
 * Resolve its secret only when the webhook endpoint receives an event so a
 * missing or rotated webhook configuration cannot block signup testing.
 * @param {Environment} env
 */
export function resolveResendWebhookSecret(env) {
  return requireSecret(
    env.RESEND_WEBHOOK_SECRET,
    "RESEND_WEBHOOK_SECRET",
    /^whsec_[A-Za-z0-9+/]{16,}={0,2}$/u,
  );
}

/** @param {string | undefined} value */
function requireValue(value, name = "required environment value") {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

/** @param {string | undefined} value @param {string} name @param {RegExp} pattern */
function requireSecret(value, name, pattern) {
  const secret = requireValue(value, name);
  if (!pattern.test(secret)) {
    throw new Error(`Invalid ${name}`);
  }
  return secret;
}

/** @param {string | undefined} value @param {string} name */
function requireTokenKey(value, name) {
  const key = requireValue(value, name);
  try {
    const base64 = key.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    if (decoded.length !== 32) throw new Error(`Invalid ${name}`);
  } catch {
    throw new Error(`Invalid ${name}`);
  }
  return key;
}

/** @param {string} value @returns {value is SignupMode} */
function isSignupMode(value) {
  return value === "disabled" || value === "preview" || value === "canary" || value === "live";
}

/** @returns {Environment} */
export function runtimeEnvironment() {
  const runtime = /** @type {{process?: {env?: Environment}}} */ (globalThis);
  return runtime.process?.env || {};
}
