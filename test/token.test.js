import assert from "node:assert/strict";
import test from "node:test";

import { decryptSignupToken, encryptSignupToken } from "../api/_lib/token.js";

const currentKey = Buffer.alloc(32, 7).toString("base64url");
const previousKey = Buffer.alloc(32, 4).toString("base64url");
const now = Date.parse("2026-07-16T12:00:00Z");

test("round-trips a valid confirmation token", async () => {
  const token = await encryptSignupToken(
    { email: "Owner@example.com", mode: "preview" },
    currentKey,
    { now, randomBytes: new Uint8Array(12).fill(3) },
  );
  assert.equal(token.split(".").length, 4);
  assert.doesNotMatch(token, /Owner|example/i);

  const claims = await decryptSignupToken(token, [currentKey], {
    now: now + 1_000,
    expectedMode: "preview",
  });

  assert.deepEqual(claims, {
    email: "Owner@example.com",
    mode: "preview",
    consentVersion: "early-access-v1",
    exp: now + 86_400_000,
  });
});

test("accepts the previous key during rotation", async () => {
  const token = await encryptSignupToken(
    { email: "owner@example.com", mode: "preview" },
    previousKey,
    { now, randomBytes: new Uint8Array(12).fill(8) },
  );

  const claims = await decryptSignupToken(token, [currentKey, previousKey], {
    now,
    expectedMode: "preview",
  });

  assert.equal(claims.email, "owner@example.com");
});

test("rejects tampered, expired, and wrong-environment tokens", async () => {
  const token = await encryptSignupToken(
    { email: "owner@example.com", mode: "preview" },
    currentKey,
    { now, randomBytes: new Uint8Array(12).fill(5) },
  );
  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

  await assert.rejects(() => decryptSignupToken(tampered, [currentKey], { now, expectedMode: "preview" }));
  await assert.rejects(() =>
    decryptSignupToken(token, [currentKey], {
      now: now + 86_400_001,
      expectedMode: "preview",
    }),
  );
  await assert.rejects(() => decryptSignupToken(token, [currentKey], { now, expectedMode: "live" }));
});
