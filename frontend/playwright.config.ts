import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API_PORT = 8100;
const WEB_PORT = 3100;
const dbPath = join(tmpdir(), `fireflies-e2e-${Date.now()}.db`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: `uv run uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/api/health`,
      env: { DATABASE_URL: `sqlite:///${dbPath}`, SEED_ON_STARTUP: "true", ANTHROPIC_API_KEY: "" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/meetings`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
