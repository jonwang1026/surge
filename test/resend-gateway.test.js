import assert from "node:assert/strict";
import test from "node:test";

import { ResendGateway } from "../api/_lib/resend-gateway.js";

const message = {
  to: "owner@example.com",
  from: "SURGE <onboarding@resend.dev>",
  templateId: "tmpl_test",
  brandName: "SURGE",
  confirmUrl: "https://example.com/api/confirm?token=opaque",
  privacyUrl: "",
  postalAddress: "",
  mode: "preview",
  idempotencyKey: "early-access/preview/opaque",
};

for (const name of ["invalid_idempotent_request", "concurrent_idempotent_requests"]) {
  test(`treats Resend ${name} as a successfully suppressed duplicate`, async () => {
    const gateway = new ResendGateway("test-api-key-not-a-real-secret");
    gateway.resend = {
      emails: {
        async send() {
          return { data: null, error: { name, message: "duplicate", statusCode: 409 } };
        },
      },
    };

    await assert.doesNotReject(gateway.sendConfirmation(message));
  });
}

test("propagates unrelated provider failures", async () => {
  const gateway = new ResendGateway("test-api-key-not-a-real-secret");
  gateway.resend = {
    emails: {
      async send() {
        return {
          data: null,
          error: { name: "validation_error", message: "bad template", statusCode: 400 },
        };
      },
    },
  };

  await assert.rejects(gateway.sendConfirmation(message));
});
