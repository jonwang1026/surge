import { expect, test } from "@playwright/test";

const widths = [320, 375, 768, 1024, 1440];
const pages = ["/homepage/", "/earlyaccess/"];

for (const width of widths) {
  for (const path of pages) {
    test(`${path} has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
      await page.goto(path);

      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    });
  }
}

test("early-access submission has stable pending, success, and reset states on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/earlyaccess/");

  await page.getByLabel("Email address required").fill("owner@example.com");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
  await expect(page.getByText("Confirm your email to join early access.")).toBeVisible();

  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email address required")).toBeFocused();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("confirmation result strips status and never renders an address", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/earlyaccess/confirmed/?status=success");

  await expect(page.getByRole("heading", { name: "You're in." })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:4173/earlyaccess/confirmed/");
  await expect(page.locator("body")).not.toContainText("@");
});

test("the local mock server never exposes repository configuration", async ({ request }) => {
  for (const path of ["/.env.local", "/package.json", "/RESEND_SETUP.md"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
  }
});
