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

test("early-access submission has stable pending and terminal success states on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/earlyaccess/");

  await page.getByLabel("Email address (required)", { exact: true }).fill("owner@example.com");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
  await expect(page.getByText("Confirm your email to join early access.")).toBeVisible();
  await expect(page.locator("[data-signup-fields]")).toBeHidden();
  await expect(page.locator("[data-signup-confirmation]")).toBeVisible();
  await expect(page.locator("[data-signup-confirmation] button")).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("early-access 400 recovery restores the invalid email field before returning focus", async ({
  page,
}) => {
  await page.route("**/api/early-access", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: '{"error":"invalid"}' }),
  );
  await page.goto("/earlyaccess/");

  const form = page.locator(".signup");
  const input = page.getByLabel("Email address (required)", { exact: true });
  await input.fill("owner@example.com");
  await page.getByRole("button", { name: "Join", exact: true }).click();

  await expect(form).toHaveAttribute("aria-busy", "false");
  await expect(input).toBeEnabled();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a valid email address.", { exact: true })).toBeVisible();
  await expect(input).toBeFocused();
});

test("early-access form exposes concise consent, pending feedback, and success focus", async ({
  page,
}) => {
  await page.route("**/api/early-access", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' });
  });
  for (const viewport of [
    { width: 320, height: 780 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/earlyaccess/");

    await expect(
      page.getByText(
        "By joining, you confirm you want to receive SURGE early-access and product-launch emails.",
        { exact: true },
      ),
    ).toBeVisible();

    const inputRow = page.locator(".input-row");
    const input = page.getByLabel("Email address (required)", { exact: true });
    const submitButton = page.getByRole("button", { name: "Join", exact: true });
    await input.scrollIntoViewIfNeeded();
    if (viewport.width === 320) {
      await input.fill("invalid");
      await submitButton.click();
      await expect(page.getByText("Enter a valid email address.", { exact: true })).toBeVisible();
    }
    const idleRowBox = await inputRow.boundingBox();
    const idleButtonBox = await submitButton.boundingBox();
    expect(idleRowBox).not.toBeNull();
    expect(idleButtonBox).not.toBeNull();
    const idleRowSize = { width: idleRowBox.width, height: idleRowBox.height };
    const idleButtonSize = { width: idleButtonBox.width, height: idleButtonBox.height };
    expect(idleButtonSize.height).toBeGreaterThanOrEqual(44);

    await input.fill("owner@example.com");
    await submitButton.click();
    await expect(page.locator(".signup")).toHaveAttribute("aria-busy", "true");
    const pendingButton = page.getByRole("button", { name: "Joining…", exact: true });
    await expect(pendingButton).toBeDisabled();
    await expect(page.locator(".submit-spinner")).toBeVisible();
    const pendingStyle = await pendingButton.evaluate((button) => {
      const style = getComputedStyle(button);
      const luminance = (rgb) => {
        const channels = rgb.match(/\d+(?:\.\d+)?/gu).map(Number).slice(0, 3);
        const linear = channels.map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return {
        color: style.color,
        opacity: style.opacity,
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      };
    });
    expect(pendingStyle.color).toBe("rgb(255, 255, 255)");
    expect(pendingStyle.opacity).toBe("1");
    expect(pendingStyle.contrast).toBeGreaterThanOrEqual(4.5);

    const pendingRowBox = await inputRow.boundingBox();
    const pendingButtonBox = await pendingButton.boundingBox();
    expect({ width: pendingRowBox.width, height: pendingRowBox.height }).toEqual(idleRowSize);
    expect({ width: pendingButtonBox.width, height: pendingButtonBox.height }).toEqual(
      idleButtonSize,
    );
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

    const confirmationTitle = page.getByRole("heading", { name: "Check your inbox.", exact: true });
    await expect(confirmationTitle).toBeVisible();
    await expect(confirmationTitle).toBeFocused();

  }
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

test("homepage CTA stays visible and usable at the narrowest viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/homepage/");
  const cta = page.getByRole("link", { name: "Get early access", exact: true });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/earlyaccess/");
  const box = await cta.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("homepage supporting line stays on one line when the tile can fit it", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/homepage/");
    const line = page.locator(".hero-description-primary");
    const metrics = await line.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(styles.lineHeight),
        width: element.getBoundingClientRect().width,
        parentWidth: element.parentElement.getBoundingClientRect().width,
      };
    });
    expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight + 1);
    expect(metrics.width).toBeLessThanOrEqual(metrics.parentWidth + 1);
  }
});

test("homepage supporting line wraps instead of overflowing when the tile is narrower", async ({ page }) => {
  await page.setViewportSize({ width: 240, height: 900 });
  await page.goto("/homepage/");
  const line = page.locator(".hero-description-primary");
  const metrics = await line.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(metrics.height).toBeGreaterThan(metrics.lineHeight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
});

test("navigation uses accessible formula-aware indicators", async ({ page }) => {
  await page.goto("/homepage/");
  const homeColor = await page.getByRole("link", { name: "Home", exact: true }).evaluate(
    (link) => getComputedStyle(link, "::after").backgroundColor,
  );
  const homeHeight = await page
    .getByRole("link", { name: "Home", exact: true })
    .evaluate((link) => getComputedStyle(link, "::after").height);
  expect(homeColor).toBe("rgb(157, 220, 240)");
  expect(homeHeight).toBe("3px");

  await page.goto("/earlyaccess/?formula=resurge");
  const resurgeLink = page.getByRole("link", { name: "Early access", exact: true });
  const resurgeStyles = await resurgeLink.evaluate((link) => {
    const styles = getComputedStyle(link, "::after");
    return { color: styles.backgroundColor, height: styles.height };
  });
  const resurgeColor = resurgeStyles.color;
  expect(resurgeColor).toBe("rgb(155, 227, 211)");
  expect(resurgeStyles.height).toBe("3px");
});

test("navigation hover uses the active formula color", async ({ page }) => {
  await page.goto("/homepage/");
  const surgeLink = page.getByRole("link", { name: "Early access", exact: true });
  await surgeLink.hover();
  const surgeHover = await surgeLink.evaluate((link) => {
    const styles = getComputedStyle(link);
    return { background: styles.backgroundColor, color: styles.color };
  });
  expect(surgeHover).toEqual({ background: "rgb(157, 220, 240)", color: "rgb(17, 19, 24)" });

  await page.goto("/earlyaccess/?formula=resurge");
  const resurgeLink = page.getByRole("link", { name: "Home", exact: true });
  await resurgeLink.hover();
  const resurgeHover = await resurgeLink.evaluate((link) => {
    const styles = getComputedStyle(link);
    return { background: styles.backgroundColor, color: styles.color };
  });
  expect(resurgeHover).toEqual({ background: "rgb(155, 227, 211)", color: "rgb(17, 19, 24)" });
});

test("wordmark hover uses an accessible foreground on both formula accents", async ({ page }) => {
  for (const formula of ["surge", "resurge"]) {
    await page.goto(`/earlyaccess/?formula=${formula}`);
    const wordmark = page.getByRole("link", { name: "SURGE homepage", exact: true });
    await wordmark.hover();
    const hoverStyle = await wordmark.evaluate((link) => {
      const style = getComputedStyle(link);
      const luminance = (rgb) => {
        const channels = rgb.match(/\d+(?:\.\d+)?/gu).map(Number).slice(0, 3);
        const linear = channels.map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return {
        color: style.color,
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      };
    });
    expect(hoverStyle.color).toBe("rgb(17, 19, 24)");
    expect(hoverStyle.contrast).toBeGreaterThanOrEqual(3);
  }
});
