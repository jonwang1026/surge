import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = [
  "index.html",
  "homepage/index.html",
  "earlyaccess/index.html",
  "earlyaccess/confirmed/index.html",
];

test("all local page assets resolve inside the deployment root", async () => {
  for (const htmlFile of htmlFiles) {
    const html = await readFile(path.join(root, htmlFile), "utf8");
    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/gu)].map((match) => match[1]);
    for (const reference of references) {
      if (
        reference.startsWith("https://") ||
        reference.startsWith("#") ||
        reference.startsWith("/_vercel/") ||
        reference.startsWith("/api/")
      ) {
        continue;
      }
      const withoutQuery = reference.split("?")[0];
      const relative = withoutQuery.startsWith("/")
        ? withoutQuery.slice(1)
        : path.join(path.dirname(htmlFile), withoutQuery);
      const target = relative.endsWith("/") ? path.join(relative, "index.html") : relative;
      await assert.doesNotReject(readFile(path.join(root, target)), `${htmlFile}: ${reference}`);
    }
  }
});

test("preview deployment blocks indexing and constrains browser capabilities", async () => {
  const config = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
  const globalHeaders = Object.fromEntries(
    config.headers.find((rule) => rule.source === "/(.*)").headers.map((header) => [
      header.key.toLowerCase(),
      header.value,
    ]),
  );

  assert.match(globalHeaders["x-robots-tag"], /noindex/);
  assert.match(globalHeaders["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(globalHeaders["content-security-policy"], /form-action 'self'/);
  assert.match(globalHeaders["content-security-policy"], /font-src 'self'/);
  assert.doesNotMatch(globalHeaders["content-security-policy"], /googleapis|gstatic/);
  assert.equal(globalHeaders["x-frame-options"], "DENY");
});

test("only public editorial pages include page-view analytics", async () => {
  const homepage = await readFile(path.join(root, "homepage/index.html"), "utf8");
  const earlyAccess = await readFile(path.join(root, "earlyaccess/index.html"), "utf8");
  const confirmed = await readFile(path.join(root, "earlyaccess/confirmed/index.html"), "utf8");

  assert.match(homepage, /_vercel\/insights\/script\.js/);
  assert.match(earlyAccess, /_vercel\/insights\/script\.js/);
  assert.doesNotMatch(confirmed, /_vercel\/insights/);
});
