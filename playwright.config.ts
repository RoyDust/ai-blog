import { defineConfig, devices } from "@playwright/test"

/**
 * E2E 配置。
 * - 本地默认起 `pnpm dev`（reuseExistingServer 便于调试）
 * - CI 设 E2E_SERVER_COMMAND="pnpm start" 跑生产构建
 * - 登录会话由 setup project 产出 storageState，业务用例全部复用，避免 auth 限流
 */
const serverCommand = process.env.E2E_SERVER_COMMAND || "pnpm dev"
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: serverCommand,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "setup",
      testMatch: /global-setup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
  ],
})
