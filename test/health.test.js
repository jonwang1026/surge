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
