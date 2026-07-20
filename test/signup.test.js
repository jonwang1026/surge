import assert from "node:assert/strict";
import test from "node:test";

import { handleSignupRequest } from "../api/early-access.js";

const currentKey = Buffer.alloc(32, 9).toString("base64url");
const baseEnv = {
  SIGNUP_MODE: "preview",
  PUBLIC_SITE_URL: "https://surge-preview.vercel.app",
  BRAND_NAME: "SURGE",
  RESEND_API_KEY: ["re", "test_api_key_not_real_123456"].join("_"),
  RESEND_WEBHOOK_SECRET: ["whsec", "+/".repeat(16)].join("_"),
  RESEND_FROM_EMAIL: "SURGE <onboarding@resend.dev>",
  RESEND_CONFIRM_TEMPLATE_ID: "tmpl_confirm",
  RESEND_TEST_SEGMENT_ID: "seg_test",
  RESEND_TEST_TOPIC_ID: "topic_test",
  SIGNUP_TOKEN_KEY_CURRENT: currentKey,
  SIGNUP_IDEMPOTENCY_SECRET: "test-only-idempotency-secret-at-least-32",
  TEST_RECIPIENT_EMAIL: "Owner@EXAMPLE.com",
};

function signupRequest(body, headers = {}) {
  return new Request("https://surge-preview.vercel.app/api/early-access", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://surge-preview.vercel.app",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function gateway(overrides = {}) {
  const calls = { sent: [] };
  return {
    calls,
    async getSubscription() {
      return { subscribed: false, inSegment: false, topicOptIn: false };
    },
    async sendConfirmation(payload) {
      calls.sent.push(payload);
    },
    ...overrides,
  };
}

test("returns a neutral response without transmitting when signups are disabled", async () => {
  const provider = gateway();
  const response = await handleSignupRequest(signupRequest({ email: "person@example.com" }), {
    env: { SIGNUP_MODE: "disabled" },
    gateway: provider,
    now: 1_000,
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(provider.calls.sent.length, 0);
});

test("preview mode silently discards any address except the owner", async () => {
  const provider = gateway();
  const response = await handleSignupRequest(signupRequest({ email: "friend@example.com" }), {
    env: baseEnv,
    gateway: provider,
    now: 1_000,
  });

  assert.equal(response.status, 202);
  assert.equal(provider.calls.sent.length, 0);
});

test("sends one owner confirmation with an encrypted link and opaque idempotency key", async () => {
  const provider = gateway();
  const response = await handleSignupRequest(signupRequest({ email: "Owner@example.com" }), {
    env: baseEnv,
    gateway: provider,
    now: Date.parse("2026-07-16T12:00:00Z"),
  });

  assert.equal(response.status, 202);
  assert.equal(provider.calls.sent.length, 1);
  const [message] = provider.calls.sent;
  assert.equal(message.to, "Owner@example.com");
  assert.match(message.confirmUrl, /^https:\/\/surge-preview\.vercel\.app\/api\/confirm\?token=v1\./);
  assert.doesNotMatch(message.confirmUrl, /Owner|example/i);
  assert.match(message.idempotencyKey, /^early-access\/preview\/[A-Za-z0-9_-]{20,}$/);
  assert.doesNotMatch(message.idempotencyKey, /Owner|example/i);
});

test("does not send when the selected segment and topic are already confirmed", async () => {
  const provider = gateway({
    async getSubscription() {
      return { subscribed: true, inSegment: true, topicOptIn: true };
    },
  });
  const response = await handleSignupRequest(signupRequest({ email: "Owner@example.com" }), {
    env: baseEnv,
    gateway: provider,
    now: 1_000,
  });

  assert.equal(response.status, 202);
  assert.equal(provider.calls.sent.length, 0);
});

test("rejects invalid input and oversized requests without echoing the address", async () => {
  const invalid = await handleSignupRequest(signupRequest({ email: "not-an-email" }), {
    env: baseEnv,
    gateway: gateway(),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "invalid_email" });

  const oversized = await handleSignupRequest(
    signupRequest({ email: "Owner@example.com", padding: "x".repeat(2_100) }),
    { env: baseEnv, gateway: gateway() },
  );
  assert.equal(oversized.status, 413);
  assert.doesNotMatch(await oversized.text(), /Owner|example/i);
});

test("honeypot traffic gets the neutral response without provider calls", async () => {
  const provider = gateway();
  const response = await handleSignupRequest(
    signupRequest({ email: "Owner@example.com", company: "spam", renderedAt: 500 }),
    { env: baseEnv, gateway: provider, now: 1_000 },
  );

  assert.equal(response.status, 202);
  assert.equal(provider.calls.sent.length, 0);
});

test("an implausibly fast browser submission is neutrally discarded", async () => {
  const provider = gateway();
  const response = await handleSignupRequest(
    signupRequest({ email: "Owner@example.com", company: "", renderedAt: 500 }),
    { env: baseEnv, gateway: provider, now: 1_000 },
  );

  assert.equal(response.status, 202);
  assert.equal(provider.calls.sent.length, 0);
});

test("requests without matching origin evidence are rejected", async () => {
  const request = signupRequest({ email: "Owner@example.com" });
  request.headers.delete("origin");
  const response = await handleSignupRequest(request, { env: baseEnv, gateway: gateway() });
  assert.equal(response.status, 403);
});

test("provider failures return a generic retryable response", async () => {
  const provider = gateway({
    async getSubscription() {
      throw new Error("provider leaked details for Owner@example.com");
    },
  });
  const response = await handleSignupRequest(signupRequest({ email: "Owner@example.com" }), {
    env: baseEnv,
    gateway: provider,
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.clone().json(), { error: "temporarily_unavailable" });
  assert.doesNotMatch(await response.text(), /Owner|example|provider leaked/i);
});
