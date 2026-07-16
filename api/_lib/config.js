import { normalizeEmail } from "./email.js";

/** @typedef {Record<string, string | undefined>} Environment */
/** @typedef {"disabled" | "preview" | "canary" | "live"} SignupMode */
/** @typedef {Exclude<SignupMode, "disabled">} ActiveSignupMode */
/** @typedef {{mode: "disabled", enabled: false}} DisabledSignupConfig */
/** @typedef {{mode: ActiveSignupMode, enabled: true, apiKey: string, from: string, templateId: string,
 * segmentId: string, topicId: string, ownerEmail: string | null, publicSiteUrl: string,
 * brandName: string, privacyUrl: string, postalAddress: string, tokenKeys: [string, ...string[]],
 * idempotencySecret: string, webhookSecret: string,
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
  );
  const topicId = requireValue(
    isTest ? env.RESEND_TEST_TOPIC_ID : env.RESEND_EARLY_ACCESS_TOPIC_ID,
  );
  const ownerEmail = isRestricted ? normalizeEmail(env.TEST_RECIPIENT_EMAIL) : null;
  if (isRestricted && !ownerEmail) throw new Error("Missing TEST_RECIPIENT_EMAIL");

  const publicSiteUrl = new URL(requireValue(env.PUBLIC_SITE_URL));
  if (
    (publicSiteUrl.protocol !== "https:" && publicSiteUrl.hostname !== "localhost") ||
    publicSiteUrl.pathname !== "/" ||
    publicSiteUrl.search ||
    publicSiteUrl.hash
  ) {
    throw new Error("PUBLIC_SITE_URL must use HTTPS");
  }

  const apiKey = requireSecret(env.RESEND_API_KEY, /^re_[A-Za-z0-9_-]{16,}$/u);
  const webhookSecret = requireSecret(env.RESEND_WEBHOOK_SECRET, /^whsec_[A-Za-z0-9_-]{16,}$/u);
  const currentTokenKey = requireTokenKey(env.SIGNUP_TOKEN_KEY_CURRENT);
  const idempotencySecret = requireSecret(env.SIGNUP_IDEMPOTENCY_SECRET, /^\S{32,}$/u);
  /** @type {[string, ...string[]]} */
  const tokenKeys = env.SIGNUP_TOKEN_KEY_PREVIOUS
    ? [currentTokenKey, requireTokenKey(env.SIGNUP_TOKEN_KEY_PREVIOUS)]
    : [currentTokenKey];
  const privacyUrl = env.PRIVACY_URL || "";
  const postalAddress = env.BUSINESS_POSTAL_ADDRESS || "";
  if ((mode === "canary" || mode === "live") && (!privacyUrl || !postalAddress)) {
    throw new Error("Public signup requires privacy and postal details");
  }
  if (privacyUrl && new URL(privacyUrl).protocol !== "https:") {
    throw new Error("PRIVACY_URL must use HTTPS");
  }

  return {
    mode,
    enabled: true,
    apiKey,
    from: requireValue(env.RESEND_FROM_EMAIL),
    templateId: requireValue(env.RESEND_CONFIRM_TEMPLATE_ID),
    segmentId,
    topicId,
    ownerEmail,
    publicSiteUrl: publicSiteUrl.origin,
    brandName: env.BRAND_NAME || "SURGE",
    privacyUrl,
    postalAddress,
    tokenKeys,
    idempotencySecret,
    webhookSecret,
    signupSource:
      mode === "preview"
        ? "shareable_preview"
        : mode === "canary"
          ? "production_canary"
          : "website",
  };
}

/** @param {string | undefined} value */
function requireValue(value) {
  if (!value) throw new Error("Missing required environment value");
  return value;
}

/** @param {string | undefined} value @param {RegExp} pattern */
function requireSecret(value, pattern) {
  const secret = requireValue(value);
  if (!pattern.test(secret)) {
    throw new Error("Invalid secret format");
  }
  return secret;
}

/** @param {string | undefined} value */
function requireTokenKey(value) {
  const key = requireValue(value);
  try {
    const base64 = key.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    if (decoded.length !== 32) throw new Error("Invalid token key");
  } catch {
    throw new Error("Invalid token key");
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
