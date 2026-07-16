import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEmail } from "../api/_lib/email.js";

test("normalizes only surrounding whitespace and the domain", () => {
  assert.equal(normalizeEmail("  First.Last+SURGE@EXAMPLE.COM  "), "First.Last+SURGE@example.com");
});

test("rejects malformed, controlled, and oversized addresses", () => {
  const invalid = [
    "missing-at.example.com",
    "two@@example.com",
    "person@example",
    "person\n@example.com",
    `${"a".repeat(245)}@example.com`,
  ];

  for (const value of invalid) {
    assert.equal(normalizeEmail(value), null, value);
  }
});
