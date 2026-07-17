import assert from "node:assert/strict";
import test from "node:test";

import { healthResponse } from "../api/health.js";

test("health is available when signup is deliberately disabled", async () => {
  const response = healthResponse({ SIGNUP_MODE: "disabled" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("health fails closed when an active integration is incomplete", async () => {
  const response = healthResponse({ SIGNUP_MODE: "preview", RESEND_API_KEY: "test-key" });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false });
});

test("health remains available when webhook verification is configured separately", async () => {
  const response = healthResponse({
    SIGNUP_MODE: "preview",
    PUBLIC_SITE_URL: "https://surge-preview.vercel.app",
    RESEND_API_KEY: "re_test_api_key_not_real_123456",
    RESEND_WEBHOOK_SECRET: "not-a-webhook-secret",
    RESEND_FROM_EMAIL: "SURGE <onboarding@resend.dev>",
    RESEND_CONFIRM_TEMPLATE_ID: "tmpl_confirm",
    RESEND_TEST_SEGMENT_ID: "seg_test",
    RESEND_TEST_TOPIC_ID: "topic_test",
    SIGNUP_TOKEN_KEY_CURRENT: Buffer.alloc(32, 1).toString("base64url"),
    SIGNUP_IDEMPOTENCY_SECRET: "test-only-idempotency-secret-at-least-32",
    TEST_RECIPIENT_EMAIL: "owner@example.com",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
