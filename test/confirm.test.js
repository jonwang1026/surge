import assert from "node:assert/strict";
import test from "node:test";

import { handleConfirmationRequest } from "../api/confirm.js";
import { encryptSignupToken } from "../api/_lib/token.js";

const currentKey = Buffer.alloc(32, 6).toString("base64url");
const now = Date.parse("2026-07-16T12:00:00Z");
const env = {
  SIGNUP_MODE: "preview",
  PUBLIC_SITE_URL: "https://surge-preview.vercel.app",
  RESEND_API_KEY: ["re", "test_api_key_not_real_123456"].join("_"),
  RESEND_WEBHOOK_SECRET: ["whsec", "+/".repeat(16)].join("_"),
  RESEND_FROM_EMAIL: "SURGE <onboarding@resend.dev>",
  RESEND_CONFIRM_TEMPLATE_ID: "tmpl_confirm",
  RESEND_TEST_SEGMENT_ID: "seg_test",
  RESEND_TEST_TOPIC_ID: "topic_test",
  SIGNUP_TOKEN_KEY_CURRENT: currentKey,
  SIGNUP_IDEMPOTENCY_SECRET: "test-only-idempotency-secret-at-least-32",
  TEST_RECIPIENT_EMAIL: "owner@example.com",
};

async function token(options = {}) {
  return encryptSignupToken(
    { email: "owner@example.com", mode: options.mode || "preview" },
    currentKey,
    { now: options.issuedAt ?? now, randomBytes: new Uint8Array(12).fill(options.iv ?? 2) },
  );
}

function request(confirmationToken) {
  return new Request(
    `https://surge-preview.vercel.app/api/confirm?token=${encodeURIComponent(confirmationToken)}`,
  );
}

test("confirms consent into only the selected test segment and topic", async () => {
  const calls = [];
  const gateway = {
    async confirmContact(payload) {
      calls.push(payload);
    },
  };
  const response = await handleConfirmationRequest(request(await token()), {
    env,
    gateway,
    now: now + 1_000,
  });

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://surge-preview.vercel.app/earlyaccess/confirmed/?status=success",
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    email: "owner@example.com",
    segmentId: "seg_test",
    topicId: "topic_test",
    properties: {
      confirmed_at: new Date(now + 1_000).toISOString(),
      consent_version: "early-access-v1",
      consent_method: "double_opt_in",
      signup_source: "shareable_preview",
    },
  });
  assert.doesNotMatch(response.headers.get("location"), /token|owner|example/i);
});

test("repeat confirmation remains a successful idempotent provider operation", async () => {
  let confirmations = 0;
  const gateway = { async confirmContact() { confirmations += 1; } };
  const confirmationToken = await token();

  const first = await handleConfirmationRequest(request(confirmationToken), { env, gateway, now });
  const second = await handleConfirmationRequest(request(confirmationToken), { env, gateway, now });

  assert.equal(first.headers.get("location")?.endsWith("status=success"), true);
  assert.equal(second.headers.get("location")?.endsWith("status=success"), true);
  assert.equal(confirmations, 2);
});

test("tampered, expired, and wrong-mode tokens fail without exposing token data", async () => {
  const valid = await token();
  const cipherStart = valid.lastIndexOf(".") + 2;
  const tampered = `${valid.slice(0, cipherStart)}${valid[cipherStart] === "A" ? "B" : "A"}${valid.slice(cipherStart + 1)}`;
  const expired = await token({ issuedAt: now - 86_400_001, iv: 3 });
  const wrongMode = await token({ mode: "live", iv: 4 });

  for (const candidate of [tampered, expired, wrongMode]) {
    const response = await handleConfirmationRequest(request(candidate), {
      env,
      gateway: { async confirmContact() { throw new Error("must not run"); } },
      now,
    });
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "https://surge-preview.vercel.app/earlyaccess/confirmed/?status=invalid",
    );
  }
});

test("provider failure redirects to the retryable result without personal data", async () => {
  const response = await handleConfirmationRequest(request(await token()), {
    env,
    gateway: { async confirmContact() { throw new Error("owner@example.com"); } },
    now,
  });

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://surge-preview.vercel.app/earlyaccess/confirmed/?status=temporary",
  );
});
