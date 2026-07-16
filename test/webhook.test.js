import assert from "node:assert/strict";
import test from "node:test";

import { handleResendWebhook } from "../api/resend-webhook.js";

const env = {
  SIGNUP_MODE: "preview",
  PUBLIC_SITE_URL: "https://surge-preview.vercel.app",
  RESEND_API_KEY: ["re", "test_api_key_not_real_123456"].join("_"),
  RESEND_WEBHOOK_SECRET: ["whsec", "test_webhook_not_real_123456"].join("_"),
  RESEND_FROM_EMAIL: "SURGE <onboarding@resend.dev>",
  RESEND_CONFIRM_TEMPLATE_ID: "tmpl_confirm",
  RESEND_TEST_SEGMENT_ID: "seg_test",
  RESEND_TEST_TOPIC_ID: "topic_test",
  SIGNUP_TOKEN_KEY_CURRENT: Buffer.alloc(32, 1).toString("base64url"),
  SIGNUP_IDEMPOTENCY_SECRET: "test-only-idempotency-secret-at-least-32",
  TEST_RECIPIENT_EMAIL: "owner@example.com",
};

function webhookRequest(event) {
  return new Request("https://surge-preview.vercel.app/api/resend-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": "msg_test",
      "svix-timestamp": "1752667200",
      "svix-signature": "v1,test",
    },
    body: JSON.stringify(event),
  });
}

function gateway(event, overrides = {}) {
  const calls = [];
  return {
    calls,
    verifyWebhook() {
      return event;
    },
    async suppressContact(payload) {
      calls.push(payload);
    },
    ...overrides,
  };
}

const event = (type, extra = {}) => ({
  type,
  data: {
    email_id: "email_test",
    to: ["owner@example.com"],
    ...extra,
  },
});

test("permanent bounces, complaints, and suppressions opt out existing contacts", async () => {
  for (const candidate of [
    event("email.bounced", { bounce: { type: "Permanent" } }),
    event("email.complained"),
    event("email.suppressed"),
  ]) {
    const provider = gateway(candidate);
    const response = await handleResendWebhook(webhookRequest(candidate), { env, gateway: provider });
    assert.equal(response.status, 200);
    assert.deepEqual(provider.calls, [{ email: "owner@example.com", topicId: "topic_test" }]);
  }
});

test("transient bounces and delivery events never change consent", async () => {
  for (const candidate of [
    event("email.bounced", { bounce: { type: "Transient" } }),
    event("email.delivered"),
    event("email.delivery_delayed"),
    event("email.failed"),
  ]) {
    const provider = gateway(candidate);
    const response = await handleResendWebhook(webhookRequest(candidate), { env, gateway: provider });
    assert.equal(response.status, 200);
    assert.equal(provider.calls.length, 0);
  }
});

test("invalid signatures are rejected before payload processing", async () => {
  const provider = gateway(event("email.complained"), {
    verifyWebhook() {
      throw new Error("bad signature");
    },
  });
  const response = await handleResendWebhook(webhookRequest(event("email.complained")), {
    env,
    gateway: provider,
  });

  assert.equal(response.status, 401);
  assert.equal(provider.calls.length, 0);
});

test("retryable provider failures return non-success without leaking a recipient", async () => {
  const candidate = event("email.complained");
  const provider = gateway(candidate, {
    async suppressContact() {
      throw new Error("owner@example.com");
    },
  });
  const response = await handleResendWebhook(webhookRequest(candidate), { env, gateway: provider });

  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /owner|example/i);
});
