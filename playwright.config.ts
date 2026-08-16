/**
 * Playwright E2E 配置（规格 §16.3/§16.4）：
 * - 项目矩阵：chromium 承载 §16.3 全量场景；firefox/webkit 仅运行关键冒烟
 *   （smoke.spec.ts，经 testMatch 收窄），--project 按这些名称过滤；
 * - webServer 是唯一有界服务入口：先以 VITE_DEMO_MODE=force 执行生产构建，
 *   再启动 vite preview（SPA fallback，深链刷新可用，规格 §16.4）；
 *   就绪检查探测 BASE_URL，Playwright 结束时自动关闭服务（规格 §13.2 demo 账号任意密码）。
 */
import { defineConfig, devices } from '@playwright/test'

/** E2E 专用端口：避开 dev(5173)/preview(4173) 常用端口，strictPort 占用即失败 */
const E2E_PORT = 4180
const BASE_URL = `http://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // 全量项目：覆盖规格 §16.3 Playwright 清单全部场景
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // 关键冒烟项目（规格 §16.4：Firefox/WebKit 冒烟）
      name: 'firefox',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      // 关键冒烟项目（规格 §16.4：Firefox/WebKit 冒烟）
      name: 'webkit',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${E2E_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { ...process.env, VITE_DEMO_MODE: 'force' },
  },
})
