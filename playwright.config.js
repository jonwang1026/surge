import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    colorScheme: "light",
  },
  webServer: {
    command: "npm run prototype",
    url: "http://127.0.0.1:4173/homepage/",
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
