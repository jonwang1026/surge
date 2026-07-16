import assert from "node:assert/strict";
import test from "node:test";

import { resolveSignupConfig } from "../api/_lib/config.js";

const env = {
  SIGNUP_MODE: "preview",
  PUBLIC_SITE_URL: "https://example.com",
  BRAND_NAME: "SURGE",
  RESEND_API_KEY: ["re", "test_api_key_not_real_123456"].join("_"),
  RESEND_WEBHOOK_SECRET: ["whsec", "test_webhook_not_real_123456"].join("_"),
  RESEND_FROM_EMAIL: "SURGE <onboarding@resend.dev>",
  RESEND_CONFIRM_TEMPLATE_ID: "tmpl_test",
  RESEND_EARLY_ACCESS_SEGMENT_ID: "seg_production",
  RESEND_TEST_SEGMENT_ID: "seg_test",
  RESEND_EARLY_ACCESS_TOPIC_ID: "topic_production",
  RESEND_TEST_TOPIC_ID: "topic_test",
  SIGNUP_TOKEN_KEY_CURRENT: Buffer.alloc(32, 3).toString("base64url"),
  SIGNUP_IDEMPOTENCY_SECRET: "test-only-idempotency-secret-at-least-32",
  TEST_RECIPIENT_EMAIL: "owner@example.com",
  PRIVACY_URL: "https://example.com/privacy",
  BUSINESS_POSTAL_ADDRESS: "Test address",
};

test("deployment modes select isolated resources and canonical consent sources", () => {
  const preview = resolveSignupConfig(env);
  const canary = resolveSignupConfig({ ...env, SIGNUP_MODE: "canary" });
  const live = resolveSignupConfig({ ...env, SIGNUP_MODE: "live" });

  assert.equal(preview.enabled && preview.segmentId, "seg_test");
  assert.equal(preview.enabled && preview.signupSource, "shareable_preview");
  assert.equal(canary.enabled && canary.segmentId, "seg_production");
  assert.equal(canary.enabled && canary.signupSource, "production_canary");
  assert.equal(live.enabled && live.signupSource, "website");
  assert.equal(live.enabled && live.ownerEmail, null);
});

test("active configuration rejects malformed secrets and non-origin site URLs", () => {
  assert.throws(() =>
    resolveSignupConfig({ ...env, SIGNUP_TOKEN_KEY_CURRENT: "not-a-32-byte-key" }),
  );
  assert.throws(() =>
    resolveSignupConfig({ ...env, PUBLIC_SITE_URL: "https://example.com/unexpected-path" }),
  );
  assert.throws(() =>
    resolveSignupConfig({ ...env, SIGNUP_IDEMPOTENCY_SECRET: "too-short" }),
  );
});
