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

test("every local srcset candidate resolves and campaign formats use exact candidate sets", async () => {
  const homepageFile = "homepage/index.html";
  const homepage = await readFile(path.join(root, homepageFile), "utf8");
  const expectedCandidates = {
    wide: ["480w", "960w", "1774w"],
    portrait: ["480w", "887w"],
    square: ["480w", "960w", "1254w"],
  };
  const srcsets = [...homepage.matchAll(/srcset="([^"]+)"/gu)].map((match) => match[1]);

  for (const srcset of srcsets) {
    for (const candidate of srcset.split(",")) {
      const [reference] = candidate.trim().split(/\s+/u);
      const relative = path.join(path.dirname(homepageFile), reference);
      await assert.doesNotReject(readFile(path.join(root, relative)), `${homepageFile}: ${reference}`);
    }
  }

  const campaignImages = [...homepage.matchAll(/<img[\s\S]*?\/>/gu)].map((match) => match[0]);
  for (const image of campaignImages) {
    const format = image.match(/surge-nyc-(wide|portrait|square)-\d{2}\.webp/u)?.[1];
    if (!format) continue;
    const srcset = image.match(/srcset="([^"]+)"/u)?.[1];
    assert.ok(srcset, `${format} campaign image has a srcset`);
    const candidates = srcset.match(/\s(\d+w)(?:,|$)/gu).map((candidate) => candidate.trim().replace(",", ""));
    assert.deepEqual(candidates, expectedCandidates[format], `${format} campaign candidate set is exact`);
    if (format === "portrait") assert.ok(!candidates.includes("960w"));
  }
});

test("browser regression tests contain no machine-specific artifact paths", async () => {
  const responsiveTest = await readFile(path.join(root, "e2e/responsive.spec.js"), "utf8");
  assert.doesNotMatch(responsiveTest, /\/Users\/jonathan\//u);
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

test("homepage identifies the product and exposes accessible responsive campaign images", async () => {
  const homepage = await readFile(path.join(root, "homepage/index.html"), "utf8");
  assert.match(homepage, /For last minute parties, pivots, and whatever’s next\./);
  assert.match(homepage, /<a class="hero-cta" href="\/earlyaccess\/">Get early access<\/a>/);

  const campaignImages = [...homepage.matchAll(/<img[\s\S]*?\/>/gu)].map((match) => match[0]);
  const sizesByFormat = {
    wide: "(min-width: 1024px) 50vw, (min-width: 768px) 66vw, 100vw",
    portrait: "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw",
    square: "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw",
  };

  assert.equal(campaignImages.length, 13);
  for (const image of campaignImages) {
    const format = image.match(/surge-nyc-(wide|portrait|square)-\d{2}\.webp/u)?.[1];

    assert.match(image, /alt="[^"]+"/u);
    assert.doesNotMatch(image, /alt=""/u);
    assert.match(image, /srcset="[^"]+"/u);
    assert.match(image, /sizes="[^"]+"/u);
    assert.ok(format, "campaign image source identifies its responsive format");
    assert.ok(
      image.includes(`sizes="${sizesByFormat[format]}"`),
      `${format} campaign image has its exact responsive sizes contract`,
    );
  }
});

test("user-facing pages contain no Contact destination or stale anchor", async () => {
  assert.deepEqual(htmlFiles, [
    "index.html",
    "homepage/index.html",
    "earlyaccess/index.html",
    "earlyaccess/confirmed/index.html",
  ]);

  for (const htmlFile of htmlFiles) {
    const html = await readFile(path.join(root, htmlFile), "utf8");
    assert.doesNotMatch(html, /(?:id|href)="[^"]*contact[^"]*"/iu, htmlFile);
    assert.doesNotMatch(html, /href="mailto:/iu, htmlFile);
    assert.doesNotMatch(html, /\bcontact\b/iu, htmlFile);
    assert.doesNotMatch(
      html,
      /\b[A-Z0-9._%+-]+@(?!example\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
      htmlFile,
    );
  }
});
